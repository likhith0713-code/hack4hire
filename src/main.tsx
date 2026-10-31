import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import AgentWorkspace from './components/AgentWorkspace'
import {
  Activity, ArrowRight, BarChart3, Bell, Bot, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleAlert, Clock3, Command, Copy, DollarSign, FileCheck2, FileText, Filter, Fingerprint,
  Headphones, LayoutDashboard, Lightbulb, LockKeyhole, Mail, Menu, MessageSquare,
  Monitor, MoreHorizontal, Network, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck,
  ShieldAlert, Sparkles, Tag, UserCheck, UserPlus, Users, WalletCards, X, Zap, Moon, Sun, ArrowUpRight,
  PanelLeftClose, PanelLeftOpen, Building2, Workflow, DatabaseZap, ServerCog,
} from 'lucide-react'
import './styles.css'

type View = 'dashboard' | 'workflows' | 'approvals' | 'agents' | 'employees' | 'finance' | 'audit' | 'analytics' | 'settings'
type Status = 'completed' | 'waiting_approval' | 'queued' | 'failed' | 'running' | 'rejected'

type Task = { id: string; agent_id: string; title: string; description: string; status: Status; result?: string | null; requires_approval?: boolean; sort_order: number }
type Approval = { id: string; workflow_id: string; title: string; action: string; agent_id: string; requester: string; reason: string; information: Record<string, unknown>; risk: string; status: string; requested_at: string; decided_at?: string | null; decided_by?: string | null; decision_reason?: string | null }
type Workflow = { id: string; title: string; request: string; status: Status | 'completed'; created_by: string; department?: string; employee_name?: string; joining_date?: string; created_at: string; updated_at: string; final_result?: string | null; shared_context: Record<string, unknown>; tasks: Task[]; approval?: Approval | null; audit?: AuditEvent[] }
type Agent = { id: string; name: string; role: string; description: string; color: string; icon: string; status: string; tasks: number; success: number; execution_mode?: string }
type AuditEvent = { id: string; workflow_id?: string | null; actor_type: string; actor_id: string; action: string; detail: string; status: string; created_at: string }
type Metrics = { active_workflows: number; pending_approvals: number; completed_workflows: number; failed_workflows: number; automated_actions: number; success_rate: number }
type Overview = { metrics: Metrics; workflows: Workflow[]; agents: Agent[] }
type Employee = { id: string; name: string; department: string; title: string; joining_date: string; status: string; workflow_id?: string | null }
type FinanceReview = {
  id: string
  vendor: string
  vendor_email?: string | null
  invoice_number: string
  invoice_date?: string | null
  due_date?: string | null
  amount: string
  tax_amount?: string | null
  total_amount?: string | null
  currency?: string | null
  expense_category?: string | null
  description?: string | null
  status: string
  approval_status?: string
  payment_status?: string | null
  payment_amount?: string | null
  payment_currency?: string | null
  workflow_id?: string | null
  analysis?: {
    valid: boolean
    engine: string
    errors: string[]
    warnings: string[]
    categorized_expense: string
    requires_human_review: boolean
    payment_execution: string
  } | null
  created_by: string
  created_at: string
}
type FinanceSummary = {
  total_invoices: number
  pending_approvals: number
  approved_invoices: number
  rejected_invoices: number
  total_amount: string
  currency: string
  payments_executed: number
}
type Analytics = { volume: { label: string; value: number }[]; by_agent: { label: string; value: number; color: string }[]; health: { success_rate: number; avg_duration: string; human_review_rate: number } }
type Preferences = { workspace_name: string; appearance: 'light' | 'dark'; accent: 'aurora' | 'ocean' | 'sunset'; reduced_motion: boolean; default_approval_role: string; team_access: string; approval_guard: boolean; simulated_tools: boolean; parallel_plans: boolean; retention_days: number; audit_logging: boolean; approval_alerts: boolean; workflow_alerts: boolean; weekly_digest: boolean }
type SettingsResponse = { preferences: Preferences; updated_at: string; mode: string; llm_provider: string; external_integrations: { name: string; status: string; detail: string }[] }
type Account = { id: string; name: string; email: string; role: string }

