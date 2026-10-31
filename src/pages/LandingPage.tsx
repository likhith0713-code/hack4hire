import React from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Bot,
  UserCheck,
  Cpu,
  ReceiptText,
  MailCheck,
  CheckCircle2,
  Workflow,
  Zap,
  Lock,
  ChevronRight,
  Play,
  Layers,
  Clock,
  CheckSquare
} from 'lucide-react';

export function LandingPage() {
  const { setCurrentPage } = useApp();

  const agents = [
    {
      id: 'planner',
      name: 'Planner Agent',
      role: 'Coordinator & Task Decomposer',
      desc: 'Parses natural language requests into structured execution DAGs, assigns domain agents, and monitors shared state.',
      icon: Bot,
      color: 'from-blue-600 to-indigo-600',
      badge: 'Core Engine'
    },
    {
      id: 'hr',
      name: 'HR Agent',
      role: 'Employee & Onboarding Manager',
      desc: 'Validates compliance, creates employee records, manages onboarding workflows, and provisions organizational placement.',
      icon: UserCheck,
      color: 'from-emerald-500 to-teal-700',
      badge: 'People Ops'
    },
    {
      id: 'it',
      name: 'IT Agent',
      role: 'Hardware & Identity Provisioning',
      desc: 'Automates Okta SSO credentials, reserves Apple M3 / ThinkPad hardware, and allocates developer SaaS licenses.',
      icon: Cpu,
      color: 'from-violet-600 to-purple-700',
      badge: 'IT & Cloud'
    },
    {
      id: 'finance',
      name: 'Finance Agent',
      role: 'Invoices, OCR & Disbursement',
      desc: 'Extracts invoice metadata, audits for duplicates, calculates departmental budget impact, and simulates instant ACH payments.',
      icon: ReceiptText,
      color: 'from-amber-500 to-orange-600',
      badge: 'Financial Ops'
    },
    {
      id: 'communication',
      name: 'Communication Agent',
      role: 'Enterprise Notifications & Email',
      desc: 'Drafts personalized welcome itineraries, notifies managers of approvals, and sends multi-channel Slack/email updates.',
      icon: MailCheck,
      color: 'from-pink-500 to-rose-600',
      badge: 'Engagement'
    },
    {
      id: 'approval',
      name: 'Approval Agent',
      role: 'Human-in-the-Loop Gatekeeper',
      desc: 'Pauses workflow execution on sensitive actions, enforces the Zero-Self-Approval policy, and records manager sign-offs.',
      icon: ShieldCheck,
      color: 'from-red-500 to-rose-700',
      badge: 'Security & HITL'
    }
  ];

  const steps = [
    {
      num: '01',
      title: 'Submit Natural-Language Request',
      desc: 'A manager simply types: "Onboard Rahul Kumar in Engineering with joining date Nov 10, 2026" or "Process invoice INV-1025 for ₹50,000".'
    },
    {
      num: '02',
      title: 'Planner Decomposes Dynamic DAG',
      desc: 'Powered by Gemini 3.8 Flash, the Planner Agent breaks the goal into sequential and parallel tasks with clear domain agent assignments.'
    },
    {
      num: '03',
      title: 'Domain Agents Execute Authorized Tools',
      desc: 'HR, IT, Finance, and Communication agents call authorized enterprise tools with idempotency keys and shared workflow context.'
    },
    {
      num: '04',
      title: 'Human-in-the-Loop Approval Checkpoint',
      desc: 'Sensitive financial operations and high-privilege access pause automatically for review by authenticated managers.'
    }
  ];

  const faqs = [
    {
      q: 'How does WorkForce AI differ from a standard chatbot?',
      a: 'WorkForce AI is a multi-agent orchestration system, not a single conversational model. The Planner Agent generates a directed acyclic graph (DAG) of tasks that are autonomously dispatched to 5 specialized domain agents (HR, IT, Finance, Communication, Approval) with real tool calls and shared context.'
    },
    {
      q: 'What is the Zero-Self-Approval security rule?',
      a: 'Under enterprise compliance rules, AI agents are never permitted to approve their own high-impact actions (such as disbursements over $10,000, salary modifications, or employee termination). The Approval Agent pauses the workflow at a secure checkpoint until an authenticated human manager reviews and signs off.'
    },
    {
      q: 'How does agent failure recovery work?',
      a: 'If an external tool or data validation fails, our state graph retains all completed steps, logs detailed telemetry, attempts automated retries with backoff, and provides a one-click human retry interface without duplicating already executed operations.'
    },
    {
      q: 'Can WorkForce AI run with and without an external LLM API key?',
      a: 'Yes. WorkForce AI is integrated with Google Gemini 3.8 Flash for dynamic reasoning and semantic DAG planning. When an API key is not present or rate limits occur, the platform automatically utilizes its built-in enterprise deterministic rule engine with full tool execution and live simulation.'
    }
  ];

  return (
    <div className="space-y-24 pb-16 bg-mesh-gradient">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        {/* Decorative Floating Badges */}
        <div className="hidden lg:flex items-center gap-2 absolute top-12 left-8 p-3 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-md animate-bounce duration-1000">
          <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div className="text-left">
            <p className="text-[11px] text-slate-900 font-semibold">Planner Agent</p>
            <p className="text-[9px] text-slate-700 font-medium">Generating DAG plan...</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 absolute top-20 right-8 p-3 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-md animate-pulse">
          <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <div className="text-left">
            <p className="text-[11px] text-slate-900 font-semibold">Approval Agent</p>
            <p className="text-[9px] text-slate-700 font-medium">Human checkpoint ready</p>
          </div>
        </div>

        {/* Hero Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-semibold mb-6 shadow-sm">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Next-Generation Autonomous Enterprise Operations</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-5xl mx-auto leading-[1.12]">
          Automate Enterprise Operations with{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
            Intelligent AI Agents
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-700 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
          Meet your autonomous AI workforce. Plan, coordinate, and execute enterprise workflows with 6 specialized AI agents working together in a shared StateGraph with Human-in-the-Loop checkpoints.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setCurrentPage('command-center')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-base shadow-xl shadow-indigo-500/25 transition-all flex items-center justify-center gap-3 group"
          >
            <span>Launch AI Command Center</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => setCurrentPage('agents')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/95 hover:bg-white text-slate-900 font-semibold text-base border border-slate-300 shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Bot className="w-5 h-5 text-slate-900" />
            <span>Explore 6 AI Agents</span>
          </button>
        </div>

        {/* Hero Interactive Preview Card */}
        <div className="mt-14 max-w-5xl mx-auto rounded-3xl glass-card p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl text-left relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Live Multi-Agent Orchestration Preview
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Command: <span className="font-semibold text-slate-900 dark:text-white">"Onboard Rahul Kumar in Engineering with joining date Nov 10, 2026"</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setCurrentPage('command-center')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Run Live in Command Center
            </button>
          </div>

          {/* Interactive DAG nodes preview */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-800/80">
              <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 font-bold mb-1">
                <span>1. HR Agent</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Create EMP Record</p>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 font-medium">Validated Rahul Kumar & assigned EMP-1005</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50/90 dark:bg-slate-800/80 border border-purple-200 dark:border-purple-800/80">
              <div className="flex items-center justify-between text-xs text-purple-900 dark:text-purple-200 font-bold mb-1">
                <span>2. IT Agent</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Hardware & SSO</p>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 font-medium">Allocated MacBook Pro M3 & Okta profile</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 ring-1 ring-rose-400/40">
              <div className="flex items-center justify-between text-xs text-rose-900 dark:text-rose-200 font-bold mb-1">
                <span>3. Approval Agent</span>
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Manager Sign-Off</p>
              <p className="text-[11px] text-rose-800 dark:text-rose-300 font-semibold mt-1">Pending Human Review</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-pink-50/90 dark:bg-slate-800/80 border border-pink-200 dark:border-pink-800/80">
              <div className="flex items-center justify-between text-xs text-pink-900 dark:text-pink-200 font-bold mb-1">
                <span>4. Comm Agent</span>
                <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Welcome Email</p>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 font-medium">Waiting on approval clearance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Meet Your 6 AI Agents Section */}
      <section id="agents" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Autonomous Ecosystem
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
            Meet Your 6 Specialized AI Agents
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-3">
            Unlike simple single-prompt assistants, WorkForce AI orchestrates distinct domain agents with specialized roles, authorized tool permissions, and cooperative state graphs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(ag => {
            const Icon = ag.icon;
            return (
              <div
                key={ag.id}
                className="glass-card rounded-3xl p-6 shadow-md hover:shadow-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${ag.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {ag.badge}
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {ag.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {ag.role}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                  {ag.desc}
                </p>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Agent
                  </span>
                  <button
                    onClick={() => setCurrentPage('agents')}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>View Tools</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl glass-card p-8 sm:p-12 shadow-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Orchestration Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
              How Autonomous Collaboration Works
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              A 4-step state graph that replaces slow manual back-office tasks with transparent, audit-ready AI collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((st, i) => (
              <div key={i} className="relative p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-3xl font-black text-indigo-600/30 dark:text-indigo-400/20 font-mono">
                  {st.num}
                </span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-2">
                  {st.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two Demonstration Workflows Showcase */}
      <section id="demo-workflows" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Turnkey Scenarios
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
            Ready-to-Run Demonstration Workflows
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Experience end-to-end multi-agent execution with sample synthetic data in two clicks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Demo 1: Employee Onboarding */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Workflow Demo #1
                </span>
                <span className="text-xs text-slate-500 font-mono">HR + IT + Comm + Approval</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                New Employee Onboarding Pipeline
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2 leading-relaxed">
                Demonstrates candidate profile validation, HR database record creation, Okta SSO & GitHub credential generation, MacBook Pro M3 allocation, and welcome email generation.
              </p>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-xs font-semibold text-indigo-800 dark:text-indigo-300 border border-slate-300 dark:border-slate-700">
                "Onboard a new employee named Rahul Kumar in Engineering with joining date Nov 10, 2026."
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Validates employee name and department placement</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Provisions 4 enterprise cloud and identity accounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Human Manager approval for compensation and package</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCurrentPage('command-center')}
              className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <span>Execute Onboarding Workflow</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Demo 2: Invoice Processing */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  Workflow Demo #2
                </span>
                <span className="text-xs text-slate-500 font-mono">Finance + Comm + Approval</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Invoice Extraction & Duplicate Audit
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2 leading-relaxed">
                Demonstrates supplier invoice OCR extraction, cross-referencing against historic accounts payable to detect duplicate invoices, manager approval gate, and ACH payment simulation.
              </p>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-xs font-semibold text-amber-800 dark:text-amber-300 border border-slate-300 dark:border-slate-700">
                "Process invoice INV-1025 from ABC Technologies for ₹50,000."
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>98.5% OCR confidence parsing line items</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Duplicate invoice detection against historic supplier records</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>ACH payment disbursement simulator with transaction ref</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCurrentPage('command-center')}
              className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <span>Execute Invoice Workflow</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Security & Human in the Loop */}
      <section id="security" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Zero-Trust AI Guardrails
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-3">
              Strict Human-in-the-Loop Security
            </h2>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Autonomous execution never means unchecked execution. WorkForce AI enforces zero-self-approval: agents are cryptographically forbidden from approving sensitive financial transfers, salary adjustments, or system administrative privileges.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <Lock className="w-5 h-5 text-indigo-400 mb-2" />
                <h4 className="font-bold text-sm">State Checkpoints</h4>
                <p className="text-xs text-slate-400 mt-1">Workflows pause securely with persisted state until an authenticated manager decides.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <CheckSquare className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="font-bold text-sm">Role-Based Access Control</h4>
                <p className="text-xs text-slate-400 mt-1">Authorization checks enforced server-side for Administrators, Managers, and Leads.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-left"
            >
              <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {faq.q}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              W
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200">WorkForce AI</span>
            <span>— Autonomous Multi-Agent Operations Platform</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => setCurrentPage('command-center')} className="hover:text-indigo-600">Command Center</button>
            <button onClick={() => setCurrentPage('agents')} className="hover:text-indigo-600">6 Agents</button>
            <button onClick={() => setCurrentPage('approvals')} className="hover:text-indigo-600">Approvals</button>
            <button onClick={() => setCurrentPage('audit')} className="hover:text-indigo-600">Audit Trail</button>
          </div>
        </div>
        <p className="pb-4">© 2026 WorkForce AI. Production-grade multi-agent enterprise automation system.</p>
      </footer>
    </div>
  );
}
