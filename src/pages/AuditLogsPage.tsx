import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Eye,
  X,
  Lock
} from 'lucide-react';
import { AuditLog } from '../types.js';

export function AuditLogsPage() {
  const { setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [agentFilter, setAgentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `workforce-audit-log-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('success', 'Audit Log Exported', 'Downloaded complete immutable JSON records.');
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Actor', 'Agent', 'Action', 'Status', 'Details'];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      `"${l.actor}"`,
      l.agent || '',
      `"${l.action}"`,
      l.status,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `workforce-audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('success', 'Audit CSV Exported', 'Downloaded complete CSV spreadsheet.');
  };

  const filtered = logs.filter(l => {
    if (agentFilter !== 'all' && l.agent !== agentFilter) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Immutable Enterprise Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
              <Lock className="w-3 h-3" /> SOC-2 Ready
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete cryptographic audit trail of all agent decisions, DAG tasks, tool arguments, and human approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Agent Filter */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs shadow-xs">
            <span className="px-2 font-bold text-slate-700 dark:text-slate-300">Agent:</span>
            {['all', 'planner', 'hr', 'it', 'finance', 'communication', 'approval'].map(a => (
              <button
                key={a}
                onClick={() => setAgentFilter(a)}
                className={`px-2.5 py-1 rounded-xl uppercase font-bold text-[10px] transition-all ${
                  agentFilter === a
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs shadow-xs">
            <span className="px-2 font-bold text-slate-700 dark:text-slate-300">Status:</span>
            {['all', 'info', 'success', 'warning', 'error'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-xl uppercase font-bold text-[10px] transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Event ID</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor & Agent</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Details</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {log.id}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900 dark:text-white">{log.actor}</p>
                    {log.agent && (
                      <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 uppercase font-semibold">
                        @{log.agent}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {log.action}
                  </td>
                  <td className="py-3.5 px-4 max-w-sm truncate text-slate-600 dark:text-slate-400">
                    {log.details}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'success'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : log.status === 'warning'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : log.status === 'error'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
                      title="Inspect Metadata Payload"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-5">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {selectedLog.id}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {selectedLog.action}
              </h3>
              <p className="text-xs text-slate-500">
                Actor: {selectedLog.actor} • Time: {new Date(selectedLog.timestamp).toLocaleString()}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                {selectedLog.details}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Raw Event Metadata
              </h4>
              <pre className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.metadata || { recordedIp: selectedLog.ipAddress || '10.0.4.12' }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
