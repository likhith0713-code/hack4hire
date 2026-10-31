import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft, CheckCircle2, CircleAlert, FileCheck2, LoaderCircle, LockKeyhole,
  MessageSquare, Monitor, Pencil, RefreshCw, Send, ShieldCheck, Sparkles, Users,
} from 'lucide-react'

type Agent = {
  id: string
  name: string
  role: string
  description: string
  tasks: number
  success: number
  status: string
}
type Employee = {
  id: string
  name: string
  department: string
  title: string
  joining_date: string
  email?: string | null
  status: string
}
type Approval = {
  id: string
  title: string
  action: string
  requester: string
  status: string
  workflow_id: string
  requested_at: string
}
type Execution = {
  id: string
  title: string
  status: string
  result?: string | null
  started_at?: string | null
  completed_at?: string | null
}
type Notification = {
  id: string
  recipient: string
  subject: string
  body: string
  status: string
  created_at: string
}
type PaymentRequest = {
  id: string
  vendor: string
  invoice_number: string
  amount: string
  currency: string
  status: string
}
type PlannerPreview = {
  workflow_type: string
  summary: string
  mode: string
  warning?: string | null
  steps: { agent_id: string; title: string; description: string; requires_approval: boolean }[]
}
type WorkflowResult = {
  id: string
  title: string
  status: string
  approval?: { id: string; status: string } | null
}
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function request<T>(path: string, init?: RequestInit): Promise<T> {
  const endpoint = path.startsWith('/api') ? path.slice(4) : path
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  }).then(async response => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(`HTTP ${response.status}: ${payload.detail || response.statusText || 'Request failed'}`)
    }
    return response.json()
  })
}

const ACCESS_OPTIONS = ['Google Workspace', 'GitHub Enterprise', 'Linear', 'Slack', 'Notion']
const AGENT_ICONS: Record<string, typeof Sparkles> = {
  planner: Sparkles,
  hr: Users,
  it: Monitor,
  finance: FileCheck2,
  communication: MessageSquare,
  approval: ShieldCheck,
}