const DEMO_REQUEST = 'Onboard a new employee named Rahul Kumar in the Engineering department, with a joining date of November 10, 2026.'
const agentColors: Record<string, string> = { planner: 'indigo', hr: 'pink', it: 'blue', finance: 'green', communication: 'purple', approval: 'orange' }
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function api<T>(path: string, init?: RequestInit): Promise<T> {
  const endpoint = path.startsWith('/api') ? path.slice(4) : path
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${API_BASE_URL}${endpoint}`, { ...init, credentials: 'include', headers }).then(async (res) => {
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      const detail = payload.detail
      const message = typeof detail === 'string'
        ? detail
        : detail?.analysis?.errors?.join(' ')
          || detail?.message
          || payload.error
          || res.statusText
          || 'Request failed'
      throw new Error(`HTTP ${res.status}: ${message}`)
    }
    return res.json()
  })
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('HTTP 401:')
}

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function viewFromPath(path: string): { view?: View; public: boolean; auth?: 'sign-in' | 'create-account'; agentId?: string } {
  if (path === '/' || path === '') return { public: true }
  if (path === '/sign-in') return { public: true, auth: 'sign-in' }
  if (path === '/create-account') return { public: true, auth: 'create-account' }
  const segments = path.split('/').filter(Boolean)
  if (segments[0] === 'agents' && segments[1]) return { view: 'agents', public: false, agentId: segments[1] }
  const key = (segments[0] || '') as View
  return { view: ['dashboard', 'workflows', 'approvals', 'agents', 'employees', 'finance', 'audit', 'analytics', 'settings'].includes(key) ? key : 'dashboard', public: false }
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { size, strokeWidth: 1.8 }
  const icons: Record<string, ReactNode> = {
    planner: <Sparkles {...common} />, hr: <Users {...common} />, it: <Monitor {...common} />, finance: <WalletCards {...common} />, communication: <MessageSquare {...common} />, approval: <ShieldCheck {...common} />,
  }
  return icons[name] || <Bot {...common} />
}

function Brand({ light = false }: { light?: boolean }) {
  const path = window.location.pathname
  const destination = path === '/' || path === '/sign-in' || path === '/create-account' ? '/' : '/app'
  return <button className={`brand ${light ? 'brand-light' : ''}`} onClick={() => navigate(destination)}><span className="brand-orbit"><i /><i /><i /><i /></span><span>WorkForce <b>AI</b></span></button>
}

function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { completed: 'Completed', waiting_approval: 'Awaiting approval', queued: 'Queued', failed: 'Failed', running: 'Running', rejected: 'Rejected', pending: 'Pending', pending_approval: 'Pending approval', approved: 'Approved', approved_simulated: 'Approved (simulated)' }
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{labels[status] || status.replace('_', ' ')}</span>
}

function AgentAvatar({ agent, size = 'md' }: { agent: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`agent-avatar avatar-${agentColors[agent] || 'indigo'} avatar-${size}`}><Icon name={agent} size={size === 'sm' ? 13 : size === 'lg' ? 21 : 17} /></span>
}

function Landing() {
  useEffect(() => { document.documentElement.dataset.theme = 'light' }, [])
  return <div className="landing-page">
    <nav className="landing-nav"><Brand light /><div className="landing-links"><a href="#product">Product</a><a href="#agents">AI Agents</a><a href="#security">Security</a><a href="#resources">Resources</a></div><div className="landing-actions"><button className="text-btn" onClick={() => navigate('/sign-in')}>Sign in</button><button className="button button-dark" onClick={() => navigate('/create-account')}>Get started <ArrowRight size={16} /></button></div><button className="mobile-menu" onClick={() => document.getElementById('agents')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Open mobile navigation"><Menu size={20} /></button></nav>
    <main>
      <section className="hero-section" id="product"><div className="hero-glow glow-one" /><div className="hero-glow glow-two" /><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-spark"><Sparkles size={12} /></span>THE AUTONOMOUS OPERATIONS LAYER</div><h1>Move work forward.<br /><span>Keep control.</span></h1><p>Meet your autonomous AI workforce. Plan, coordinate, and execute enterprise workflows with specialized agents working together — with a human at every important decision.</p><div className="hero-cta"><button className="button button-primary button-large" onClick={() => navigate('/create-account')}>Start building <ArrowRight size={17} /></button><button className="button button-ghost button-large" onClick={() => navigate('/app')}><span className="play-icon"><Zap size={13} fill="currentColor" /></span>Explore the workspace</button></div><div className="hero-proof"><div className="avatar-stack"><span>MC</span><span>AP</span><span>NW</span><span>+2k</span></div><span>Trusted by teams moving faster with AI</span></div></div><div className="hero-visual"><div className="visual-orbit orbit-back" /><div className="visual-orbit orbit-front" /><div className="hero-dashboard-card"><div className="mini-topbar"><span className="mini-title"><span className="mini-mark"><Sparkles size={11} /></span>workforce <b>ai</b></span><span className="mini-dot" /></div><div className="mini-heading"><span>Good morning, Maya</span><strong>Operations overview</strong></div><div className="mini-metrics"><span><b>12</b><small>Active workflows</small></span><span><b>98.6%</b><small>Success rate</small></span></div><div className="mini-workflow"><div className="mini-line-title"><span>Onboard Rahul Kumar</span><StatusPill status="waiting_approval" /></div><div className="mini-step-row"><i className="done"><Check size={10} /></i><span className="line" /><i className="done"><Check size={10} /></i><span className="line" /><i className="active"><ShieldCheck size={10} /></i><span className="line faded" /><i className="empty" /></div><div className="mini-step-labels"><small>Plan</small><small>HR</small><small>Review</small><small>Done</small></div></div><div className="mini-agents"><span className="mini-agent-stack"><i className="agent-chip chip-indigo"><Sparkles size={11} /></i><i className="agent-chip chip-pink"><Users size={11} /></i><i className="agent-chip chip-blue"><Monitor size={11} /></i></span><span>5 agents collaborating</span><ArrowUpRight size={13} /></div></div><div className="floating-note note-approval"><span className="note-icon note-yellow"><ShieldCheck size={15} /></span><span><b>Approval needed</b><small>IT access for Rahul Kumar</small></span><ChevronRight size={14} /></div><div className="floating-note note-success"><span className="note-icon note-green"><CheckCircle2 size={15} /></span><span><b>Invoice validated</b><small>Acme Cloud Services</small></span></div></div></section>
      <section className="trust-strip"><span>BUILT FOR OPERATIONS TEAMS</span><span>HR OPERATIONS</span><span>IT SERVICE DESKS</span><span>FINANCE CONTROL</span><span>PEOPLE LEADERS</span></section>
      <section className="section-pad how-section"><div className="section-intro"><div className="eyebrow">HOW IT WORKS</div><h2>One request.<br /><span>Every team in sync.</span></h2><p>WorkForce AI turns your intent into a coordinated plan, routes it to the right agents, and keeps sensitive decisions in human hands.</p></div><div className="how-grid"><HowCard number="01" icon={<Command size={19} />} title="Describe the outcome" text="Start with a plain-language request. No forms, no rigid templates, no translation layer." /><HowCard number="02" icon={<Network size={19} />} title="Agents collaborate" text="A Planner Agent decomposes the work and delegates to the specialists who know what to do." /><HowCard number="03" icon={<UserCheck size={19} />} title="You stay in control" text="Sensitive actions pause for an authorized human approval before anything executes." /></div></section>
      <section className="section-pad agents-section" id="agents"><div className="section-header-row"><div><div className="eyebrow">YOUR AI WORKFORCE</div><h2>Specialists, not shortcuts.</h2></div><button className="inline-link" onClick={() => navigate('/agents')}>Meet the agents <ArrowRight size={15} /></button></div><div className="landing-agent-grid">{['planner', 'hr', 'it', 'finance', 'communication', 'approval'].map((id, index) => <div className={`landing-agent-card agent-card-${agentColors[id]}`} key={id}><div className="landing-agent-top"><AgentAvatar agent={id} size="lg" /><span className="agent-index">0{index + 1}</span></div><h3>{AGENT_COPY[id].name}</h3><p>{AGENT_COPY[id].description}</p><div className="agent-line" /><span className="agent-capability">{AGENT_COPY[id].capability}</span></div>)}</div></section>
      <section className="section-pad security-section" id="security"><div className="security-panel"><div className="security-copy"><div className="eyebrow eyebrow-light">HUMAN-IN-THE-LOOP SECURITY</div><h2>Autonomous where it helps.<br /><span>Accountable where it matters.</span></h2><p>Every high-impact action gets a clear risk level, a named owner, and a human decision boundary. No agent can approve its own work.</p><button className="button button-light" onClick={() => navigate('/approvals')}>See approval center <ArrowRight size={16} /></button></div><div className="security-flow"><div className="security-node node-agent"><Bot size={18} /><span>Agent prepares</span></div><div className="security-connector"><span /><span /><span /></div><div className="security-node node-human"><UserCheck size={18} /><span>Manager decides</span></div><div className="security-connector"><span /><span /><span /></div><div className="security-node node-done"><CheckCircle2 size={18} /><span>System executes</span></div></div></div></section>
      <section className="section-pad final-cta"><div className="final-cta-inner"><div className="eyebrow">READY WHEN YOU ARE</div><h2>Your next workflow<br /><span>starts with a sentence.</span></h2><p>Bring clarity to the work that keeps your business moving.</p><button className="button button-primary button-large" onClick={() => navigate('/create-account')}>Build your first workflow <ArrowRight size={17} /></button></div></section>
    </main><footer className="landing-footer" id="resources"><Brand light /><span>© 2026 WorkForce AI</span><div><a href="#product">Product</a><a href="#security">Security</a><a href="#resources">Resources</a></div></footer>
  </div>
}

const AGENT_COPY: Record<string, { name: string; description: string; capability: string }> = {
  planner: { name: 'Planner Agent', description: 'Turns business intent into an executable plan with clear dependencies.', capability: 'Plan & delegate' },
  hr: { name: 'HR Agent', description: 'Keeps employee data accurate and onboarding steps on track.', capability: 'People operations' },
  it: { name: 'IT Agent', description: 'Coordinates access, devices, and software without skipping controls.', capability: 'Access & equipment' },
  finance: { name: 'Finance Agent', description: 'Validates financial activity and prepares safe payment requests.', capability: 'Finance operations' },
  communication: { name: 'Communication Agent', description: 'Creates polished updates that keep every stakeholder aligned.', capability: 'Business messaging' },
  approval: { name: 'Approval Agent', description: 'Routes risk-sensitive actions to the right human decision-maker.', capability: 'Human control' },
}

function HowCard({ number, icon, title, text }: { number: string; icon: ReactNode; title: string; text: string }) {
  return <div className="how-card"><span className="how-number">{number}</span><span className="how-icon">{icon}</span><h3>{title}</h3><p>{text}</p><ArrowUpRight className="how-arrow" size={17} /></div>
}

function AuthPage({ mode }: { mode: 'sign-in' | 'create-account' }) {
  const create = mode === 'create-account'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api<{ user: Account }>(create ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(create ? { name, email, password } : { email, password }),
      })
      navigate('/app')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to authenticate. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-page"><div className="auth-art"><div className="auth-art-content"><Brand light /><div className="auth-quote"><span className="quote-mark">“</span><h2>Work that moves<br /><span>with intention.</span></h2><p>Give every team an AI workforce that knows when to act and when to ask.</p><div className="auth-orbit-art"><div className="auth-orbit-center"><Sparkles size={22} /></div><span className="auth-art-node art-node-one"><Users size={17} /></span><span className="auth-art-node art-node-two"><Monitor size={17} /></span><span className="auth-art-node art-node-three"><ShieldCheck size={17} /></span></div></div><span className="auth-art-foot">Human control, built in.</span></div></div><div className="auth-form-wrap"><button className="auth-back" onClick={() => navigate('/')}><ChevronRight size={16} className="rotate-180" /> Back to home</button><form className="auth-form" onSubmit={submit}><div className="eyebrow">{create ? 'CREATE YOUR WORKSPACE' : 'WELCOME BACK'}</div><h1>{create ? 'Start moving work forward.' : 'Sign in to your workspace.'}</h1><p className="auth-sub">{create ? 'Create an account to set up your AI operations workspace.' : 'Sign in to continue to your workspace.'}</p>{create && <label>Full name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} /></label>}<label>Work email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label><label>Password<input type="password" autoComplete={create ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={create ? 12 : 1} maxLength={128} /></label>{create && <label className="check-row"><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required /> <span>I agree to create an account and use this workspace.</span></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? 'Please wait...' : create ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button><p className="auth-switch">{create ? 'Already have access?' : 'New to WorkForce AI?'} <button type="button" onClick={() => navigate(create ? '/sign-in' : '/create-account')}>{create ? 'Sign in' : 'Create an account'}</button></p><p className="demo-note"><Sparkles size={13} /> External accounts, payments, and email delivery remain protected.</p></form></div></div>
}

function Workspace({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [financeReviews, setFinanceReviews] = useState<FinanceReview[]>([])
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary>({
    total_invoices: 0,
    pending_approvals: 0,
    approved_invoices: 0,
    rejected_invoices: 0,
    total_amount: '0',
    currency: 'mixed',
    payments_executed: 0,
  })
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [settings, setSettings] = useState<Preferences | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('workforce-theme') === 'dark')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<'employee' | 'invoice' | 'command' | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingApprovalIds, setProcessingApprovalIds] = useState<Set<string>>(() => new Set())
  const processingApprovalIdsRef = useRef(new Set<string>())

  const refresh = async () => {
    setLoading(true)
    try {
      const [nextAccount, nextOverview, nextWorkflows, nextApprovals, nextEmployees, nextFinanceReviews, nextFinanceSummary, nextAudit, nextAnalytics, nextSettings] = await Promise.all([api<{ user: Account }>('/api/auth/me'), api<Overview>('/api/overview'), api<Workflow[]>('/api/workflows'), api<Approval[]>('/api/approvals'), api<Employee[]>('/api/employees'), api<FinanceReview[]>('/api/finance/invoices'), api<FinanceSummary>('/api/finance/dashboard'), api<AuditEvent[]>('/api/audit'), api<Analytics>('/api/analytics'), api<SettingsResponse>('/api/settings')])
      setAccount(nextAccount.user)
      setOverview(nextOverview); setWorkflows(nextWorkflows); setApprovals(nextApprovals); setEmployees(nextEmployees); setFinanceReviews(nextFinanceReviews); setFinanceSummary(nextFinanceSummary); setAudit(nextAudit); setAnalytics(nextAnalytics); setSettings(nextSettings.preferences); setDark(nextSettings.preferences.appearance === 'dark')
      if (!selectedWorkflowId && nextWorkflows[0]) setSelectedWorkflowId(nextWorkflows[0].id)
    } catch (error) {
      if (isUnauthorized(error)) navigate('/sign-in')
      else setToast(error instanceof Error ? error.message : 'Unable to load workspace')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const handler = () => { void refresh() }
    window.addEventListener('workforce:refresh', handler)
    return () => window.removeEventListener('workforce:refresh', handler)
  }, [])
  useEffect(() => {
    let refreshTimer: number | undefined
    const stream = new EventSource(`${API_BASE_URL}/events`, { withCredentials: true })
    stream.onmessage = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => { void refresh() }, 300)
    }
    return () => {
      stream.close()
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
    }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; if (settings) { document.documentElement.dataset.accent = settings.accent; document.documentElement.dataset.motion = settings.reduced_motion ? 'reduced' : 'full' }; localStorage.setItem('workforce-theme', dark ? 'dark' : 'light') }, [dark, settings])
  useEffect(() => { const handler = () => { const route = viewFromPath(window.location.pathname); setView(route.view || 'dashboard') }; window.addEventListener('popstate', handler); return () => window.removeEventListener('popstate', handler) }, [])
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(''), 3600); return () => clearTimeout(timeout) } }, [toast])

  const go = (next: View) => { setView(next); navigate(next === 'dashboard' ? '/app' : `/${next}`) }
  const selectedWorkflow = workflows.find(item => item.id === selectedWorkflowId) || workflows[0]
  const pendingApprovals = approvals.filter(item => item.status === 'pending')

  const decide = async (approvalId: string, approved: boolean) => {
    if (processingApprovalIdsRef.current.has(approvalId)) return
    processingApprovalIdsRef.current.add(approvalId)
    setProcessingApprovalIds(current => new Set(current).add(approvalId))
    try {
      const workflow = await api<Workflow>(`/api/approvals/${approvalId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: approved ? 'approved' : 'rejected',
          reason: approved ? 'Reviewed and approved for the requested onboarding scope.' : 'Rejected after review.',
        }),
      })
      setToast(approved
        ? `Approval recorded. Workflow ${workflow.status === 'completed' ? 'completed' : 'resumed'}.`
        : 'Approval rejected. Sensitive action blocked.')
      await refresh()
    } catch (error) {
      if (isUnauthorized(error)) navigate('/sign-in')
      else setToast(error instanceof Error ? error.message : 'Decision failed')
    } finally {
      processingApprovalIdsRef.current.delete(approvalId)
      setProcessingApprovalIds(current => {
        const next = new Set(current)
        next.delete(approvalId)
        return next
      })
    }
  }
  const retry = async (workflowId: string) => { try { const retried = await api<Workflow>(`/api/workflows/${workflowId}/retry`, { method: 'POST', body: JSON.stringify({}) }); setToast(`Agent tasks retried. Workflow status: ${humanize(retried.status)}.`); await refresh() } catch (error) { setToast(error instanceof Error ? error.message : 'Retry failed') } }
  const createWorkflow = async (request: string) => { try { const created = await api<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify({ request }) }); setShowCreate(false); setSelectedWorkflowId(created.id); setToast('Workflow created. Approval checkpoint is ready for review.'); await refresh(); go('workflows') } catch (error) { setToast(error instanceof Error ? error.message : 'Workflow creation failed') } }
  const addEmployee = async (payload: Omit<Employee, 'id' | 'status' | 'workflow_id' | 'created_at'>) => { try { await api<Employee>('/api/employees', { method: 'POST', body: JSON.stringify(payload) }); setModal(null); setToast('Employee record created in onboarding status.'); await refresh(); go('employees') } catch (error) { setToast(error instanceof Error ? error.message : 'Employee creation failed') } }
  const requestFinanceReview = async (payload: FormData): Promise<boolean> => { try { await api('/api/finance/invoices', { method: 'POST', body: payload }); setModal(null); setToast('Invoice validated and routed for human approval. No payment was executed.'); await refresh(); go('finance'); return true } catch (error) { setToast(error instanceof Error ? error.message : 'Finance review failed'); return false } }
  const saveSettings = async (preferences: Partial<Preferences>) => { try { const response = await api<SettingsResponse>('/api/settings', { method: 'PUT', body: JSON.stringify({ preferences }) }); setSettings(response.preferences); setDark(response.preferences.appearance === 'dark'); setToast('Settings saved and applied across the workspace.'); } catch (error) { setToast(error instanceof Error ? error.message : 'Settings update failed') } }
  const signOut = async () => { try { await api('/api/auth/logout', { method: 'POST' }); navigate('/sign-in') } catch (error) { setToast(error instanceof Error ? error.message : 'Unable to sign out') } }

  if (!loading && !overview) {
    return (
      <div className="workspace">
        <main className="workspace-main">
          <div className="workspace-content">
            <div className="card" role="alert">
              <div className="empty-state">
                <span><CircleAlert size={18} /></span>
                <h3>Workspace data could not be loaded</h3>
                <p>Check your connection and try again.</p>
                <button className="button button-secondary button-small" onClick={() => void refresh()}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return <div className="workspace"><aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileNavOpen ? 'mobile-open' : ''}`}><div className="sidebar-top"><Brand /><button className="collapse-button" onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button><button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div><div className="workspace-switcher"><span className="workspace-logo">{settings?.workspace_name?.slice(0, 1) || 'N'}</span><span className="workspace-label"><b>{settings?.workspace_name || 'Northstar Inc.'}</b><small>Operations workspace</small></span><ChevronDown size={15} /></div><nav className="side-nav"><NavGroup label="Workspace" items={[['dashboard', 'Overview', LayoutDashboard], ['workflows', 'Workflows', Workflow], ['approvals', 'Approval center', ShieldCheck]]} view={view} go={go} badge={pendingApprovals.length} /><NavGroup label="Operations" items={[['agents', 'AI agents', Bot], ['employees', 'Employees', Users], ['finance', 'Finance', WalletCards]]} view={view} go={go} /><NavGroup label="Observe" items={[['audit', 'Audit log', Fingerprint], ['analytics', 'Analytics', BarChart3]]} view={view} go={go} /></nav><div className="sidebar-bottom"><button className={`side-link ${view === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Settings2 size={17} /><span>Settings</span></button><div className="user-card"><span className="user-avatar">{(account?.name || 'U').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="user-info"><b>{account?.name || 'Workspace user'}</b><small>{account?.role || 'member'}</small></span><button className="sign-out-button" onClick={signOut} aria-label="Sign out">Sign out</button></div></div></aside>{mobileNavOpen && <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}<main className="workspace-main"><header className="workspace-header"><div className="mobile-header"><button className="mobile-menu workspace-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open workspace navigation"><Menu size={19} /></button><Brand /></div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{view === 'dashboard' ? 'Overview' : view.replace('-', ' ')}</b></div><div className="header-actions"><button className="header-icon" title="Search" onClick={() => setModal('command')}><Search size={17} /></button><button className="header-icon notification" title="Notifications" onClick={() => go('approvals')}><Bell size={17} /><i /></button><button className="theme-toggle" onClick={() => { const next = !dark; setDark(next); saveSettings({ appearance: next ? 'dark' : 'light' }) }}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button><span className="header-divider" /><span className="header-user">{(account?.name || 'U').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span></div></header>  <div className="workspace-content">{loading && !overview ? <LoadingState /> : <>{view === 'dashboard' && <Dashboard overview={overview!} workflows={workflows} approvals={pendingApprovals} account={account} selectedWorkflow={selectedWorkflow} selectWorkflow={setSelectedWorkflowId} go={go} create={() => setShowCreate(true)} retry={retry} />}{view === 'workflows' && <WorkflowsPage workflows={workflows} selected={selectedWorkflow} setSelected={setSelectedWorkflowId} create={() => setShowCreate(true)} retry={retry} go={go} />}{view === 'approvals' && <ApprovalsPage approvals={approvals} workflows={workflows} decide={decide} />}{view === 'agents' && <AgentsPage agents={overview?.agents || []} onConfigure={() => { go('settings'); setToast('Agent permission controls are available in Settings.') }} />}{view === 'employees' && <EmployeesPage employees={employees} onAdd={() => setModal('employee')} />  }{view === 'finance' && <FinancePage reviews={financeReviews} summary={financeSummary} onNewReview={() => setModal('invoice')} go={go} />}{view === 'audit' && <AuditPage audit={audit} />}{view === 'analytics' && <AnalyticsPage analytics={analytics} onToast={setToast} />}{view === 'settings' && settings && <SettingsPage settings={settings} save={saveSettings} onToast={setToast} />}</>}</div></main>{showCreate && <CreateWorkflowModal close={() => setShowCreate(false)} submit={createWorkflow} />}{modal === 'employee' && <EmployeeModal close={() => setModal(null)} submit={addEmployee} />}{modal === 'invoice' && <InvoiceModal close={() => setModal(null)} submit={requestFinanceReview} />}{modal === 'command' && <CommandPalette close={() => setModal(null)} go={go} create={() => { setModal(null); setShowCreate(true) }} />}{toast && <div className="toast"><CheckCircle2 size={17} /><span>{toast}</span><button onClick={() => setToast('')}><X size={14} /></button></div>}</div>
}

function NavGroup({ label, items, view, go, badge }: { label: string; items: [View, string, typeof LayoutDashboard][]; view: View; go: (view: View) => void; badge?: number }) { return <div className="nav-group"><span className="nav-label">{label}</span>{items.map(([id, text, IconComp]) => <button className={`side-link ${view === id ? 'active' : ''}`} key={id} onClick={() => go(id)}><IconComp size={17} /><span>{text}</span>{id === 'approvals' && badge ? <b className="nav-badge">{badge}</b> : null}</button>)}</div> }

function LoadingState() { return <div className="loading-state"><span className="loading-orb"><Sparkles size={19} /></span><h2>Connecting your AI workforce</h2><p>Loading plans, approvals, and audit context...</p></div> }

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div> }

function Dashboard({ overview, workflows, approvals, account, selectedWorkflow, selectWorkflow, go, create, retry }: { overview: Overview; workflows: Workflow[]; approvals: Approval[]; account: Account | null; selectedWorkflow?: Workflow; selectWorkflow: (id: string) => void; go: (view: View) => void; create: () => void; retry: (id: string) => void }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = account?.name.trim().split(/\s+/)[0] || 'there'

  return <><PageHeading eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()} title={`${greeting}, ${firstName}`} subtitle="Here is what your AI workforce is moving forward today." action={<button className="button button-primary" onClick={create}><Plus size={16} /> New workflow</button>} /><div className="metric-grid"><MetricCard label="Active workflows" value={overview.metrics.active_workflows.toString()} change="Current queue" detail="running or awaiting approval" icon={<Workflow size={18} />} color="indigo" /><MetricCard label="Pending approvals" value={overview.metrics.pending_approvals.toString().padStart(2, '0')} change="Needs review" detail="in your queue" icon={<ShieldCheck size={18} />} color="orange" /><MetricCard label="Completed tasks" value={overview.metrics.automated_actions.toLocaleString()} change="Recorded" detail="persisted task results" icon={<Zap size={18} />} color="purple" /><MetricCard label="Success rate" value={`${overview.metrics.success_rate}%`} change="Resolved workflows" detail="completed vs. failed or rejected" icon={<Activity size={18} />} color="green" /></div><div className="dashboard-grid"><section className="card workflow-focus"><div className="card-header"><div><span className="card-kicker"><span className="live-dot" /> WORKFLOW STATUS</span><h2>Execution in motion</h2></div><button className="icon-button" onClick={() => go('workflows')}><ArrowUpRight size={17} /></button></div>{selectedWorkflow ? <WorkflowFocus workflow={selectedWorkflow} selectWorkflow={selectWorkflow} retry={retry} /> : <EmptyState title="No workflows yet" text="Start with a plain-language request and let your agents take it from there." action={create} />}</section><section className="card approvals-focus"><div className="card-header"><div><span className="card-kicker">HUMAN DECISIONS</span><h2>Approval queue <span className="count-badge">{approvals.length}</span></h2></div><button className="inline-link" onClick={() => go('approvals')}>View all <ArrowRight size={14} /></button></div>{approvals.length ? approvals.slice(0, 2).map(approval => <ApprovalRow key={approval.id} approval={approval} onClick={() => go('approvals')} />) : <EmptyState title="Queue is clear" text="No sensitive actions are waiting for your decision." />}</section><section className="card activity-card"><div className="card-header"><div><span className="card-kicker">AGENT ACTIVITY</span><h2>What happened recently</h2></div><button className="inline-link" onClick={() => go('audit')}>Audit log <ArrowRight size={14} /></button></div><ActivityList workflows={workflows} /></section><section className="card health-card"><div className="card-header"><div><span className="card-kicker">WORKSPACE MODE</span><h2>Agent activity</h2></div><button className="icon-button" onClick={() => go('agents')}><ArrowUpRight size={17} /></button></div><div className="health-main"><div className="health-ring"><strong>{overview.metrics.success_rate}%</strong><small>workflow success</small></div><div><b>Rule-based demo mode</b><p>Agent actions use deterministic demo logic. Gemini and external services are not used to execute tasks.</p></div></div><div className="health-agents">{overview.agents.slice(0, 5).map(agent => <div key={agent.id} className="health-agent"><AgentAvatar agent={agent.id} size="sm" /><span /><b>{agent.tasks} tasks</b></div>)}</div></section></div></>
}

function MetricCard({ label, value, change, detail, icon, color }: { label: string; value: string; change: string; detail: string; icon: ReactNode; color: string }) { return <div className={`metric-card metric-${color}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-change">{change}</span></div><strong>{value}</strong><span className="metric-label">{label}</span><small>{detail}</small></div> }

function WorkflowFocus({ workflow, selectWorkflow, retry }: { workflow: Workflow; selectWorkflow: (id: string) => void; retry: (id: string) => void }) { const completed = workflow.tasks.filter(task => task.status === 'completed').length; const percent = Math.round((completed / Math.max(1, workflow.tasks.length)) * 100); return <><div className="focus-top"><div><h3>{workflow.title}</h3><p>{workflow.department} · {workflow.employee_name || 'Enterprise workflow'} · <span>{timeAgo(workflow.updated_at)}</span></p></div><StatusPill status={workflow.status} /></div><div className="progress-head"><span>Overall progress</span><b>{percent}%</b></div><div className="progress-bar"><span style={{ width: `${Math.max(12, percent)}%` }} /></div><div className="agent-stepper">{workflow.tasks.map((task, index) => <div className="agent-step" key={task.id}><div className={`step-connector ${index === 0 ? 'hidden' : ''}`} /><span className={`step-node step-${task.status}`}><Icon name={task.agent_id} size={14} />{task.status === 'completed' && <i><Check size={8} /></i>}</span><div><b>{task.title}</b><small>{task.status === 'waiting_approval' ? 'Awaiting human review' : task.result || task.description}</small></div></div>)}</div><div className="focus-footer"><span><span className="tiny-stack"><AgentAvatar agent="planner" size="sm" /><AgentAvatar agent="hr" size="sm" /><AgentAvatar agent="it" size="sm" /></span>{workflow.tasks.length} agent tasks</span>{workflow.status === 'failed' && <button className="button button-small button-warning" onClick={() => retry(workflow.id)}><RefreshCw size={14} /> Retry failed task</button>}<button className="text-action" onClick={() => selectWorkflow(workflow.id)}>View details <ArrowRight size={14} /></button></div></> }

function ApprovalRow({ approval, onClick }: { approval: Approval; onClick: () => void }) { return <button className="approval-row" onClick={onClick}><span className="approval-signal"><ShieldCheck size={17} /></span><span className="approval-row-copy"><b>{approval.title}</b><small>{approval.action}</small><em><Clock3 size={12} /> {timeAgo(approval.requested_at)}</em></span><span className="risk-label">{approval.risk} risk</span><ChevronRight size={16} /></button> }

function ActivityList({ workflows }: { workflows: Workflow[] }) { const items = workflows.flatMap(item => (item.audit || []).slice(0, 1).map(event => ({ ...event, title: item.title }))).slice(0, 4); return <div className="activity-list">{items.map(item => <div className="activity-item" key={item.id}><span className={`activity-icon activity-${item.status}`}><Icon name={item.actor_id} size={15} /></span><span><b>{humanize(item.action)}</b><small>{item.detail}</small><em>{timeAgo(item.created_at)} · {item.title}</em></span></div>)}</div> }

function WorkflowsPage({ workflows, selected, setSelected, create, retry, go }: { workflows: Workflow[]; selected?: Workflow; setSelected: (id: string) => void; create: () => void; retry: (id: string) => void; go: (view: View) => void }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const filteredWorkflows = workflows.filter(workflow => {
    const matchesQuery = `${workflow.title} ${workflow.request} ${workflow.department || ''}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'all' || workflow.status === statusFilter)
  })
  return <><PageHeading eyebrow="ORCHESTRATION" title="Workflows" subtitle="Every request, plan, handoff, and outcome in one place." action={<button className="button button-primary" onClick={create}><Plus size={16} /> New workflow</button>} /><div className="split-layout"><section className="card list-card"><div className="list-toolbar"><div className="search-field"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workflows" /></div><select className="filter-button" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="waiting_approval">Awaiting approval</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="rejected">Rejected</option></select></div><div className="workflow-list">{filteredWorkflows.length ? filteredWorkflows.map(workflow => <button key={workflow.id} className={`workflow-list-row ${selected?.id === workflow.id ? 'selected' : ''}`} onClick={() => setSelected(workflow.id)}><span className="workflow-row-icon"><Workflow size={16} /></span><span className="workflow-list-copy"><b>{workflow.title}</b><small>{workflow.department || 'Operations'} · {timeAgo(workflow.updated_at)}</small></span><StatusPill status={workflow.status} /><ChevronRight size={16} /></button>) : <EmptyState title="No matching workflows" text="Try a different search or clear the status filter." />}</div></section><section className="card detail-card">{selected ? <WorkflowDetail workflow={selected} retry={retry} go={go} /> : <EmptyState title="Select a workflow" text="Choose a workflow to see its execution plan and audit trail." />}</section></div></> }

