import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Check,
  X,
  FileText,
  DollarSign,
  Laptop,
  Users,
  Search,
  Filter
} from 'lucide-react';
import { ApprovalRequest, RiskLevel } from '../types.js';

export function ApprovalsPage() {
  const { currentUser, refreshPendingCount, setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/approvals');
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleDecide = async (approvalId: string, approved: boolean) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: approved ? 'approved' : 'rejected',
          reason: decisionReason.trim() || (approved ? `Approved by ${currentUser.name}` : `Rejected by ${currentUser.name}`)
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Decision failed');
      }

      addToast(
        approved ? 'success' : 'warning',
        approved ? 'Action Approved' : 'Action Rejected',
        approved
          ? `Decision recorded for ${approvalId}. Workflow resumed.`
          : `Decision recorded for ${approvalId}. The protected action was not resumed.`
      );

      setSelectedApproval(null);
      setDecisionReason('');
      await fetchApprovals();
      await refreshPendingCount();
    } catch (err: any) {
      addToast('error', 'Decision Error', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filtered = approvals.filter(item => {
    if (activeTab !== 'all' && item.status !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.requestedAction.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.requester.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'critical':
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Human-in-the-Loop Approval Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Zero-Self-Approval
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review sensitive autonomous actions (financial payments, employee compensation, privileged IT access).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Reviewing as:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            {currentUser.name} ({currentUser.role})
          </span>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 w-full sm:w-auto shadow-xs">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab} {tab === 'pending' && approvals.filter(a => a.status === 'pending').length > 0 && `(${approvals.filter(a => a.status === 'pending').length})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search approvals..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs"
          />
        </div>
      </div>

      {/* Approvals Cards List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-3xl border border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              No Approvals in "{activeTab}" Category
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All autonomous agent workflows are clear or awaiting new sensitive trigger events.
            </p>
          </div>
        ) : (
          filtered.map(item => {
            const isPending = item.status === 'pending';
            const isApproved = item.status === 'approved';
            const isRejected = item.status === 'rejected';

            return (
              <div
                key={item.id}
                className={`glass-card rounded-3xl p-6 border transition-all duration-200 ${
                  isPending
                    ? 'border-rose-200 dark:border-rose-900/60 bg-white/95 dark:bg-slate-900/95 shadow-md hover:shadow-lg'
                    : 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 opacity-95'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {item.id}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRiskBadge(item.riskLevel)}`}>
                        {item.riskLevel} Risk
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : isRejected
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Workflow: {item.workflowId}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                      {item.requestedAction}
                    </p>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 dark:text-slate-100 font-bold">Checkpoint Reason:</strong>
                        <span>{item.reason}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                        <span>Requested by: {item.requester}</span>
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Decision Record if approved/rejected */}
                    {!isPending && item.decidedBy && (
                      <div className="pt-2 text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
                        {isApproved ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-500" />}
                        <span>
                          Decided by <strong className="text-slate-900 dark:text-slate-100 font-bold">{item.decidedBy}</strong> on {item.decidedAt ? new Date(item.decidedAt).toLocaleString() : ''}: "{item.decisionReason}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions (if pending) */}
                  {isPending && (
                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedApproval(item)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Authorize Action</span>
                      </button>
                      <button
                        onClick={() => setSelectedApproval(item)}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decision Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative space-y-5">
            <button
              onClick={() => setSelectedApproval(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Human Approval Checkpoint
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedApproval.id} • Risk Level: {selectedApproval.riskLevel.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedApproval.title}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {selectedApproval.reason}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Reviewer Decision Note (Mandatory for Audit Trail):
              </label>
              <textarea
                value={decisionReason}
                onChange={e => setDecisionReason(e.target.value)}
                placeholder="Explain the reason for approval or rejection..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleDecide(selectedApproval.id, true)}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Approve</span>
              </button>
              <button
                onClick={() => handleDecide(selectedApproval.id, false)}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Reject & Abort</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