export default function AgentWorkspace({
  agent,
  onBack,
}: {
  agent: Agent
  onBack: () => void
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [messages, setMessages] = useState<Notification[]>([])
  const [payments, setPayments] = useState<PaymentRequest[]>([])
  const [preview, setPreview] = useState<PlannerPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState('')
  const busyRef = useRef(false)
  const approvalLocks = useRef(new Set<string>())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [requestText, setRequestText] = useState('')
  const [employeeForm, setEmployeeForm] = useState({ name: '', department: '', title: '', joining_date: '', email: '' })
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [access, setAccess] = useState<string[]>([])
  const [equipment, setEquipment] = useState('')
  const [invoice, setInvoice] = useState({ vendor: '', invoice_number: '', amount: '' })
  const [draft, setDraft] = useState({ recipient: '', subject: '', body: '' })
  const [editingDraft, setEditingDraft] = useState('')

  const loadWorkspace = async () => {
    setError('')
    try {
      const [nextExecutions] = await Promise.all([
        request<Execution[]>(`/api/agents/${agent.id}/executions?limit=20`),
      ])
      setExecutions(nextExecutions)
      if (agent.id === 'hr' || agent.id === 'it') {
        const nextEmployees = await request<Employee[]>('/api/employees')
        setEmployees(nextEmployees)
        if (!selectedEmployee && nextEmployees[0]) setSelectedEmployee(nextEmployees[0].id)
      }
      if (agent.id === 'approval') {
        setApprovals(await request<Approval[]>('/api/approvals/pending'))
      }
      if (agent.id === 'communication') {
        setMessages(await request<Notification[]>('/api/communications'))
      }
      if (agent.id === 'finance') {
        setPayments(await request<PaymentRequest[]>('/api/finance/payment-requests'))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load agent workspace.')
    }
  }

  useEffect(() => { void loadWorkspace() }, [agent.id])

  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await operation()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The agent operation failed.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const decideApproval = async (approvalId: string, decision: 'approved' | 'rejected') => {
    if (approvalLocks.current.has(approvalId)) return
    approvalLocks.current.add(approvalId)
    setBusyId(approvalId)
    setError('')
    setNotice('')
    try {
      await request(`/api/approvals/${approvalId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: decision === 'approved'
            ? 'Approved in the Approval Agent workspace.'
            : 'Rejected in the Approval Agent workspace.',
        }),
      })
      setNotice(decision === 'approved'
        ? 'Approval recorded and workflow resumed.'
        : 'Approval rejected; protected action was not resumed.')
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approval action failed.')
    } finally {
      approvalLocks.current.delete(approvalId)
      setBusyId('')
    }
  }

  const submitPlannerPreview = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      const result = await request<PlannerPreview>('/api/planner/preview', {
        method: 'POST',
        body: JSON.stringify({ request: requestText }),
      })
      setPreview(result)
      setNotice('Validated plan preview is ready. No workflow has been created yet.')
    })
  }

  const confirmPlanner = () => {
    void run(async () => {
      const workflow = await request<WorkflowResult>('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({ request: requestText }),
      })
      setPreview(null)
      setRequestText('')
      setNotice(`Workflow ${workflow.title} was created with status ${workflow.status}.`)
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const createEmployee = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await request<Employee>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(employeeForm),
      })
      setEmployeeForm({ name: '', department: '', title: '', joining_date: '', email: '' })
      setNotice('Employee record persisted.')
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const updateEmployee = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await request<Employee>(`/api/employees/${selectedEmployee}`, {
        method: 'PUT',
        body: JSON.stringify(employeeForm),
      })
      setNotice('Employee record updated.')
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const createItRequest = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      const workflow = await request<WorkflowResult>('/api/agents/it/requests', {
        method: 'POST',
        body: JSON.stringify({ employee_id: selectedEmployee, access, equipment }),
      })
      setAccess([])
      setEquipment('')
      setNotice(`Request persisted in workflow ${workflow.id}; manager approval is pending.`)
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const createInvoiceReview = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await request('/api/finance/reviews', {
        method: 'POST',
        body: JSON.stringify(invoice),
      })
      setInvoice({ vendor: '', invoice_number: '', amount: '' })
      setNotice('Invoice review and approval workflow persisted. No payment was executed.')
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const createDraft = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await request<Notification>('/api/communications/send', {
        method: 'POST',
        body: JSON.stringify(draft),
      })
      setDraft({ recipient: '', subject: '', body: '' })
      setNotice('Draft saved; it was not sent.')
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const saveDraft = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      await request<Notification>(`/api/communications/${editingDraft}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      })
      setEditingDraft('')
      setNotice('Draft updated; it was not sent.')
      await loadWorkspace()
      window.dispatchEvent(new Event('workforce:refresh'))
    })
  }

  const startEditing = (message: Notification) => {
    setEditingDraft(message.id)
    setDraft({ recipient: message.recipient, subject: message.subject, body: message.body })
  }

  const Icon = AGENT_ICONS[agent.id] || Sparkles
  return (
    <div className="agent-workspace">
      <PageTitle agent={agent} Icon={Icon} onBack={onBack} onReload={() => {
        void loadWorkspace()
        window.dispatchEvent(new Event('workforce:refresh'))
      }} />
      {error && <div className="agent-feedback agent-feedback-error" role="alert"><CircleAlert size={16} />{error}</div>}
      {notice && <div className="agent-feedback agent-feedback-success" role="status"><CheckCircle2 size={16} />{notice}</div>}
      <div className="agent-workspace-grid">
        <section className="card agent-operation-card">
          {agent.id === 'planner' && <form onSubmit={submitPlannerPreview} className="agent-form">
            <h2><Sparkles size={18} /> Plan a workflow</h2>
            <p>Preview the validated workflow steps before creating persistent workflow records.</p>
            <label>Describe the request<textarea required minLength={12} value={requestText} onChange={event => setRequestText(event.target.value)} placeholder="Onboard a new employee named Alex Morgan in the Engineering department, with a joining date of May 12, 2026." /></label>
            <button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Preview plan</button>
            {preview && <div className="planner-preview">
              <span className="card-kicker">{preview.workflow_type.replace(/_/g, ' ').toUpperCase()} · {preview.mode.replace(/_/g, ' ')}</span>
              <h3>{preview.summary}</h3>
              {preview.warning && <p className="agent-warning">{preview.warning}</p>}
              <ol>{preview.steps.map((step, index) => <li key={`${step.agent_id}-${index}`}><b>{step.title}</b><span>{step.description}</span>{step.requires_approval && <em>Human approval required</em>}</li>)}</ol>
              <button type="button" className="button button-primary" disabled={busy} onClick={confirmPlanner}><CheckCircle2 size={15} /> Confirm and create workflow</button>
            </div>}
          </form>}

          {agent.id === 'hr' && <div className="agent-form">
            <h2><Users size={18} /> Employee records</h2>
            <p>Create records or select an existing employee to update. Manager and contact-person fields are not present in the current database schema.</p>
            <form onSubmit={createEmployee}>
              <EmployeeFields value={employeeForm} setValue={setEmployeeForm} />
              <button className="button button-primary" disabled={busy}><Users size={15} /> Create employee</button>
            </form>
            <div className="agent-divider" />
            <form onSubmit={updateEmployee}>
              <label>Existing employee<select value={selectedEmployee} onChange={event => {
                setSelectedEmployee(event.target.value)
                const employee = employees.find(item => item.id === event.target.value)
                if (employee) setEmployeeForm({ name: employee.name, department: employee.department, title: employee.title, joining_date: employee.joining_date, email: employee.email || '' })
              }} required><option value="" disabled>Select employee</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.name} · {employee.department}</option>)}</select></label>
              <EmployeeFields value={employeeForm} setValue={setEmployeeForm} />
              <button className="button button-secondary" disabled={busy || !selectedEmployee}><Pencil size={14} /> Update employee</button>
            </form>
          </div>}

          {agent.id === 'it' && <form onSubmit={createItRequest} className="agent-form">
            <h2><Monitor size={18} /> Request access and equipment</h2>
            <p>Creates IT request records, a workflow, a pending approval and a PostgreSQL-backed LangGraph checkpoint. Provisioning stays simulated.</p>
            <label>Employee<select value={selectedEmployee} onChange={event => setSelectedEmployee(event.target.value)} required><option value="" disabled>Select employee</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.name} · {employee.department}</option>)}</select></label>
            <fieldset className="agent-checkboxes"><legend>Software access</legend>{ACCESS_OPTIONS.map(item => <label key={item}><input type="checkbox" checked={access.includes(item)} onChange={event => setAccess(value => event.target.checked ? [...value, item] : value.filter(entry => entry !== item))} />{item}</label>)}</fieldset>
            <label>Equipment request<input maxLength={120} value={equipment} onChange={event => setEquipment(event.target.value)} placeholder="e.g. Laptop" /></label>
            <button className="button button-primary" disabled={busy || !selectedEmployee || (!access.length && !equipment.trim())}><ShieldCheck size={15} /> Submit for approval</button>
          </form>}

          {agent.id === 'finance' && <form onSubmit={createInvoiceReview} className="agent-form">
            <h2><FileCheck2 size={18} /> Submit invoice review</h2>
            <p>Finance Agent validates the invoice and prepares an approval-gated payment request. Real payments are not supported.</p>
            <label>Vendor<input required minLength={2} value={invoice.vendor} onChange={event => setInvoice(value => ({ ...value, vendor: event.target.value }))} /></label>
            <label>Invoice number<input required minLength={2} value={invoice.invoice_number} onChange={event => setInvoice(value => ({ ...value, invoice_number: event.target.value }))} /></label>
            <label>Amount (INR)<input required inputMode="decimal" value={invoice.amount} onChange={event => setInvoice(value => ({ ...value, amount: event.target.value }))} placeholder="0.00" /></label>
            <p className="agent-schema-note">Invoice date, due date, description and document attachment are not stored by the current schema.</p>
            <button className="button button-primary" disabled={busy}><FileCheck2 size={15} /> Submit for approval</button>
            <div className="agent-divider" />
            <h3>Payment requests</h3>
            {payments.length ? <DataList rows={payments.map(payment => ({ title: `${payment.vendor} · ${payment.invoice_number}`, detail: `${payment.currency} ${payment.amount} · ${payment.status}` }))} /> : <p>No payment requests yet.</p>}
          </form>}

          {agent.id === 'communication' && <div className="agent-form">
            <h2><MessageSquare size={18} /> {editingDraft ? 'Edit draft' : 'Create communication draft'}</h2>
            <p>Draft content is persisted for review. This workspace never sends email.</p>
            <form onSubmit={editingDraft ? saveDraft : createDraft}>
              <label>Recipient<input required minLength={2} value={draft.recipient} onChange={event => setDraft(value => ({ ...value, recipient: event.target.value }))} /></label>
              <label>Subject<input required minLength={2} value={draft.subject} onChange={event => setDraft(value => ({ ...value, subject: event.target.value }))} /></label>
              <label>Message<textarea required minLength={2} value={draft.body} onChange={event => setDraft(value => ({ ...value, body: event.target.value }))} /></label>
              <div className="agent-form-actions"><button className="button button-primary" disabled={busy}><Send size={14} /> {editingDraft ? 'Save draft' : 'Save draft'}</button>{editingDraft && <button type="button" className="button button-ghost" onClick={() => { setEditingDraft(''); setDraft({ recipient: '', subject: '', body: '' }) }}>Cancel edit</button>}</div>
            </form>
            <div className="agent-divider" />
            <h3>Saved drafts</h3>
            {messages.length ? messages.map(message => <article className="agent-record" key={message.id}><div><b>{message.subject}</b><small>{message.recipient} · {message.status}</small><p>{message.body}</p></div>{message.status === 'draft_simulated' && <button type="button" className="icon-button" title="Edit draft" onClick={() => startEditing(message)}><Pencil size={14} /></button>}</article>) : <p>No saved drafts yet.</p>}
          </div>}

          {agent.id === 'approval' && <div className="agent-form">
            <h2><ShieldCheck size={18} /> Pending human decisions</h2>
            <p>Approval decisions resume the corresponding LangGraph checkpoint. Rejection blocks the protected action.</p>
            {approvals.length ? approvals.map(approval => <article className="agent-record" key={approval.id}>
              <div><b>{approval.title}</b><small>{approval.action}</small><small>Requested by {approval.requester} · {approval.workflow_id}</small></div>
              <div className="agent-form-actions">
                <button className="button button-danger-ghost" disabled={busyId === approval.id || busy} onClick={() => void decideApproval(approval.id, 'rejected')}>{busyId === approval.id ? 'Working...' : 'Reject'}</button>
                <button className="button button-primary" disabled={busyId === approval.id || busy} onClick={() => void decideApproval(approval.id, 'approved')}>{busyId === approval.id ? 'Working...' : 'Approve & resume'}</button>
              </div>
            </article>) : <EmptyState text="No approvals are waiting for a decision." />}
          </div>}
        </section>

        <aside className="card agent-side-card">
          <div className="agent-side-heading"><span className={`agent-avatar avatar-${agent.id}`}><Icon size={18} /></span><div><span className="card-kicker">LIVE DATABASE STATUS</span><h2>{agent.tasks} recorded tasks</h2></div></div>
          <div className="agent-side-stats"><span><small>Success rate</small><b>{agent.success ? `${agent.success}%` : 'Not enough data'}</b></span><span><small>Current status</small><b>{agent.status.replace(/_/g, ' ')}</b></span></div>
          <div className="agent-safety"><LockKeyhole size={15} /><span>External account provisioning, payments, and email delivery are not performed.</span></div>
          <div className="agent-divider" />
          <div className="agent-history-head"><h3>Recent executions</h3><button className="icon-button" title="Refresh executions" onClick={() => void loadWorkspace()}><RefreshCw size={14} /></button></div>
          {executions.length ? <DataList rows={executions.slice(0, 10).map(item => ({ title: item.title, detail: `${item.status}${item.result ? ` · ${item.result}` : ''}` }))} /> : <p className="agent-empty">No executions recorded yet.</p>}
          {agent.id === 'approval' && <p className="agent-schema-note">Older or externally created requests remain visible in the Approval Center after refresh.</p>}
        </aside>
      </div>
    </div>
  )
}