function WorkflowDetail({ workflow, retry, go }: { workflow: Workflow; retry: (id: string) => void; go: (view: View) => void }) { return <><div className="detail-title"><div><span className="card-kicker">WORKFLOW DETAIL</span><h2>{workflow.title}</h2><p>{workflow.request}</p></div><StatusPill status={workflow.status} /></div><div className="detail-summary"><span><small>Owner</small><b>{workflow.created_by}</b></span><span><small>Department</small><b>{workflow.department || 'Operations'}</b></span><span><small>Started</small><b>{formatDate(workflow.created_at)}</b></span></div><div className="plan-banner"><span className="plan-banner-icon"><Sparkles size={17} /></span><div><b>Planner Agent has the context</b><p>Tasks are sequenced with dependencies and protected by an approval checkpoint.</p></div><span className="plan-banner-tag">Shared state</span></div><div className="detail-timeline">{workflow.tasks.map((task, index) => <div className="timeline-row" key={task.id}><div className="timeline-rail"><span className={`timeline-node node-${task.status}`}><Icon name={task.agent_id} size={14} /></span>{index < workflow.tasks.length - 1 && <i />}</div><div className="timeline-copy"><div><b>{task.title}</b><span className="task-agent"><AgentAvatar agent={task.agent_id} size="sm" /> {agentName(task.agent_id)}</span></div><p>{task.description}</p>{task.result && <small className="task-result"><CheckCircle2 size={12} /> {task.result}</small>}</div><StatusPill status={task.status} /></div>)}</div>{workflow.final_result && <div className="result-callout"><CheckCircle2 size={17} /><span><b>Final result</b><small>{workflow.final_result}</small></span></div>}{workflow.status === 'failed' && <button className="button button-warning" onClick={() => retry(workflow.id)}><RefreshCw size={15} /> Retry eligible tasks</button>}{workflow.approval?.status === 'pending' && <button className="button button-secondary" onClick={() => go('approvals')}><ShieldCheck size={15} /> Review approval checkpoint</button>}</> }

