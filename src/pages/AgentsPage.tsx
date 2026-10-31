import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Bot,
  UserCheck,
  Cpu,
  ReceiptText,
  MailCheck,
  ShieldCheck,
  Wrench,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  Layers
} from 'lucide-react';
import { AgentInfo, AgentType, AuditLog } from '../types.js';

export function AgentsPage() {
  const { setCurrentPage } = useApp();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [agentLogs, setAgentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        setAgents(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  const openAgentModal = async (agent: AgentInfo) => {
    setSelectedAgent(agent);
    try {
      const res = await fetch(`/api/agents/${agent.id}`);
      if (res.ok) {
        const data = await res.json();
        setAgentLogs(data.executions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getAgentIcon = (id: AgentType) => {
    switch (id) {
      case 'planner': return Bot;
      case 'hr': return UserCheck;
      case 'it': return Cpu;
      case 'finance': return ReceiptText;
      case 'communication': return MailCheck;
      case 'approval': return ShieldCheck;
      default: return Bot;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            AI Agents Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time status, authorized tools, permissions, and execution telemetry for all 6 specialized agents.
          </p>
        </div>

        <button
          onClick={() => setCurrentPage('command-center')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Dispatch Command</span>
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => {
          const Icon = getAgentIcon(agent.id);
          return (
            <div
              key={agent.id}
              className="glass-card rounded-3xl p-6 shadow-md hover:shadow-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Agent Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${agent.color} flex items-center justify-center text-white shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      agent.status === 'running'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                        : agent.status === 'waiting_approval'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    ● {agent.status}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {agent.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {agent.role}
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2.5 leading-relaxed">
                  {agent.description}
                </p>

                {/* Responsibilities list */}
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Core Capabilities:
                  </p>
                  {agent.responsibilities.slice(0, 3).map((r, i) => (
                    <div key={i} className="text-xs text-slate-800 dark:text-slate-200 font-medium flex items-start gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">•</span>
                      <span className="leading-tight">{r}</span>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="mt-4 grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-xs">
                  <div>
                    <span className="text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold">Completed</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {agent.completedTasks} tasks
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold">Tools Authorized</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                      <Wrench className="w-3.5 h-3.5" /> {agent.tools.length} tools
                    </p>
                  </div>
                </div>
              </div>

              {/* View Details Action */}
              <button
                onClick={() => openAgentModal(agent)}
                className="mt-5 w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Inspect Tools & Telemetry</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-6">
            <button
              onClick={() => setSelectedAgent(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${selectedAgent.color} flex items-center justify-center text-white shadow-lg`}>
                {React.createElement(getAgentIcon(selectedAgent.id), { className: 'w-7 h-7' })}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedAgent.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedAgent.role}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">Last active: {selectedAgent.lastActive}</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-emerald-600 font-semibold">{selectedAgent.completedTasks} completed</span>
                </div>
              </div>
            </div>

            {/* Authorized Tools */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-indigo-500" /> Authorized Tool Catalogue (Role-Scoped)
              </h4>
              <div className="space-y-2.5">
                {selectedAgent.tools.map((tool, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        {tool.name}()
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          tool.riskLevel === 'high'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : tool.riskLevel === 'medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {tool.riskLevel} risk
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium mt-1">
                      {tool.description}
                    </p>
                    <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                      Params: {tool.parameters}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Audit Log Telemetry */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-500" /> Recent Agent Executions
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {agentLogs.length === 0 ? (
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">No execution records found.</p>
                ) : (
                  agentLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700/50 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{log.action}</span>
                        <span className="font-semibold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium mt-0.5">
                        {log.details}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
