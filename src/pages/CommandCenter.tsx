import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  ArrowRight,
  Bot,
  UserCheck,
  Cpu,
  ReceiptText,
  MailCheck,
  ShieldCheck,
  Terminal,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Check,
  X
} from 'lucide-react';
import { Workflow, TaskDependency, AgentType, RiskLevel } from '../types.js';
import confetti from 'canvas-confetti';

export function CommandCenter() {
  const { setCurrentPage, setSelectedWorkflowId, currentUser, refreshPendingCount } = useApp();
  const { addToast } = useToast();

  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [eventLogs, setEventLogs] = useState<{ time: string; agent: string; text: string; type: string }[]>([]);
  const [approvalDecisionReason, setApprovalDecisionReason] = useState('');
  const [approving, setApproving] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const samplePrompts = [
    {
      label: 'Onboard Rahul Kumar (Demo 1)',
      text: 'Onboard a new employee named Rahul Kumar in the Engineering department, with a joining date of November 10, 2026.'
    },
    {
      label: 'Process Invoice INV-1025 (Demo 2)',
      text: 'Process invoice INV-1025 from ABC Technologies for ₹50,000.'
    },
    {
      label: 'Provision MacBook Pro M3',
      text: 'Provision a MacBook Pro M3 Max and GitHub Enterprise credentials for Priya Sharma in Engineering.'
    },
    {
      label: 'Quarterly Finance Report',
      text: 'Generate quarterly financial audit report for Engineering department expenditure.'
    }
  ];

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLogs]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const connectToStream = (workflowId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/workflows/${workflowId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        if (data.workflow) {
          setCurrentWorkflow(data.workflow);
          if (data.workflow.status === 'completed') {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        }
        if (data.event) {
          const ev = data.event;
          setEventLogs(prev => [
            ...prev,
            {
              time: new Date(ev.timestamp).toLocaleTimeString(),
              agent: ev.agent || 'planner',
              text: ev.message,
              type: ev.type
            }
          ]);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      // Stream closed or error
      es.close();
    };
  };

  const handleSubmit = async (customPrompt?: string) => {
    const textToSubmit = customPrompt || prompt;
    if (!textToSubmit.trim() || submitting) return;

    setSubmitting(true);
    setEventLogs([]);
    setCurrentWorkflow(null);

    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSubmit })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to initialize workflow');
      }

      const wf: Workflow = await res.json();
      setCurrentWorkflow(wf);
      setPrompt('');
      addToast('info', 'Planner Agent Decomposing Request', 'Tasks assigned and state graph active.');
      connectToStream(wf.id);
    } catch (err: any) {
      addToast('error', 'Workflow Launch Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (approved: boolean) => {
    if (!currentWorkflow || !currentWorkflow.activeApprovalId) return;
    setApproving(true);

    try {
      const res = await fetch(`/api/approvals/${currentWorkflow.activeApprovalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: approved ? 'approved' : 'rejected',
          reason: approvalDecisionReason.trim() || (approved ? 'Authorized by authenticated manager.' : 'Rejected by manager.')
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Decision failed');
      }

      setCurrentWorkflow(data.workflow || data);
      await refreshPendingCount();

      if (approved) {
        addToast('success', 'Human Approval Granted', 'Resuming downstream autonomous agent execution.');
      } else {
        addToast('warning', 'Action Rejected', 'Workflow halted according to enterprise safety policy.');
      }
    } catch (err: any) {
      addToast('error', 'Approval Action Error', err.message);
    } finally {
      setApproving(false);
      setApprovalDecisionReason('');
    }
  };

  const getAgentBadge = (agentId: AgentType) => {
    switch (agentId) {
      case 'planner':
        return { label: 'Planner Agent', icon: Bot, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800' };
      case 'hr':
        return { label: 'HR Agent', icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800' };
      case 'it':
        return { label: 'IT Agent', icon: Cpu, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800' };
      case 'finance':
        return { label: 'Finance Agent', icon: ReceiptText, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800' };
      case 'communication':
        return { label: 'Communication Agent', icon: MailCheck, color: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/70 border-pink-200 dark:border-pink-800' };
      case 'approval':
        return { label: 'Approval Agent', icon: ShieldCheck, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800' };
      default:
        return { label: 'Agent', icon: Bot, color: 'text-slate-600 bg-slate-100' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              AI Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Multi-Agent Core
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Submit natural language business requests. The Planner Agent will decompose requirements into a dynamic DAG and orchestrate 6 specialized domain agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage('workflows')}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition-colors"
          >
            All Workflows
          </button>
          <button
            onClick={() => setCurrentPage('approvals')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-800 dark:text-rose-200 shadow-sm transition-colors"
          >
            Approval Center
          </button>
        </div>
      </div>

      {/* Input Box Card */}
      <div className="glass-card rounded-3xl p-6 shadow-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4 relative"
        >
          <div className="relative">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="E.g., Onboard a new employee named Rahul Kumar in the Engineering department with joining date November 10, 2026..."
              rows={3}
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 text-sm sm:text-base leading-relaxed transition-all resize-none font-medium"
              disabled={submitting}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting || !prompt.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/25 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Planning DAG...</span>
                  </>
                ) : (
                  <>
                    <span>Execute Multi-Agent Workflow</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Demo Presets:
            </span>
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setPrompt(p.text);
                  handleSubmit(p.text);
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold shadow-xs transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Active Workflow Display */}
      {currentWorkflow && (
        <div className="space-y-6">
          {/* Status & Plan Banner */}
          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {currentWorkflow.id}
                  </span>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {currentWorkflow.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requested by <strong className="text-slate-700 dark:text-slate-300">{currentWorkflow.requester.name}</strong> ({currentWorkflow.requester.role})
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    currentWorkflow.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : currentWorkflow.status === 'waiting_approval'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                      : currentWorkflow.status === 'running'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {currentWorkflow.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {currentWorkflow.status === 'waiting_approval' && <ShieldAlert className="w-3.5 h-3.5" />}
                  {currentWorkflow.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {currentWorkflow.status.replace('_', ' ')}
                </span>

                {currentWorkflow.durationSeconds && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {currentWorkflow.durationSeconds}s
                  </span>
                )}
              </div>
            </div>

            {/* Execution Plan Steps */}
            <div className="pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Planner Agent Decomposition (Execution Plan)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {currentWorkflow.executionPlan.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="leading-tight">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* HUMAN IN THE LOOP APPROVAL CHECKPOINT CALLOUT */}
          {currentWorkflow.status === 'waiting_approval' && (
            <div className="glass-card rounded-3xl p-6 border-2 border-rose-400 dark:border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30">
                    <ShieldAlert className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-600 text-white">
                        Human-in-the-Loop Checkpoint
                      </span>
                      <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">
                        Zero-Self-Approval Enforced
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      Manager Approval Required: {currentWorkflow.tasks.find(t => t.requiresApproval)?.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      AI agents cannot authorize sensitive financial disbursement, salary records, or high-privilege access. An authorized human manager ({currentUser.name} - {currentUser.role}) must inspect and decide.
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-col gap-2 shrink-0">
                  <input
                    type="text"
                    value={approvalDecisionReason}
                    onChange={e => setApprovalDecisionReason(e.target.value)}
                    placeholder="Decision rationale / review note..."
                    className="w-full md:w-80 px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecision(true)}
                      disabled={approving}
                      className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Approve & Resume</span>
                    </button>
                    <button
                      onClick={() => handleDecision(false)}
                      disabled={approving}
                      className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-xs border border-slate-300 dark:border-slate-600 shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grid: DAG Task Pipeline + Real-time Agent Log Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Task DAG Pipeline (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-500" /> Multi-Agent Task Dependency Pipeline (DAG)
              </h3>

              <div className="space-y-3">
                {currentWorkflow.tasks.map((task, idx) => {
                  const badge = getAgentBadge(task.agent);
                  const Icon = badge.icon;
                  const isReadyOrDone = task.status === 'completed';
                  const isRunning = task.status === 'running';
                  const isWaitingApproval = task.status === 'waiting_approval';
                  const isFailed = task.status === 'failed';
                  const isRejected = task.status === 'rejected';

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 ${
                        isWaitingApproval
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 shadow-md ring-2 ring-rose-400/40'
                          : isRunning
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-md ring-2 ring-indigo-400/40'
                          : isReadyOrDone
                          ? 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                          : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${badge.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400 font-mono">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                tool: {task.tool}()
                              </span>
                              {task.requiresApproval && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  HITL Required
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isReadyOrDone && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                          )}
                          {isRunning && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Executing
                            </span>
                          )}
                          {isWaitingApproval && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-2.5 py-1 rounded-full border border-rose-300 dark:border-rose-800 animate-pulse">
                              <ShieldAlert className="w-3.5 h-3.5" /> Needs Approval
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2.5 py-1 rounded-full border border-red-200">
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                              Rejected
                            </span>
                          )}
                          {task.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-full">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tool Result Preview if completed */}
                      {task.result && (
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400">Result: </span>
                          {JSON.stringify(task.result).slice(0, 150)}
                          {JSON.stringify(task.result).length > 150 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-Time Agent Stream Logs (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-500" /> Autonomous Agent Event Stream
              </h3>

              <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 shadow-xl font-mono text-xs h-[480px] overflow-y-auto flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>// WorkForce AI StateGraph Stream</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> CONNECTED
                    </span>
                  </div>

                  {eventLogs.length === 0 ? (
                    <div className="py-20 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                      Listening for agent events and tool execution telemetry...
                    </div>
                  ) : (
                    eventLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed animate-in fade-in duration-200">
                        <span className="text-slate-500 mr-2">[{log.time}]</span>
                        <span
                          className={`font-semibold mr-2 ${
                            log.agent === 'planner'
                              ? 'text-indigo-400'
                              : log.agent === 'hr'
                              ? 'text-emerald-400'
                              : log.agent === 'it'
                              ? 'text-purple-400'
                              : log.agent === 'finance'
                              ? 'text-amber-400'
                              : log.agent === 'approval'
                              ? 'text-rose-400'
                              : 'text-pink-400'
                          }`}
                        >
                          @{log.agent}:
                        </span>
                        <span className="text-slate-200">{log.text}</span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>

                <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-800 flex items-center justify-between">
                  <span>State: {currentWorkflow.status}</span>
                  <span>Tasks: {currentWorkflow.tasks.filter(t => t.status === 'completed').length}/{currentWorkflow.tasks.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Completion Summary Card */}
          {currentWorkflow.status === 'completed' && (
            <div className="glass-card rounded-3xl p-6 border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-xl animate-in zoom-in-95">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Workflow Completed Successfully!
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {currentWorkflow.finalResult}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCurrentPage('employees')}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-sm transition-colors"
                  >
                    View in HR Directory
                  </button>
                  <button
                    onClick={() => setCurrentPage('it')}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-sm transition-colors"
                  >
                    View IT Provisioning
                  </button>
                  <button
                    onClick={() => setCurrentPage('audit')}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-colors"
                  >
                    Inspect Audit Logs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