function ApprovalsPage({ approvals, workflows, decide }: { approvals: Approval[]; workflows: Workflow[]; decide: (id: string, approved: boolean) => Promise<void> }) {
  const pending = approvals.filter(item => item.status === 'pending')
  return <>
    <PageHeading eyebrow="HUMAN-IN-THE-LOOP" title="Approval center" subtitle="Make the decisions your agents should never make for themselves." action={<div className="approval-policy"><ShieldCheck size={15} /> Manager policy active</div>} />
    {pending.length > 0 && <div className="approval-banner"><span><CircleAlert size={18} /></span><div><b>{pending.length} action{pending.length > 1 ? 's' : ''} waiting for your review</b><p>These operations are paused until an authorized human decides.</p></div><span className="approval-banner-lock"><LockKeyhole size={14} /> Protected</span></div>}
    <div className="approval-grid">{approvals.map(approval => <ApprovalCard key={approval.id} approval={approval} workflow={workflows.find(item => item.id === approval.workflow_id)} decide={decide} />)}</div>
  </>
}

function ApprovalCard({ approval, workflow, decide }: { approval: Approval; workflow?: Workflow; decide: (id: string, approved: boolean) => Promise<void> }) {
  const [expanded, setExpanded] = useState(approval.status === 'pending')
  const [processing, setProcessing] = useState(false)
  const processingRef = useRef(false)

  const submitDecision = async (approved: boolean) => {
    if (processingRef.current) return
    processingRef.current = true
    setProcessing(true)
    try {
      await decide(approval.id, approved)
    } finally {
      processingRef.current = false
      setProcessing(false)
    }
  }

  return <article className={`approval-card approval-card-${approval.status}`}><div className="approval-card-head"><span className="approval-card-icon"><ShieldCheck size={18} /></span><div><span className="card-kicker">{approval.risk.toUpperCase()} RISK · {approval.agent_id.toUpperCase()} AGENT</span><h2>{approval.title}</h2></div><StatusPill status={approval.status} /></div><p className="approval-action"><b>Requested action</b>{approval.action}</p><div className="approval-meta"><span><small>Requester</small><b>{approval.requester}</b></span><span><small>Workflow</small><b>{workflow?.title || approval.workflow_id}</b></span><span><small>Requested</small><b>{formatDate(approval.requested_at)}</b></span></div><button className="approval-expand" onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide relevant information' : 'Show relevant information'}<ChevronDown size={15} className={expanded ? 'chevron-up' : ''} /></button>{expanded && <div className="approval-info"><p>{approval.reason}</p><div className="info-grid">{Object.entries(approval.information || {}).map(([key, value]) => <span key={key}><small>{key.replace('_', ' ')}</small><b>{Array.isArray(value) ? value.join(' · ') : String(value)}</b></span>)}</div></div>}{approval.status === 'pending' ? <div className="approval-actions"><button className="button button-danger-ghost" disabled={processing} onClick={() => void submitDecision(false)}><X size={15} /> Reject action</button><button className="button button-primary" disabled={processing} onClick={() => void submitDecision(true)}><Check size={15} /> Approve & resume</button></div> : <div className="decision-note"><CheckCircle2 size={15} /><span>Decision by {approval.decided_by || 'Maya Chen'} on {formatDate(approval.decided_at || approval.requested_at)}</span></div>}</article>
}

