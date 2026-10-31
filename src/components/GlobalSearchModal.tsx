import React, { useState, useEffect } from 'react';
import { useApp, PageView } from '../context/AppContext.js';
import { Search, Sparkles, Workflow, Users, CheckSquare, Laptop, FileText, ArrowRight, X } from 'lucide-react';

export function GlobalSearchModal() {
  const { globalSearchOpen, setGlobalSearchOpen, setCurrentPage, setSelectedWorkflowId } = useApp();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!globalSearchOpen) setQuery('');
  }, [globalSearchOpen]);

  if (!globalSearchOpen) return null;

  const quickActions = [
    { title: 'Onboard Rahul Kumar in Engineering', type: 'command', page: 'command-center' as PageView, icon: Sparkles, hint: 'Run Onboarding Workflow' },
    { title: 'Process invoice INV-1025 for ₹50,000', type: 'command', page: 'command-center' as PageView, icon: Sparkles, hint: 'Run Invoice Processing' },
    { title: 'Pending Human Approvals Center', type: 'approval', page: 'approvals' as PageView, icon: CheckSquare, hint: 'View 1 Pending' },
    { title: 'Employee Directory & Onboarding', type: 'employee', page: 'employees' as PageView, icon: Users, hint: 'HR Management' },
    { title: 'IT Hardware & Account Provisioning', type: 'it', page: 'it' as PageView, icon: Laptop, hint: 'MacBooks & SSO' },
    { title: 'Invoices & Duplicate Detection', type: 'finance', page: 'finance' as PageView, icon: FileText, hint: 'Finance Center' },
    { title: 'Immutable Audit Trail', type: 'audit', page: 'audit' as PageView, icon: Workflow, hint: 'SOC-2 Records' }
  ];

  const filtered = query.trim()
    ? quickActions.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.hint.toLowerCase().includes(query.toLowerCase()))
    : quickActions;

  const handleSelect = (item: typeof quickActions[0]) => {
    setCurrentPage(item.page);
    setGlobalSearchOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl glass-card rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands, agents, workflows, employees, invoices... (Press ESC to exit)"
            className="w-full bg-transparent text-sm focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium"
            autoFocus
          />
          <button
            onClick={() => setGlobalSearchOpen(false)}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
          <div className="py-1">
            <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {query ? 'Search Results' : 'Recommended Enterprise Actions'}
            </p>
            {filtered.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800/70 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{item.hint}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
          <span>Navigate with <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100">↓</kbd></span>
          <span>Open with <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100">⌘K</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100">Ctrl+K</kbd></span>
        </div>
      </div>
    </div>
  );
}
