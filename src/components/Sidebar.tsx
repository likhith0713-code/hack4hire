import React from 'react';
import { useApp, PageView } from '../context/AppContext.js';
import {
  LayoutDashboard,
  Sparkles,
  Workflow,
  Bot,
  ShieldAlert,
  Users,
  Laptop,
  Receipt,
  Mail,
  FileSpreadsheet,
  BarChart3,
  Settings,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export function Sidebar() {
  const { currentPage, setCurrentPage, pendingApprovalCount } = useApp();

  const navItems: { id: PageView; label: string; icon: React.ElementType; badge?: string | number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'command-center', label: 'AI Command Center', icon: Sparkles, badge: 'Live AI', badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold' },
    { id: 'workflows', label: 'Workflows', icon: Workflow },
    { id: 'agents', label: 'AI Agents Hub', icon: Bot, badge: '6 Active', badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
    { id: 'approvals', label: 'Approval Center', icon: ShieldAlert, badge: pendingApprovalCount > 0 ? `${pendingApprovalCount} Pending` : undefined, badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-bold' },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'it', label: 'IT Requests', icon: Laptop },
    { id: 'finance', label: 'Finance & Invoices', icon: Receipt },
    { id: 'communications', label: 'Communications', icon: Mail },
    { id: 'audit', label: 'Audit Logs', icon: FileSpreadsheet },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings & RBAC', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:block border-r border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-[calc(100vh-4rem)] sticky top-16 p-4 flex flex-col justify-between">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Enterprise Operations
          </p>
          <nav className="space-y-1">
            {navItems.slice(0, 5).map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Domain Systems
          </p>
          <nav className="space-y-1">
            {navItems.slice(5).map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Autonomous Multi-Agent Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/50 dark:border-indigo-800/40">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Orchestration Status</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
          6 specialized AI agents running state graph with Human-in-the-Loop checkpoints.
        </p>
        <button
          onClick={() => setCurrentPage('command-center')}
          className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm"
        >
          <span>Run New Command</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
}