function AgentsPage({ agents, onConfigure }: { agents: Agent[]; onConfigure: () => void }) {
  const [selectedAgentId, setSelectedAgentId] = useState(() => viewFromPath(window.location.pathname).agentId || '')
  const taskCount = agents.reduce((total, agent) => total + agent.tasks, 0)
  const reviewCount = agents.filter(agent => agent.status === 'waiting_for_approval').length
  const statusLabels: Record<string, string> = { idle: 'Idle', assigned: 'Assigned', running: 'Running', waiting_for_approval: 'Waiting for approval', completed: 'Completed', failed: 'Failed', rejected: 'Rejected' }
  useEffect(() => {
    const syncAgentRoute = () => setSelectedAgentId(viewFromPath(window.location.pathname).agentId || '')
    window.addEventListener('popstate', syncAgentRoute)
    return () => window.removeEventListener('popstate', syncAgentRoute)
  }, [])
  const openAgent = (agentId: string) => {
    setSelectedAgentId(agentId)
    navigate(`/agents/${agentId}`)
  }
  if (selectedAgentId) {
    const agent = agents.find(item => item.id === selectedAgentId)
    if (agent) return <AgentWorkspace agent={agent} onBack={() => { setSelectedAgentId(''); navigate('/agents') }} />
  }
  return <>
    <PageHeading eyebrow="SPECIALIZED OPERATIONS" title="Agent directory" subtitle="Choose an agent to open its live, persisted workspace." action={<button className="button button-secondary" onClick={onConfigure}><Settings2 size={16} /> Configure agents</button>} />
    <div className="agent-summary-strip"><span><strong>{agents.length}</strong><small>agent roles</small></span><span><strong>{taskCount}</strong><small>tracked task executions</small></span><span><strong>{reviewCount}</strong><small>agents awaiting review</small></span><span><strong>LangGraph</strong><small>{agents[0]?.execution_mode === 'langgraph_gemini' ? 'Gemini planner enabled' : 'Local planner active'}</small></span></div>
    <div className="agents-directory">{agents.map(agent => <button className="agent-directory-card card" key={agent.id} onClick={() => openAgent(agent.id)}>
      <div className="agent-directory-top"><AgentAvatar agent={agent.id} size="lg" /><span className={`online-state ${agent.status === 'waiting_for_approval' || agent.status === 'failed' ? 'review-state' : ''}`}><i />{statusLabels[agent.status] || statusLabels.idle}</span></div>
      <span className="card-kicker">{agent.role.toUpperCase()}</span><h2>{agent.name}</h2><p>{agent.description}</p>
      <div className="agent-stat-row"><span><small>Recorded tasks</small><b>{agent.tasks}</b></span><span><small>Resolved success rate</small><b>{agent.tasks ? `${agent.success}%` : '—'}</b></span></div>
      <div className="agent-permission"><LockKeyhole size={13} /> Internal database tools · external actions remain simulated</div>
      <span className="agent-open-label">Open agent workspace <ArrowRight size={13} /></span>
    </button>)}</div>
  </>
}