function PageTitle({ agent, Icon, onBack, onReload }: { agent: Agent; Icon: typeof Sparkles; onBack: () => void; onReload: () => void }) {
  return <div className="page-heading agent-workspace-title">
    <div><button className="agent-back-link" onClick={onBack}><ArrowLeft size={14} /> All agents</button><div className="eyebrow">{agent.role.toUpperCase()} · AGENT WORKSPACE</div><h1><Icon size={27} />{agent.name}</h1><p>{agent.description}</p></div>
    <button className="button button-secondary" onClick={onReload}><RefreshCw size={15} /> Refresh</button>
  </div>
}

function EmployeeFields({ value, setValue }: { value: { name: string; department: string; title: string; joining_date: string; email: string }; setValue: (value: { name: string; department: string; title: string; joining_date: string; email: string }) => void }) {
  const update = (key: keyof typeof value, next: string) => setValue({ ...value, [key]: next })
  return <div className="agent-field-grid">
    <label>Name<input required minLength={2} value={value.name} onChange={event => update('name', event.target.value)} /></label>
    <label>Department<input required minLength={2} value={value.department} onChange={event => update('department', event.target.value)} /></label>
    <label>Title<input required minLength={2} value={value.title} onChange={event => update('title', event.target.value)} /></label>
    <label>Joining date<input required value={value.joining_date} onChange={event => update('joining_date', event.target.value)} placeholder="e.g. May 12, 2026" /></label>
    <label>Email (optional)<input type="email" value={value.email} onChange={event => update('email', event.target.value)} /></label>
  </div>
}

function DataList({ rows }: { rows: { title: string; detail: string }[] }) {
  return <div className="agent-data-list">{rows.map((row, index) => <div key={`${row.title}-${index}`}><b>{row.title}</b><small>{row.detail}</small></div>)}</div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="agent-empty"><CircleAlert size={15} />{text}</div>
}
