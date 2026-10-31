import React, { useState } from 'react';
import { useApp, PageView } from '../context/AppContext.js';
import {
  Sparkles,
  Search,
  Sun,
  Moon,
  Bell,
  Menu,
  X,
  Shield,
  CheckCircle2,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';
import { UserRole } from '../types.js';

export function Navbar() {
  const {
    currentPage,
    setCurrentPage,
    isDark,
    toggleTheme,
    currentUser,
    switchRole,
    pendingApprovalCount,
    setGlobalSearchOpen
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const roles: UserRole['role'][] = [
    'Administrator',
    'Manager',
    'HR Lead',
    'IT Admin',
    'Finance Director',
    'Standard Employee'
  ];

  const isLanding = currentPage === 'landing';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(isLanding ? 'landing' : 'dashboard')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
                  WorkForce<span className="text-indigo-600 dark:text-indigo-400 font-black ml-1">AI</span>
                </span>
                <span className="hidden 2xl:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  Autonomous Multi-Agent
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation for Landing */}
          {isLanding && (
            <nav className="hidden 2xl:flex items-center gap-6 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <a href="#how-it-works" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">How It Works</a>
              <a href="#agents" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">6 AI Agents</a>
              <a href="#security" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Security & HITL</a>
            </nav>
          )}
          <div className="flex items-center gap-1 lg:gap-3">
            {/* Quick Search Shortcut */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:text-slate-900 font-medium text-xs shadow-sm transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono text-slate-800 dark:text-slate-200 font-semibold">⌘K</kbd>
            </button>

            {/* Role Switcher (Visible when inside App) */}
            {!isLanding && (
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden md:inline text-slate-600 dark:text-slate-400 font-medium">Role:</span>
                  <span className="hidden xl:inline font-bold text-indigo-700 dark:text-indigo-300">{currentUser.role}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 glass-card rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Switch Role (RBAC Simulation)
                    </div>
                    {roles.map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          switchRole(r);
                          setRoleDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                          currentUser.role === r
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>{r}</span>
                        {currentUser.role === r && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Approval Notification Bell */}
            <button
              onClick={() => setCurrentPage('approvals')}
              className="relative p-2 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Approval Center"
            >
              <Bell className="w-4 h-4" />
              {pendingApprovalCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              )}
              {pendingApprovalCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
              )}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* CTA Button */}
            {isLanding ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage('signin')}
                  className="hidden sm:inline-flex px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setCurrentPage('command-center')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 transition-all flex items-center gap-2 group"
                >
                  <span>Launch Platform</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentPage('landing')}
                className="hidden lg:inline-flex px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
              >
                Website
              </button>
            )}

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className={`${isLanding ? '2xl:hidden' : 'lg:hidden'} p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className={`${isLanding ? '2xl:hidden' : 'lg:hidden'} glass-card border-b border-slate-200 dark:border-slate-800 px-4 pt-2 pb-6 space-y-3 bg-white/95 dark:bg-slate-900/95 animate-in slide-in-from-top-4`}>
          {isLanding ? (
            <div className="flex flex-col gap-2 pt-2">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                How It Works
              </a>
              <a
                href="#agents"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                6 AI Agents
              </a>
              <a
                href="#demo-workflows"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                Workflows
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                Security & HITL
              </a>
              <button
                onClick={() => {
                  setCurrentPage('command-center');
                  setMobileMenuOpen(false);
                }}
                className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-md"
              >
                Launch Platform
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 pt-2">
              <button
                onClick={() => {
                  setCurrentPage('dashboard');
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Dashboard Overview
              </button>
              <button
                onClick={() => {
                  setCurrentPage('command-center');
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 rounded-lg text-sm text-left font-medium text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                AI Command Center
              </button>
              <button
                onClick={() => {
                  setCurrentPage('approvals');
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-2 rounded-lg text-sm text-left font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
              >
                <span>Approvals</span>
                {pendingApprovalCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-semibold">
                    {pendingApprovalCount} pending
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