function EmployeesPage({ employees, onAdd }: { employees: Employee[]; onAdd: () => void }) {
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('all')
  const departments = Array.from(new Set(employees.map(employee => employee.department))).sort()
  const filtered = employees.filter(employee => `${employee.name} ${employee.department} ${employee.title}`.toLowerCase().includes(query.toLowerCase()) && (department === 'all' || employee.department === department))
  return <><PageHeading eyebrow="PEOPLE OPERATIONS" title="Employees" subtitle="Employee records and onboarding context shared with authorized agents." action={<button className="button button-primary" onClick={onAdd}><UserPlus size={16} /> Add employee</button>} /><div className="card table-card"><div className="list-toolbar"><div><span className="card-kicker">EMPLOYEE DIRECTORY</span><h2>{filtered.length} people shown</h2></div><div className="table-tools"><div className="search-field"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people" /></div><select className="filter-button" value={department} onChange={event => setDepartment(event.target.value)}><option value="all">All departments</option>{departments.map(item => <option key={item} value={item}>{item}</option>)}</select></div></div><div className="data-table"><div className="table-row table-head"><span>Employee</span><span>Department</span><span>Title</span><span>Joining date</span><span>Status</span></div>{filtered.map(employee => <div className="table-row" key={employee.id}><span className="employee-cell"><span className="employee-avatar">{initials(employee.name)}</span><b>{employee.name}</b></span><span>{employee.department}</span><span>{employee.title}</span><span>{employee.joining_date}</span><span><StatusPill status={employee.status === 'Active' ? 'completed' : 'waiting_approval'} /></span></div>)}</div>{!filtered.length && <EmptyState title="No employees found" text="Try another search or add a new employee record." action={onAdd} />}</div></>
}

