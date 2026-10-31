import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { useToast } from '../components/Toast.js';
import {
  Sparkles,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Building
} from 'lucide-react';

export function SignInPage() {
  const { setCurrentPage, switchRole } = useApp();
  const { addToast } = useToast();

  const [email, setEmail] = useState('sarah.jenkins@workforce.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        addToast('success', 'Welcome Back', 'Logged in as Administrator Sarah Jenkins.');
        setCurrentPage('command-center');
      }
    } catch (err: any) {
      addToast('error', 'Login Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (role: 'Administrator' | 'Finance Director' | 'HR Lead') => {
    switchRole(role);
    addToast('info', 'Demo Session Active', `Switched into ${role} role.`);
    setCurrentPage('command-center');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white mx-auto shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4">
            Sign In to WorkForce AI
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Access autonomous enterprise agent pipelines
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800 dark:text-slate-200">
                Password
              </label>
              <button
                type="button"
                onClick={() => addToast('info', 'Password Reset', 'Demo environment password reset requested.')}
                className="text-[11px] text-indigo-700 dark:text-indigo-400 font-bold hover:underline"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>Sign In to Platform</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Quick Demo Access Pills */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center mb-2.5">
            Instant Demo Profiles:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('Administrator')}
              className="py-1.5 px-2 rounded-xl bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-900 dark:text-slate-100 shadow-xs transition-colors"
            >
              Sarah (Admin)
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('Finance Director')}
              className="py-1.5 px-2 rounded-xl bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-900 dark:text-slate-100 shadow-xs transition-colors"
            >
              Amit (Finance)
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-700 dark:text-slate-300 font-medium">
          <span>Don't have an enterprise workspace? </span>
          <button
            onClick={() => setCurrentPage('signup')}
            className="text-indigo-700 dark:text-indigo-400 font-bold hover:underline"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}

export function SignUpPage() {
  const { setCurrentPage } = useApp();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, department })
      });

      if (res.ok) {
        addToast('success', 'Account Registered', `Welcome to WorkForce AI, ${name}!`);
        setCurrentPage('command-center');
      }
    } catch (err: any) {
      addToast('error', 'Registration Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full glass-card rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white mx-auto shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4">
            Create Enterprise Account
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Empower your team with autonomous AI agent workflows
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Elena Rostova"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="elena@company.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
              Department
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Engineering">Engineering</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Product Design">Product Design</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
              Set Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>Create Account & Launch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          <span>Already registered? </span>
          <button
            onClick={() => setCurrentPage('signin')}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
