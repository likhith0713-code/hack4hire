import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Settings,
  Shield,
  User,
  Moon,
  Sun,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Lock,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { UserRole } from '../types.js';

export function SettingsPage() {
  const { currentUser, switchRole, isDark, toggleTheme, setCurrentPage } = useApp();
  const { addToast } = useToast();
  const [resetting, setResetting] = useState(false);

  const roles: { role: UserRole['role']; desc: string }[] = [
    { role: 'Administrator', desc: 'Unrestricted enterprise access. Can manage settings, approve any checkpoint, and trigger workflows.' },
    { role: 'Manager', desc: 'Departmental manager. Can review approvals for compensation, hires, and purchase orders.' },
    { role: 'HR Lead', desc: 'Can manage employee records, review onboarding stages, and approve HR packages.' },
    { role: 'IT Admin', desc: 'Can provision accounts, assign hardware assets, and approve elevated system privileges.' },
    { role: 'Finance Director', desc: 'Can approve high-value invoices, authorize ACH disbursements, and review budgets.' },
    { role: 'Standard Employee', desc: 'Read-only view of own directory profile, communications, and public workflows.' }
  ];

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all demo data back to clean seed state? This resets employees, invoices, approvals, and logs.')) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch('/api/system/reset-demo', { method: 'POST' });
      if (res.ok) {
        addToast('success', 'Database Reset', 'Enterprise demo database restored to initial state.');
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch (e: any) {
      addToast('error', 'Reset Failed', e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Settings & Role-Based Access Control
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your active profile, test RBAC role permissions, and control platform preferences.
        </p>
      </div>

      {/* Profile Card */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-500" /> Active Profile & Credentials
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {currentUser.name}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{currentUser.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Current Role: {currentUser.role}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            <span>Department: </span>
            <strong className="text-slate-900 dark:text-slate-100 font-bold">{currentUser.department}</strong>
          </div>
        </div>
      </div>

      {/* RBAC Role Switcher */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl space-y-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" /> Role-Based Access Control (RBAC) Switcher
          </h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
            Switch your active role to test permission gates, authorization checks in the Approval Center, and tool scopes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {roles.map(r => (
            <div
              key={r.role}
              onClick={() => switchRole(r.role)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                currentUser.role === r.role
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-md ring-2 ring-indigo-400/30'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {r.role}
                  </span>
                  {currentUser.role === r.role && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-600 text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium mt-2 leading-relaxed">
                  {r.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Engine & System Preferences */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" /> Platform & Theme Configuration
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Color Theme</p>
              <p className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">Toggle between modern light SaaS theme and dark mode</p>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs flex items-center gap-2 font-bold"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span>{isDark ? 'Dark Theme' : 'Light Theme'}</span>
            </button>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">AI Multi-Agent Model</p>
              <p className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">Server-side Planner Agent powered by Google Gemini 3.8 Flash</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              gemini-3.8-flash
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Reset Demo Database</p>
              <p className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">Restores seed employees, invoices, approvals, and workflows</p>
            </div>
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-red-50 text-slate-900 hover:text-red-700 dark:bg-slate-800 dark:hover:bg-red-950 dark:hover:text-red-300 border border-slate-300 dark:border-slate-700 font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span>{resetting ? 'Resetting...' : 'Reset Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