function FinancePage({ reviews, summary, onNewReview, go }: { reviews: FinanceReview[]; summary: FinanceSummary; onNewReview: () => void; go: (view: View) => void }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  const filtered = reviews.filter(invoice => {
    const status = invoice.approval_status || invoice.status
    const matchesText = `${invoice.invoice_number} ${invoice.vendor} ${invoice.expense_category || ''} ${invoice.description || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesText && (statusFilter === 'all' || status === statusFilter)
  }).sort((left, right) => {
    const a = String(left[sortBy as keyof FinanceReview] || '').toLocaleLowerCase()
    const b = String(right[sortBy as keyof FinanceReview] || '').toLocaleLowerCase()
    return (a < b ? -1 : a > b ? 1 : 0) * (sortDirection === 'asc' ? 1 : -1)
  })
  const amountLabel = (invoice: FinanceReview) => {
    const value = invoice.payment_amount || invoice.total_amount || invoice.amount
    const currency = invoice.payment_currency || invoice.currency || 'INR'
    return `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const statusLabel = (invoice: FinanceReview) => {
    const status = invoice.approval_status || invoice.payment_status || invoice.status
    return status === 'pending_approval' || status === 'pending_review' ? 'waiting_approval' : status
  }
  const recent = [...reviews].slice(0, 5)
  const selectedAnalysis = reviews.find(invoice => invoice.id === selectedAnalysisId)

  return <>
    <PageHeading eyebrow="FINANCE OPERATIONS" title="Finance control room" subtitle="Analyze invoice details, preserve the review trail, and route every payment for human authorization." action={<button className="button button-primary" onClick={onNewReview}><FileCheck2 size={16} /> Submit invoice</button>} />
    <div className="metric-grid finance-metrics">
      <MetricCard label="Total invoices submitted" value={summary.total_invoices.toLocaleString()} change="PostgreSQL records" detail="all submitted invoices" icon={<FileText size={18} />} color="indigo" />
      <MetricCard label="Pending approvals" value={summary.pending_approvals.toLocaleString()} change="Needs human review" detail="payment remains disabled" icon={<CircleAlert size={18} />} color="orange" />
      <MetricCard label="Approved invoices" value={summary.approved_invoices.toLocaleString()} change="Simulated approval" detail="no payment executed" icon={<CheckCircle2 size={18} />} color="green" />
      <MetricCard label="Rejected invoices" value={summary.rejected_invoices.toLocaleString()} change="Protected" detail="payment request blocked" icon={<ShieldAlert size={18} />} color="purple" />
      <MetricCard label="Total invoice amount" value={Number(summary.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} change="Database aggregate" detail="currencies are not converted" icon={<DollarSign size={18} />} color="indigo" />
    </div>
    <div className="finance-grid">
      <section className="card invoice-card">
        <div className="card-header">
          <div><span className="card-kicker">PAYMENT REQUESTS</span><h2>Recent activity</h2></div>
          <button className="inline-link" onClick={() => go('approvals')}>Open approval center <ArrowRight size={14} /></button>
        </div>
        {recent.length ? recent.map(invoice => <div className="invoice-row" key={invoice.id}>
          <span className="vendor-logo">{invoice.vendor.slice(0, 1).toUpperCase()}</span>
          <span><b>{invoice.vendor}</b><small>{invoice.invoice_number}</small></span>
          <strong>{amountLabel(invoice)}</strong>
          <StatusPill status={statusLabel(invoice)} />
        </div>) : <EmptyState title="No payment requests yet" text="Validated invoices and their approval requests will appear here." action={onNewReview} />}
      </section>
      <section className="card policy-card">
        <div className="card-header"><div><span className="card-kicker">PAYMENT SAFETY</span><h2>Always simulated</h2></div><ShieldCheck size={19} /></div>
        <div className="policy-illustration"><div><WalletCards size={25} /><span>Payment request</span></div><ArrowRight size={17} /><div className="blocked-payment"><LockKeyhole size={25} /><span>Real payment</span></div></div>
        <p>Every valid invoice is routed to a human approval checkpoint. Approval updates the request status only; payment execution is disabled.</p>
      </section>
    </div>
    <section className="card table-card finance-history">
      <div className="list-toolbar">
        <div><span className="card-kicker">FINANCE HISTORY</span><h2>{filtered.length} invoices shown</h2></div>
        <div className="table-tools">
          <div className="search-field"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search invoice, vendor, category" /></div>
          <select className="filter-button" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option><option value="pending_approval">Pending</option><option value="approved_simulated">Approved</option><option value="rejected">Rejected</option>
          </select>
          <select className="filter-button" value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="created_at">Sort: submitted</option><option value="invoice_number">Sort: invoice #</option><option value="vendor">Sort: vendor</option><option value="invoice_date">Sort: invoice date</option><option value="due_date">Sort: due date</option><option value="amount">Sort: amount</option><option value="expense_category">Sort: category</option>
          </select>
          <button className="button button-small button-secondary" onClick={() => setSortDirection(value => value === 'asc' ? 'desc' : 'asc')}>{sortDirection === 'asc' ? 'Ascending' : 'Descending'}</button>
        </div>
      </div>
      <div className="data-table finance-table-wrap">
        <div className="table-row table-head finance-table-row"><span>Invoice #</span><span>Vendor</span><span>Invoice date</span><span>Due date</span><span>Amount</span><span>Category</span><span>Submitted</span><span>Approval status</span><span>Actions</span></div>
        {filtered.map(invoice => <div className="table-row finance-table-row" key={invoice.id}>
          <span className="finance-invoice-number">{invoice.invoice_number}</span><span>{invoice.vendor}</span><span>{formatDate(invoice.invoice_date)}</span><span>{formatDate(invoice.due_date)}</span><span>{amountLabel(invoice)}</span><span>{invoice.expense_category || 'General expenses'}</span><span>{formatDate(invoice.created_at)}</span><span><StatusPill status={statusLabel(invoice)} /></span>
          <span className="finance-actions"><button className="text-action" onClick={() => setSelectedAnalysisId(value => value === invoice.id ? null : invoice.id)}>{selectedAnalysisId === invoice.id ? 'Hide analysis' : 'Analysis'}</button>{statusLabel(invoice) === 'waiting_approval' ? <button className="text-action" onClick={() => go('approvals')}>Review <ArrowRight size={13} /></button> : <button className="text-action" onClick={() => go('workflows')}>Workflow <ArrowRight size={13} /></button>}</span>
        </div>)}
        {!filtered.length && <EmptyState title="No matching invoices" text="Adjust your search or filters, or submit a new invoice." action={onNewReview} />}
      </div>
      {selectedAnalysis && <div className="invoice-analysis-detail">
        <div><span className="card-kicker">FINANCE AGENT ANALYSIS</span><h3>{selectedAnalysis.invoice_number} · {selectedAnalysis.vendor}</h3></div>
        <span className="analysis-category">{selectedAnalysis.analysis?.categorized_expense || selectedAnalysis.expense_category || 'General expenses'}</span>
        <p>Validated using backend invoice policies. Human approval is required; payment execution is disabled.</p>
        {selectedAnalysis.analysis?.warnings.length ? <ul>{selectedAnalysis.analysis.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : <p className="analysis-clear">No policy warnings were detected.</p>}
      </div>}
    </section>
  </>
}

function AuditPage({ audit }: { audit: AuditEvent[] }) {
  const [query, setQuery] = useState('')
  const [actorFilter, setActorFilter] = useState('all')
  const filteredAudit = audit.filter(event => {
    const haystack = `${event.action} ${event.detail} ${event.actor_id} ${event.workflow_id || ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (actorFilter === 'all' || event.actor_type === actorFilter)
  })
  return <><PageHeading eyebrow="PROVENANCE & CONTROL" title="Audit log" subtitle="A complete record of what happened, who acted, and why." action={<button className="button button-secondary" onClick={() => downloadCsv(filteredAudit)}><DownloadIcon /> Export log</button>} /><div className="audit-toolbar"><div className="search-field"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search audit events" /></div><select className="filter-button" value={actorFilter} onChange={event => setActorFilter(event.target.value)}><option value="all">All actors</option><option value="agent">Agents</option><option value="human">Human decisions</option><option value="system">System</option></select><span className="audit-result-count">{filteredAudit.length} events</span></div><div className="card audit-card"><div className="audit-table-head"><span>Event</span><span>Actor</span><span>Workflow</span><span>Status</span><span>Time</span></div>{filteredAudit.map(event => <div className="audit-row" key={event.id}><span className="audit-event"><span className={`audit-icon audit-${event.status}`}><Icon name={event.actor_id} size={14} /></span><span><b>{humanize(event.action)}</b><small>{event.detail}</small></span></span><span className="actor-tag"><AgentAvatar agent={event.actor_id} size="sm" />{event.actor_type === 'human' ? event.actor_id : agentName(event.actor_id)}</span><span className="audit-workflow">{event.workflow_id ? event.workflow_id.replace('wf_', '#') : 'System'}</span><StatusPill status={event.status === 'success' ? 'completed' : event.status} /><span className="audit-time">{timeAgo(event.created_at)}</span></div>)}</div></> }

function DownloadIcon() { return <FileText size={16} /> }

function AnalyticsPage({ analytics, onToast }: { analytics: Analytics | null; onToast: (message: string) => void }) {
  if (!analytics) return <LoadingState />
  const max = Math.max(1, ...analytics.volume.map(item => item.value))
  const taskTotal = analytics.by_agent.reduce((total, item) => total + item.value, 0)
  const ticks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0]
  return <><PageHeading eyebrow="OPERATIONS INTELLIGENCE" title="Analytics" subtitle="Aggregates are calculated from persisted workflow, task, and approval records." action={<button className="button button-secondary" disabled><Clock3 size={16} /> Last 7 days</button>} /><div className="analytics-grid"><div className="card volume-card"><div className="card-header"><div><span className="card-kicker">WORKFLOW VOLUME</span><h2>Requests created · last 7 days</h2></div></div><div className="big-chart"><div className="chart-y">{ticks.map((tick, index) => <span key={`${tick}-${index}`}>{tick}</span>)}</div><div className="chart-bars">{analytics.volume.map(item => <div className="bar-col" key={item.label}><span className="bar-value" style={{ height: `${(item.value / max) * 100}%` }} /><small>{item.label}</small></div>)}</div></div></div><div className="card distribution-card"><div className="card-header"><div><span className="card-kicker">TASK DISTRIBUTION</span><h2>By specialist</h2></div><BarChart3 size={18} /></div><div className="distribution-donut"><div className="donut-center"><b>{taskTotal}</b><small>tasks</small></div></div><div className="legend-list">{analytics.by_agent.map(item => <span key={item.label}><i style={{ background: item.color }} />{item.label}<b>{item.value}</b></span>)}</div></div><div className="card analytics-stat-card"><span className="card-kicker">HEALTH SNAPSHOT</span><div className="analytics-stat"><strong>{analytics.health.success_rate}%</strong><span>Success rate</span><small>completed workflows among resolved workflows</small></div><div className="analytics-stat"><strong>{analytics.health.avg_duration}</strong><span>Average duration</span><small>completed workflow records</small></div><div className="analytics-stat"><strong>{analytics.health.human_review_rate}%</strong><span>Human review rate</span><small>workflows with an approval record</small></div></div></div></>
}

function SettingsPage({ settings, save, onToast }: { settings: Preferences; save: (preferences: Partial<Preferences>) => Promise<void>; onToast: (message: string) => void }) {
  type Tab = 'Workspace' | 'Team & roles' | 'Agent permissions' | 'Data & retention' | 'Notifications'
  const [activeTab, setActiveTab] = useState<Tab>('Workspace')
  const [draft, setDraft] = useState<Preferences>(settings)
  useEffect(() => setDraft(settings), [settings])
  const tabs: [Tab, typeof Settings2][] = [['Workspace', Settings2], ['Team & roles', Users], ['Agent permissions', Bot], ['Data & retention', DatabaseZap], ['Notifications', Bell]]
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setDraft(current => ({ ...current, [key]: value }))
  const commit = async () => { await save(draft); onToast(`${activeTab} settings saved and applied.`) }
  const toggle = (key: keyof Preferences, label: string, detail: string) => <button className="preference-toggle" onClick={() => update(key, !draft[key])}><span><b>{label}</b><small>{detail}</small></span><span className={`switch ${draft[key] ? 'switch-on' : ''}`}><i /></span></button>
  return <><PageHeading eyebrow="WORKSPACE PREFERENCES" title="Settings" subtitle="Every control here is saved to your workspace and applied immediately." /><div className="settings-grid"><section className="card settings-nav">{tabs.map(([label, IconComp]) => <button key={label} className={`settings-tab ${activeTab === label ? 'active' : ''}`} onClick={() => setActiveTab(label)}><IconComp size={16} /> {label}</button>)}</section><section className="card settings-content"><div className="settings-panel-head"><div><span className="card-kicker">{activeTab.toUpperCase()}</span><h2>{activeTab} controls</h2></div><span className="saved-indicator"><i /> Saved to workspace</span></div>{activeTab === 'Workspace' && <><div className="settings-fields"><label>Workspace name<input value={draft.workspace_name} onChange={event => update('workspace_name', event.target.value)} /></label><label>Default approval role<select value={draft.default_approval_role} onChange={event => update('default_approval_role', event.target.value)}><option>Workspace manager</option><option>Finance admin</option><option>Operations lead</option></select></label></div><div className="preference-section"><span className="card-kicker">APPEARANCE</span><div className="appearance-options"><button className={`appearance-card ${draft.appearance === 'light' ? 'selected' : ''}`} onClick={() => update('appearance', 'light')}><span className="appearance-preview preview-light"><i /><i /><i /></span><b>Light canvas</b><small>Bright, focused workspace</small></button><button className={`appearance-card ${draft.appearance === 'dark' ? 'selected' : ''}`} onClick={() => update('appearance', 'dark')}><span className="appearance-preview preview-dark"><i /><i /><i /></span><b>Dark focus</b><small>Low-glare night workspace</small></button></div><label>Accent palette<select value={draft.accent} onChange={event => update('accent', event.target.value as Preferences['accent'])}><option value="aurora">Aurora — indigo, violet & rose</option><option value="ocean">Ocean — cobalt, cyan & mint</option><option value="sunset">Sunset — plum, coral & amber</option></select></label>{toggle('reduced_motion', 'Reduce motion', 'Keep transitions calm for focused work.')}</div></>}{activeTab === 'Team & roles' && <div className="preference-section"><span className="card-kicker">ACCESS POLICY</span><h3>Who can see and approve work?</h3><label>Workspace access<select value={draft.team_access} onChange={event => update('team_access', event.target.value)}><option>Members can view workspace activity</option><option>Members can view assigned work only</option><option>Admins only</option></select></label><label>Approval authority<select value={draft.default_approval_role} onChange={event => update('default_approval_role', event.target.value)}><option>Workspace manager</option><option>Finance admin</option><option>Operations lead</option></select></label><div className="role-callout"><Users size={18} /><span><b>Maya Chen · Workspace admin</b><small>Can approve sensitive actions and manage workspace preferences.</small></span><span className="role-badge">ADMIN</span></div></div>}{activeTab === 'Agent permissions' && <div className="preference-section"><span className="card-kicker">GUARDRAILS</span><h3>Define what agents may do</h3>{toggle('approval_guard', 'Human approval guard', 'Sensitive actions always pause before execution.')}{toggle('simulated_tools', 'Simulated enterprise tools', 'Keep accounts, equipment, email, and payments in preview mode.')}{toggle('parallel_plans', 'Parallel task planning', 'Let the Planner Agent run independent specialist work together.')}</div>}{activeTab === 'Data & retention' && <div className="preference-section"><span className="card-kicker">DATA GOVERNANCE</span><h3>Keep the workspace accountable</h3><label>Audit retention<select value={draft.retention_days} onChange={event => update('retention_days', Number(event.target.value))}><option value={90}>90 days</option><option value={365}>1 year</option><option value={730}>2 years</option><option value={3650}>10 years</option></select></label>{toggle('audit_logging', 'Audit logging', 'Record agent decisions, tool results, approvals, and transitions.')}</div>}{activeTab === 'Notifications' && <div className="preference-section"><span className="card-kicker">DELIVERY PREFERENCES</span><h3>Choose what reaches your team</h3>{toggle('approval_alerts', 'Approval alerts', 'Notify workspace approvers when a decision is waiting.')}{toggle('workflow_alerts', 'Workflow updates', 'Notify requesters when work completes or needs recovery.')}{toggle('weekly_digest', 'Weekly digest', 'Receive a weekly summary of automation and review activity.')}</div>}<div className="setting-section integration-section"><span className="card-kicker">INTEGRATIONS</span><h2>Connected tools</h2>{[['Email provider', Mail, 'Simulated preview mode'], ['Directory & access', ServerCog, 'Simulated enterprise tools'], ['Data store', DatabaseZap, 'SQLite demo persistence']].map(([name, Comp, detail]) => <button className="integration-row integration-button" key={name as string} onClick={() => onToast(`${name as string} is protected in ${(detail as string).toLowerCase()}.`)}>{(() => { const IconComponent = Comp as typeof Mail; return <span className="integration-icon"><IconComponent size={17} /></span> })()}<span><b>{name as string}</b><small>{detail as string}</small></span><span className="integration-status"><i />Configured</span><ChevronRight size={15} /></button>)}</div><div className="settings-save-row"><span><CheckCircle2 size={14} /> Changes apply to this workspace only.</span><button className="button button-primary" onClick={commit}><Check size={15} /> Save changes</button></div></section></div></>
}

function CreateWorkflowModal({ close, submit }: { close: () => void; submit: (request: string) => void }) { const [request, setRequest] = useState(DEMO_REQUEST); const handle = (event: FormEvent) => { event.preventDefault(); if (request.trim()) submit(request.trim()) }; return <div className="modal-backdrop" onMouseDown={close}><div className="create-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-header"><div><span className="card-kicker">NEW WORKFLOW</span><h2>What would you like to move forward?</h2><p>Describe the outcome in plain language. The Planner Agent will break it down.</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div><form onSubmit={handle}><div className="prompt-input-wrap"><Sparkles size={18} /><textarea value={request} onChange={event => setRequest(event.target.value)} rows={5} placeholder="e.g. Onboard a new employee named Rahul Kumar..." /><span>{request.length} / 500</span></div><div className="prompt-suggestions"><span>Supported demo flow</span><button type="button" onClick={() => setRequest(DEMO_REQUEST)}>Employee onboarding <ArrowRight size={13} /></button></div><div className="modal-foot"><span><LockKeyhole size={13} /> Sensitive actions pause for approval</span><div><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button type="submit" className="button button-primary"><Sparkles size={15} /> Generate plan <ArrowRight size={15} /></button></div></div></form></div></div> }

function EmployeeModal({ close, submit }: { close: () => void; submit: (payload: Omit<Employee, 'id' | 'status' | 'workflow_id' | 'created_at'>) => void }) {
  const [form, setForm] = useState({ name: '', department: 'Engineering', title: 'Software Engineer', joining_date: 'November 10, 2026' })
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  return <ActionModal title="Add employee" subtitle="Create an onboarding record for HR and the specialist agents." close={close}><form className="action-form" onSubmit={event => { event.preventDefault(); if (form.name.trim()) submit(form) }}><label>Full name<input required value={form.name} onChange={event => update('name', event.target.value)} placeholder="Rahul Kumar" /></label><label>Department<select value={form.department} onChange={event => update('department', event.target.value)}><option>Engineering</option><option>People Operations</option><option>Finance</option><option>IT</option><option>Design</option></select></label><label>Job title<input required value={form.title} onChange={event => update('title', event.target.value)} /></label><label>Joining date<input required value={form.joining_date} onChange={event => update('joining_date', event.target.value)} /></label><div className="modal-foot"><span>HR Agent will validate this record.</span><div><button type="button" className="button button-ghost" onClick={close}>Cancel</button><button className="button button-primary" type="submit"><UserPlus size={15} /> Create employee</button></div></div></form></ActionModal>
}

function InvoiceModal({ close, submit }: { close: () => void; submit: (payload: FormData) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [gst, setGst] = useState('')
  const subtotal = Number(amount)
  const gstRate = Number(gst || '0')
  const tax = Number.isFinite(subtotal) && subtotal > 0 && Number.isFinite(gstRate)
    ? (subtotal * gstRate / 100).toFixed(2)
    : ''
  const total = tax ? (subtotal + Number(tax)).toFixed(2) : ''
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const form = event.currentTarget
    const attachment = (form.elements.namedItem('attachment') as HTMLInputElement).files?.[0]
    if (attachment && attachment.size > 10 * 1024 * 1024) {
      setError('Invoice attachment must be 10 MB or smaller.')
      return
    }
    setBusy(true)
    try {
      await submit(new FormData(form))
    } finally {
      setBusy(false)
    }
  }
  return <ActionModal title="Submit invoice" subtitle="Finance Agent validates the invoice and routes a payment request to an authorized human. Payments are never executed." close={close}>
    <form className="action-form invoice-submit-form" onSubmit={event => void handleSubmit(event)}>
      <div className="invoice-form-grid">
        <label>Vendor name<input name="vendor" required minLength={2} maxLength={200} placeholder="Acme Cloud Services" /></label>
        <label>Vendor email<input name="vendor_email" type="email" maxLength={254} placeholder="accounts@vendor.com" /></label>
        <label>Invoice number<input name="invoice_number" required minLength={1} maxLength={100} placeholder="INV-2049" /></label>
        <label>Currency<select name="currency" defaultValue="INR"><option value="INR">INR</option><option value="USD">USD</option></select></label>
        <label>Invoice date<input name="invoice_date" type="date" required /></label>
        <label>Due date<input name="due_date" type="date" required /></label>
        <label>Invoice amount<input name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="12500.00" /></label>
        <label>GST percentage<input name="gst_percentage" type="number" min="0" max="100" step="0.01" value={gst} onChange={event => setGst(event.target.value)} placeholder="18" /></label>
        <label>Tax amount<input name="tax_amount" value={tax} readOnly placeholder="Calculated from GST" /></label>
        <label>Total amount<input name="total_amount" value={total} readOnly placeholder="Invoice amount plus tax" /></label>
        <label>Expense category<select name="expense_category" defaultValue=""><option value="">Auto-categorize</option><option>Software & cloud</option><option>Hardware & equipment</option><option>Travel</option><option>Marketing</option><option>Professional services</option><option>Utilities</option><option>Office supplies</option><option>People</option><option>General expenses</option></select></label>
        <label>Invoice attachment (PDF/JPG/PNG)<input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" /></label>
      </div>
      <label>Invoice description<textarea name="description" rows={3} maxLength={2000} placeholder="Describe the goods or services billed." /></label>
      <p className="invoice-form-note">Attachments are stored in a private Supabase Storage bucket. Maximum file size: 10 MB. Payment approval never triggers a real transfer.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="modal-foot"><span>Validation errors and review warnings are shown before approval.</span><div><button type="button" className="button button-ghost" onClick={close} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Validating invoice...' : <><FileCheck2 size={15} /> Analyze & request approval</>}</button></div></div>
    </form>
  </ActionModal>
}

function ActionModal({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={close}><div className="create-modal action-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-header"><div><span className="card-kicker">WORKFORCE ACTION</span><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>{children}</div></div> }

function CommandPalette({ close, go, create }: { close: () => void; go: (view: View) => void; create: () => void }) {
  const [query, setQuery] = useState('')
  const items: [string, string, View | 'create'][] = [['Overview', 'See current workforce health', 'dashboard'], ['Workflows', 'Inspect plans and task progress', 'workflows'], ['Approval center', 'Review sensitive actions', 'approvals'], ['Employees', 'Manage onboarding records', 'employees'], ['Finance', 'Submit invoice reviews', 'finance'], ['Audit log', 'Trace every agent action', 'audit'], ['Analytics', 'Explore workforce performance', 'analytics'], ['New workflow', 'Start from a natural-language request', 'create']]
  const filtered = items.filter(([label, description]) => `${label} ${description}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="modal-backdrop" onMouseDown={close}><div className="create-modal command-modal" onMouseDown={event => event.stopPropagation()}><div className="command-search"><Search size={18} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workspace actions..." /><kbd>ESC</kbd></div><div className="command-list">{filtered.map(([label, description, target]) => <button key={label} onClick={() => target === 'create' ? create() : (close(), go(target))}><span className="command-icon"><ArrowUpRight size={15} /></span><span><b>{label}</b><small>{description}</small></span><ChevronRight size={15} /></button>)}</div></div></div>
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: () => void }) { return <div className="empty-state"><span><Sparkles size={18} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="button button-secondary button-small" onClick={action}><Plus size={14} /> New workflow</button>}</div> }

function downloadCsv(events: AuditEvent[]) {
  const header = ['Event', 'Actor', 'Workflow', 'Status', 'Time', 'Detail']
  const rows = events.map(event => [humanize(event.action), event.actor_id, event.workflow_id || 'System', event.status, event.created_at, event.detail])
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'workforce-audit-log.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function timeAgo(value: string) { const date = new Date(value).getTime(); if (Number.isNaN(date)) return 'recently'; const minutes = Math.max(1, Math.round((Date.now() - date) / 60000)); if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}h ago`; return `${Math.round(hours / 24)}d ago` }
function formatDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function initials(name: string) { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() }
function agentName(id: string) { return AGENT_COPY[id]?.name || id }
function humanize(value: string) { return value.replace(/[._-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) }

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [booting, setBooting] = useState(true)
  useEffect(() => { const handler = () => setPath(window.location.pathname); window.addEventListener('popstate', handler); const timer = window.setTimeout(() => setBooting(false), 650); return () => { window.removeEventListener('popstate', handler); window.clearTimeout(timer) } }, [])
  const route = useMemo(() => viewFromPath(path), [path])
  if (booting) return <LaunchLoader />
  if (route.public && route.auth) return <AuthPage mode={route.auth} />
  if (route.public) return <Landing />
  return <Workspace initialView={route.view || 'dashboard'} />
}

function LaunchLoader() { return <div className="launch-loader"><span className="launch-orbit"><i /><i /><i /></span><h1>WorkForce <b>AI</b></h1><p>Orchestrating your workspace...</p><div className="launch-progress"><span /></div></div> }

createRoot(document.getElementById('root')!).render(<App />)
