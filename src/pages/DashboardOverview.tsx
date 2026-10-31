import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Workflow,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertOctagon,
  Bot,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Users,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Workflow as WorkflowType, AuditLog, ApprovalRequest } from '../types.js';

export function DashboardOverview() {
  const { setCurrentPage, setSelectedWorkflowId, pendingApprovalCount } = useApp();
  const [metrics, setMetrics] = useState({
    totalWorkflows: 0,
    completedWorkflows: 0,
    activeWorkflows: 0,
    pendingApprovals: 0,
    failedTasks: 0,
    activeAgents: 6,
    completionRate: 100,
    avgDurationSec: 4.2
  });
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, workflowsRes, approvalsRes, auditRes] = await Promise.all([
        fetch('/api/analytics/overview'),
        fetch('/api/workflows'),
        fetch('/api/approvals/pending'),
        fetch('/api/audit-logs')
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setMetrics(data.metrics);
      }
      if (workflowsRes.ok) {
        const wfList = await workflowsRes.json();
        setWorkflows(wfList);
      }
      if (approvalsRes.ok) {
        const appList = await approvalsRes.json();
        setPendingApprovals(appList);
      }
      if (auditRes.ok) {
        const logs = await auditRes.json();
        setAuditLogs(logs.slice(0, 6));
      }
    } catch (e) {
      console.error('Failed to load overview data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Enterprise Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time status of autonomous AI agents, multi-agent workflows, and human approval checkpoints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCurrentPage('command-center')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 group"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch AI Command</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Workflows</span>
            <Workflow className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {metrics.totalWorkflows}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> 100% DAG parsed
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Active Runs</span>
            <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {metrics.activeWorkflows}
          </p>
          <span className="text-[11px] text-slate-500 mt-1">Coordinating</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.completedWorkflows}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1">
            {metrics.completionRate}% Success
          </span>
        </div>

        <div
          onClick={() => setCurrentPage('approvals')}
          className="glass-card rounded-2xl p-4 border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs font-semibold">
            <span>Approvals</span>
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {pendingApprovals.length}
          </p>
          <span className="text-[11px] text-rose-600 dark:text-rose-300 font-bold mt-1">
            Human Required
          </span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Active Agents</span>
            <Bot className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
            6 / 6
          </p>
          <span className="text-[11px] text-purple-600 font-semibold mt-1">Autonomous</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Avg Speed</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {metrics.avgDurationSec}s
          </p>
          <span className="text-[11px] text-slate-500 mt-1">Per Workflow</span>
        </div>
      </div>

      {/* Pending Approvals Alert Banner (if any) */}
      {pendingApprovals.length > 0 && (
        <div className="glass-card rounded-3xl p-5 border-2 border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {pendingApprovals.length} Pending Human-in-the-Loop Approval Action
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Latest: "{pendingApprovals[0].title}" — Operations are paused until an authorized manager approves.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage('approvals')}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md transition-colors shrink-0"
          >
            Review in Approval Center
          </button>
        </div>
      )}

      {/* Two Column Section: Recent Workflows & Live Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Workflows (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Workflow className="w-4 h-4 text-indigo-500" /> Recent Autonomous Workflows
            </h3>
            <button
              onClick={() => setCurrentPage('workflows')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {workflows.slice(0, 4).map(wf => (
              <div
                key={wf.id}
                onClick={() => {
                  setSelectedWorkflowId(wf.id);
                  setCurrentPage('workflows');
                }}
                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {wf.id}
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {wf.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {wf.originalRequest}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {wf.assignedAgents.map(a => (
                        <span
                          key={a}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        wf.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : wf.status === 'waiting_approval'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {wf.status.replace('_', ' ')}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
                      {wf.durationSeconds ? `${wf.durationSeconds}s` : 'active'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Activity Feed (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" /> Live Audit Trail
            </h3>
            <button
              onClick={() => setCurrentPage('audit')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>Full Audit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {auditLogs.map(log => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {log.actor}
                  </span>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {log.action}
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">
                  {log.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
