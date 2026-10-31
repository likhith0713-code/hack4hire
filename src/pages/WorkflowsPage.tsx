import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Workflow,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  Play,
  RotateCcw,
  Ban,
  Eye,
  X,
  FileCheck2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Workflow as WorkflowType } from '../types.js';

export function WorkflowsPage() {
  const { setSelectedWorkflowId, setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [selectedWf, setSelectedWf] = useState<WorkflowType | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        addToast('warning', 'Workflow Cancelled', `Workflow ${id} has been halted.`);
        fetchWorkflows();
      }
    } catch (e: any) {
      addToast('error', 'Cancellation Error', e.message);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        addToast('info', 'Workflow Retried', `Resuming failed tasks in workflow ${id}...`);
        fetchWorkflows();
      }
    } catch (e: any) {
      addToast('error', 'Retry Error', e.message);
    }
  };

  const filtered = workflows.filter(w => {
    if (filterStatus !== 'all' && w.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        w.title.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        w.originalRequest.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Workflow Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track multi-agent orchestration lifecycles, inspect DAG executions, and manage recovery retries.
          </p>
        </div>

        <button
          onClick={() => setCurrentPage('command-center')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Launch New Workflow</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 w-full sm:w-auto shadow-xs">
          {['all', 'completed', 'running', 'waiting_approval', 'failed', 'cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                filterStatus === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workflows, prompt, ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs"
          />
        </div>
      </div>

      {/* Workflows Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Workflow ID & Title</th>
                <th className="py-3.5 px-4">Requester</th>
                <th className="py-3.5 px-4">Agents Assigned</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Created</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filtered.map(wf => (
                <tr key={wf.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {wf.id}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                      {wf.title}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold">{wf.requester.name}</span>
                    <p className="text-[11px] text-slate-400">{wf.requester.role}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {wf.assignedAgents.map(ag => (
                        <span
                          key={ag}
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {ag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        wf.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : wf.status === 'waiting_approval'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                          : wf.status === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : wf.status === 'cancelled'
                          ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {wf.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {wf.durationSeconds ? `${wf.durationSeconds}s` : 'Active'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(wf.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedWf(wf)}
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
                        title="Inspect Workflow Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {wf.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(wf.id)}
                          className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors shadow-xs font-bold"
                          title="Retry Failed Tasks"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(wf.status === 'running' || wf.status === 'waiting_approval') && (
                        <button
                          onClick={() => handleCancel(wf.id)}
                          className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 border border-red-300 transition-colors shadow-xs font-bold"
                          title="Cancel Workflow"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Detail Modal */}
      {selectedWf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-6">
            <button
              onClick={() => setSelectedWf(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {selectedWf.id}
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedWf.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Original Request: "{selectedWf.originalRequest}"
              </p>
            </div>

            {/* Tasks list */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                DAG Tasks Execution Details
              </h4>
              <div className="space-y-2.5">
                {selectedWf.tasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400">#{idx + 1}</span>
                        <strong className="text-slate-800 dark:text-slate-200">{task.title}</strong>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                          {task.agent} agent
                        </span>
                      </div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {task.status}
                      </span>
                    </div>

                    {task.result && (
                      <pre className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-900 text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
                        {JSON.stringify(task.result, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Shared Context */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Shared Workflow State Context
              </h4>
              <pre className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedWf.sharedContext, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
