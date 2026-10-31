import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Laptop,
  Cpu,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  Shield,
  Layers,
  Sparkles,
  Server,
  KeyRound
} from 'lucide-react';
import { ITRequest } from '../types.js';

export function ItPage() {
  const { setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [itRequests, setItRequests] = useState<ITRequest[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/it/requests');
      if (res.ok) {
        const data = await res.json();
        setItRequests(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filtered = itRequests.filter(req => {
    if (filterType !== 'all' && req.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        req.employeeName.toLowerCase().includes(q) ||
        req.details.toLowerCase().includes(q) ||
        req.id.toLowerCase().includes(q)
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
            IT Systems & Equipment Provisioning
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated by IT Agent. Manages Apple M3 / ThinkPad hardware, Okta SSO, and developer software licenses.
          </p>
        </div>

        <button
          onClick={() => setCurrentPage('command-center')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Request via AI Command</span>
        </button>
      </div>

      {/* Hardware Inventory Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">MacBook Pro M3 Max Stock</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">18 In Stock</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">ThinkPad X1 Carbon Gen 12</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">12 In Stock</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Active Okta SSO Seats</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">100% Zero-Touch MDM</p>
          </div>
        </div>
      </div>

      {/* IT Requests Table */}
      <div className="glass-card rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            IT Provisioning Request Pipeline
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search IT requests..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Request ID</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Details & Hardware</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Assigned Engineer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {filtered.map(req => (
                <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {req.id}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {req.employeeName}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {req.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{req.hardwareItem || req.details}</p>
                    {req.softwarePackages && (
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-0.5 truncate font-medium">
                        {req.softwarePackages.join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'Provisioned'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : req.status === 'Approved'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-medium">
                    {req.assignedEngineer}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
