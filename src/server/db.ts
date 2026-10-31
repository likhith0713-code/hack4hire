import {
  AgentInfo,
  ApprovalRequest,
  AuditLog,
  CommunicationRecord,
  Employee,
  Invoice,
  ITRequest,
  Workflow
} from '../types.js';

export class EnterpriseDatabase {
  public agents: AgentInfo[] = [];
  public workflows: Workflow[] = [];
  public approvals: ApprovalRequest[] = [];
  public employees: Employee[] = [];
  public itRequests: ITRequest[] = [];
  public invoices: Invoice[] = [];
  public communications: CommunicationRecord[] = [];
  public auditLogs: AuditLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  public seedInitialData() {
    this.agents = [
      {
        id: 'planner',
        name: 'Planner Agent',
        role: 'Central Workflow Orchestrator & Task Decomposer',
        description: 'Analyzes natural language business requests, identifies intent, creates directed acyclic task graphs (DAG), assigns specialized agents, and monitors execution context.',
        status: 'idle',
        icon: 'BrainCircuit',
        color: 'from-blue-600 to-indigo-600',
        responsibilities: [
          'Parse natural language enterprise commands',
          'Decompose complex requests into sequential and parallel DAG tasks',
          'Identify task dependencies and prerequisites',
          'Delegate execution to specialized domain agents',
          'Maintain shared state and handle execution failures'
        ],
        tools: [
          { name: 'analyze_business_intent', description: 'Extracts entities, actions, and constraints from natural language prompt', parameters: 'prompt: string', riskLevel: 'low' },
          { name: 'generate_execution_dag', description: 'Constructs task dependency graph with agent assignments', parameters: 'intent: IntentModel', riskLevel: 'low' },
          { name: 'replan_on_failure', description: 'Recovers workflow by rerouting or retrying failed tasks', parameters: 'taskId: string, error: string', riskLevel: 'medium' }
        ],
        permissions: ['read:all', 'orchestrate:workflows', 'assign:tasks'],
        completedTasks: 142,
        failedTasks: 2,
        lastActive: 'Just now'
      },
      {
        id: 'hr',
        name: 'HR Agent',
        role: 'Employee Data & Onboarding Management',
        description: 'Manages employee records, validates compliance, tracks onboarding milestones, and coordinates departmental placement.',
        status: 'idle',
        icon: 'UserCheck',
        color: 'from-emerald-500 to-teal-700',
        responsibilities: [
          'Collect and validate employee profile information',
          'Create employee records with department and designation',
          'Track onboarding stages and joining date milestones',
          'Validate identity and enterprise compliance requirements'
        ],
        tools: [
          { name: 'create_employee', description: 'Creates new employee record in the enterprise database', parameters: 'name, email, department, role, joiningDate', riskLevel: 'medium' },
          { name: 'validate_employee_data', description: 'Checks required fields, email collision, and department validity', parameters: 'data: EmployeeData', riskLevel: 'low' },
          { name: 'update_onboarding_status', description: 'Progresses onboarding status from pending to active', parameters: 'id: string, status: string', riskLevel: 'low' },
          { name: 'get_employee', description: 'Retrieves employee details and assigned resources', parameters: 'id: string', riskLevel: 'low' }
        ],
        permissions: ['write:employees', 'read:departments', 'update:onboarding'],
        completedTasks: 98,
        failedTasks: 1,
        lastActive: '5m ago'
      },
      {
        id: 'it',
        name: 'IT Agent',
        role: 'Systems, Access & Equipment Provisioning',
        description: 'Automates workspace account creation, hardware allocation (MacBook/ThinkPad), VPN access, and software licensing.',
        status: 'idle',
        icon: 'Cpu',
        color: 'from-violet-600 to-purple-700',
        responsibilities: [
          'Process enterprise single sign-on (SSO) account requests',
          'Allocate laptops and accessories based on department specs',
          'Grant SaaS licenses (GitHub Enterprise, Slack, Google Workspace)',
          'Check equipment inventory and track deployment status'
        ],
        tools: [
          { name: 'create_account_request', description: 'Generates SSO, Google Workspace and Slack credentials', parameters: 'employeeId, email, department', riskLevel: 'medium' },
          { name: 'request_laptop', description: 'Reserves and configures laptop hardware from inventory', parameters: 'employeeId, hardwareModel, specs', riskLevel: 'medium' },
          { name: 'request_software_access', description: 'Assigns software licenses and role-based permissions', parameters: 'employeeId, packages: string[]', riskLevel: 'medium' },
          { name: 'check_equipment_availability', description: 'Queries IT warehouse stock for laptops and monitors', parameters: 'category: string', riskLevel: 'low' }
        ],
        permissions: ['provision:accounts', 'allocate:hardware', 'grant:licenses'],
        completedTasks: 116,
        failedTasks: 0,
        lastActive: '12m ago'
      },
      {
        id: 'finance',
        name: 'Finance Agent',
        role: 'Invoices, Payroll & Payment Verification',
        description: 'Processes supplier invoices, extracts line items via OCR, checks for duplicate invoices, verifies budget limits, and prepares payments.',
        status: 'idle',
        icon: 'ReceiptText',
        color: 'from-amber-500 to-orange-600',
        responsibilities: [
          'Process supplier invoices and parse OCR data',
          'Detect duplicate invoice submissions and anomalies',
          'Validate payment amounts against department budget limits',
          'Prepare simulated payment batches and payroll records'
        ],
        tools: [
          { name: 'validate_invoice', description: 'Validates invoice totals, tax calculations, and vendor validity', parameters: 'invoiceData: InvoiceInput', riskLevel: 'low' },
          { name: 'detect_duplicate_invoice', description: 'Cross-checks invoice number and amount against prior invoices', parameters: 'invoiceNumber: string, amount: number', riskLevel: 'medium' },
          { name: 'create_payment_request', description: 'Prepares payment request for manager or finance sign-off', parameters: 'invoiceId: string, amount: number', riskLevel: 'high' },
          { name: 'generate_finance_report', description: 'Summarizes department expenditure and pending liabilities', parameters: 'department: string', riskLevel: 'low' }
        ],
        permissions: ['read:invoices', 'write:payments', 'validate:finance', 'read:budgets'],
        completedTasks: 84,
        failedTasks: 1,
        lastActive: '2m ago'
      },
      {
        id: 'communication',
        name: 'Communication Agent',
        role: 'Enterprise Notifications & Email Dispatcher',
        description: 'Drafts personalized welcome emails, dispatches manager notifications, sends workflow completion summaries, and alerts on Slack.',
        status: 'idle',
        icon: 'MailCheck',
        color: 'from-pink-500 to-rose-600',
        responsibilities: [
          'Generate professional onboarding welcome emails',
          'Notify managers and approvers regarding pending actions',
          'Dispatch workflow milestone status alerts',
          'Provide communication templates and delivery auditing'
        ],
        tools: [
          { name: 'generate_welcome_email', description: 'Crafts tailored welcome email with joining schedule and contact details', parameters: 'employeeName, department, joiningDate, manager', riskLevel: 'low' },
          { name: 'send_notification', description: 'Sends email or Slack message with delivery tracking', parameters: 'recipient, subject, body, channel', riskLevel: 'low' },
          { name: 'notify_manager', description: 'Sends high-priority approval notification to designated manager', parameters: 'managerEmail, actionTitle, approvalLink', riskLevel: 'low' }
        ],
        permissions: ['send:email', 'send:notifications', 'read:templates'],
        completedTasks: 167,
        failedTasks: 0,
        lastActive: '1m ago'
      },
      {
        id: 'approval',
        name: 'Approval Agent',
        role: 'Human-in-the-Loop Security & Compliance Guard',
        description: 'Detects high-risk operations (salary changes, payments > threshold, admin IT access), pauses workflow execution, dispatches approval cards to human reviewers, and resumes upon authorized decision.',
        status: 'idle',
        icon: 'ShieldCheck',
        color: 'from-red-500 to-rose-700',
        responsibilities: [
          'Identify actions requiring explicit human authorization',
          'Enforce strict non-self-approval rule (agents cannot approve own actions)',
          'Pause and checkpoint workflow state safely',
          'Record reviewer decisions, rejection reasons, and audit timestamps'
        ],
        tools: [
          { name: 'create_approval_request', description: 'Creates approval checkpoint and halts workflow until resolved', parameters: 'workflowId, title, riskLevel, payload', riskLevel: 'high' },
          { name: 'evaluate_policy', description: 'Evaluates enterprise policy matrix against proposed action', parameters: 'actionType: string, amount?: number', riskLevel: 'low' },
          { name: 'verify_reviewer_authorization', description: 'Verifies human user has appropriate RBAC permissions', parameters: 'userRole: string, requiredRole: string', riskLevel: 'medium' }
        ],
        permissions: ['enforce:approvals', 'checkpoint:workflow', 'verify:rbac'],
        completedTasks: 52,
        failedTasks: 0,
        lastActive: 'Just now'
      }
    ];

    this.employees = [
      {
        id: 'EMP-1001',
        name: 'Priya Sharma',
        email: 'priya.sharma@workforce.ai',
        department: 'Engineering',
        designation: 'Staff Backend Engineer',
        joiningDate: '2026-08-15',
        status: 'Active',
        manager: 'Sarah Jenkins',
        salary: 135000,
        equipmentAssigned: ['Apple MacBook Pro 16" M3 Max', 'Dell UltraSharp 32" 4K Monitor'],
        accountsCreated: ['priya.sharma@workforce.ai (SSO)', 'github.com/workforce-corp', 'slack.workforce.ai'],
        createdAt: '2026-08-01T09:00:00Z'
      },
      {
        id: 'EMP-1002',
        name: 'David Miller',
        email: 'david.miller@workforce.ai',
        department: 'Finance',
        designation: 'Senior Financial Analyst',
        joiningDate: '2026-09-01',
        status: 'Active',
        manager: 'Amit Patel',
        salary: 110000,
        equipmentAssigned: ['Lenovo ThinkPad X1 Carbon Gen 12', 'Dual HP 27" Displays'],
        accountsCreated: ['david.miller@workforce.ai (SSO)', 'netsuite.workforce.ai', 'slack.workforce.ai'],
        createdAt: '2026-08-15T10:30:00Z'
      },
      {
        id: 'EMP-1003',
        name: 'Sarah Jenkins',
        email: 'sarah.jenkins@workforce.ai',
        department: 'Engineering',
        designation: 'Director of Platform Engineering',
        joiningDate: '2026-03-10',
        status: 'Active',
        manager: 'Executive VP',
        salary: 195000,
        equipmentAssigned: ['Apple MacBook Pro 14" M3 Pro', 'Studio Display'],
        accountsCreated: ['sarah.jenkins@workforce.ai (Admin SSO)', 'AWS Org Admin', 'GitHub Admin'],
        createdAt: '2026-02-20T08:00:00Z'
      },
      {
        id: 'EMP-1004',
        name: 'Amit Patel',
        email: 'amit.patel@workforce.ai',
        department: 'Finance',
        designation: 'Head of Financial Operations',
        joiningDate: '2026-01-15',
        status: 'Active',
        manager: 'Chief Financial Officer',
        salary: 180000,
        equipmentAssigned: ['Dell XPS 15 9530', 'Dell 34" Curved Monitor'],
        accountsCreated: ['amit.patel@workforce.ai (Finance Lead)', 'Stripe Corporate Admin'],
        createdAt: '2026-01-05T09:15:00Z'
      }
    ];

    this.itRequests = [
      {
        id: 'IT-REQ-801',
        employeeName: 'Priya Sharma',
        employeeId: 'EMP-1001',
        type: 'Hardware Allocation',
        details: 'Provision MacBook Pro 16" M3 Max + 32GB RAM for Staff Backend Engineer',
        hardwareItem: 'Apple MacBook Pro 16" M3 Max',
        softwarePackages: ['GitHub Enterprise', 'Docker Desktop', 'Datadog Agent', 'Slack Pro'],
        priority: 'high',
        status: 'Provisioned',
        assignedEngineer: 'Alex Thorne (IT Ops)',
        createdAt: '2026-08-02T10:00:00Z',
        updatedAt: '2026-08-03T14:20:00Z'
      },
      {
        id: 'IT-REQ-802',
        employeeName: 'David Miller',
        employeeId: 'EMP-1002',
        type: 'Account Provisioning',
        details: 'Provision NetSuite ERP access and SSO credentials',
        hardwareItem: 'Lenovo ThinkPad X1 Carbon Gen 12',
        softwarePackages: ['NetSuite ERP', 'Microsoft 365 E5', 'Slack Pro'],
        priority: 'medium',
        status: 'Provisioned',
        assignedEngineer: 'Alex Thorne (IT Ops)',
        createdAt: '2026-08-16T11:00:00Z',
        updatedAt: '2026-08-17T09:45:00Z'
      }
    ];

    this.invoices = [
      {
        id: 'INV-1024',
        invoiceNumber: 'INV-1024',
        vendorName: 'CloudScale Infrastructure Ltd',
        invoiceDate: '2026-10-15',
        dueDate: '2026-11-15',
        amount: 24500,
        currency: 'USD',
        category: 'Cloud Services',
        description: 'Monthly dedicated cloud compute clusters & Kubernetes node pools',
        status: 'Paid',
        isDuplicateFlag: false,
        ocrConfidence: 0.99,
        createdAt: '2026-10-16T08:00:00Z'
      },
      {
        id: 'INV-998',
        invoiceNumber: 'INV-998',
        vendorName: 'ABC Technologies',
        invoiceDate: '2026-09-10',
        dueDate: '2026-10-10',
        amount: 50000,
        currency: 'INR',
        category: 'Software Licensing',
        description: 'Quarterly developer productivity tool enterprise licenses',
        status: 'Paid',
        isDuplicateFlag: false,
        ocrConfidence: 0.98,
        createdAt: '2026-09-11T12:00:00Z'
      }
    ];

    this.approvals = [
      {
        id: 'APP-501',
        workflowId: 'WF-DEMO-01',
        taskId: 'task-payment-approval',
        title: 'Approve Payment Request: CloudScale Infrastructure ($24,500.00)',
        requestedAction: 'Disburse supplier invoice payment via automated ACH transfer',
        assignedAgent: 'approval',
        requester: 'Finance Agent (Autonomous Workflow WF-DEMO-01)',
        reason: 'Payment amount exceeds standard autonomous threshold of $10,000.00 USD.',
        riskLevel: 'high',
        status: 'approved',
        payload: { invoiceNumber: 'INV-1024', amount: 24500, currency: 'USD', vendor: 'CloudScale Infrastructure Ltd' },
        createdAt: '2026-10-16T08:30:00Z',
        decidedAt: '2026-10-16T10:15:00Z',
        decidedBy: 'Amit Patel (Head of Financial Operations)',
        decisionReason: 'Verified against Cloud Services SLA and department budget balance.'
      }
    ];

    this.communications = [
      {
        id: 'COMM-301',
        recipient: 'Priya Sharma',
        recipientEmail: 'priya.sharma@workforce.ai',
        subject: 'Welcome to the WorkForce AI Platform Engineering Team!',
        channel: 'Email',
        status: 'Sent',
        body: 'Dear Priya,\n\nWelcome to the Engineering team at WorkForce AI! Your manager Sarah Jenkins and your teammates are thrilled to have you join on August 15, 2026.\n\nYour hardware (Apple MacBook Pro 16" M3 Max) and corporate SSO credentials have been configured.\n\nBest regards,\nWorkForce AI Autonomous People Ops',
        sentAt: '2026-08-03T15:00:00Z'
      }
    ];

    this.auditLogs = [
      {
        id: 'AUD-101',
        timestamp: '2026-10-30T01:15:22Z',
        actor: 'Planner Agent',
        agent: 'planner',
        action: 'WORKFLOW_DAG_GENERATED',
        details: 'Planner Agent decomposed request "Onboard Priya Sharma" into 5 dependent subtasks.',
        status: 'info',
        ipAddress: '10.0.4.12'
      },
      {
        id: 'AUD-102',
        timestamp: '2026-10-30T01:15:24Z',
        actor: 'HR Agent',
        agent: 'hr',
        action: 'TOOL_EXECUTION: create_employee',
        details: 'Created employee profile for Priya Sharma with Staff Backend Engineer designation in Engineering.',
        status: 'success',
        ipAddress: '10.0.4.15'
      },
      {
        id: 'AUD-103',
        timestamp: '2026-10-30T01:15:26Z',
        actor: 'IT Agent',
        agent: 'it',
        action: 'TOOL_EXECUTION: request_laptop',
        details: 'Allocated hardware asset MacBook Pro 16" M3 Max to EMP-1001 with GitHub Enterprise access.',
        status: 'success',
        ipAddress: '10.0.4.18'
      },
      {
        id: 'AUD-104',
        timestamp: '2026-10-30T01:15:28Z',
        actor: 'Approval Agent',
        agent: 'approval',
        action: 'APPROVAL_CHECKPOINT_CLEARED',
        details: 'System validated that standard equipment allocation is within low-risk policy threshold.',
        status: 'info',
        ipAddress: '10.0.4.20'
      },
      {
        id: 'AUD-105',
        timestamp: '2026-10-30T01:15:30Z',
        actor: 'Communication Agent',
        agent: 'communication',
        action: 'TOOL_EXECUTION: generate_welcome_email',
        details: 'Dispatched personalized welcome email to priya.sharma@workforce.ai with onboarding itinerary.',
        status: 'success',
        ipAddress: '10.0.4.22'
      }
    ];

    this.workflows = [
      {
        id: 'WF-DEMO-01',
        title: 'Employee Onboarding: Priya Sharma (Staff Backend Engineer)',
        originalRequest: 'Onboard a new employee named Priya Sharma into the Engineering department starting August 15, 2026.',
        requester: {
          name: 'Sarah Jenkins',
          email: 'sarah.jenkins@workforce.ai',
          role: 'Director of Platform Engineering'
        },
        status: 'completed',
        createdAt: '2026-08-01T09:00:00Z',
        updatedAt: '2026-08-03T15:05:00Z',
        completedAt: '2026-08-03T15:05:00Z',
        durationSeconds: 4.8,
        executionPlan: [
          'Validate candidate information and compliance prerequisites',
          'Create primary employee record in HR database',
          'Provision single sign-on (SSO) credentials and allocate MacBook Pro M3',
          'Verify equipment availability and software license quotas',
          'Generate and deliver tailored onboarding welcome email',
          'Publish audit events and sync enterprise directory'
        ],
        tasks: [
          {
            id: 'task-1',
            title: 'Validate & Create Employee Record',
            agent: 'hr',
            tool: 'create_employee',
            toolArgs: { name: 'Priya Sharma', department: 'Engineering', designation: 'Staff Backend Engineer', joiningDate: '2026-08-15' },
            status: 'completed',
            retryCount: 0,
            startedAt: '2026-08-01T09:00:01Z',
            completedAt: '2026-08-01T09:00:02Z',
            result: { employeeId: 'EMP-1001', status: 'Created' },
            logs: ['Verified email uniqueness', 'Designation approved in Engineering budget', 'Created EMP-1001']
          },
          {
            id: 'task-2',
            title: 'Provision IT Credentials & Hardware',
            agent: 'it',
            tool: 'request_laptop',
            toolArgs: { employeeId: 'EMP-1001', hardware: 'Apple MacBook Pro 16" M3 Max' },
            status: 'completed',
            dependsOn: ['task-1'],
            retryCount: 0,
            startedAt: '2026-08-01T09:00:02Z',
            completedAt: '2026-08-01T09:00:03Z',
            result: { requestId: 'IT-REQ-801', hardwareStatus: 'Reserved' },
            logs: ['Reserved warehouse serial #MBP-M3-9021', 'Assigned GitHub Enterprise seat']
          },
          {
            id: 'task-3',
            title: 'Generate & Dispatch Welcome Email',
            agent: 'communication',
            tool: 'generate_welcome_email',
            toolArgs: { recipient: 'priya.sharma@workforce.ai' },
            status: 'completed',
            dependsOn: ['task-2'],
            retryCount: 0,
            startedAt: '2026-08-01T09:00:03Z',
            completedAt: '2026-08-01T09:00:04Z',
            result: { emailId: 'COMM-301', status: 'Delivered' },
            logs: ['Rendered welcome template', 'Sent notification to manager Sarah Jenkins']
          }
        ],
        assignedAgents: ['planner', 'hr', 'it', 'communication', 'approval'],
        sharedContext: {
          employee: {
            id: 'EMP-1001',
            name: 'Priya Sharma',
            email: 'priya.sharma@workforce.ai',
            department: 'Engineering',
            designation: 'Staff Backend Engineer',
            joiningDate: '2026-08-15',
            manager: 'Sarah Jenkins',
            salary: 135000
          },
          itRequest: {
            id: 'IT-REQ-801',
            hardware: 'Apple MacBook Pro 16" M3 Max',
            status: 'Provisioned'
          }
        },
        approvalStatus: 'approved',
        finalResult: 'Successfully completed autonomous onboarding pipeline. Employee record EMP-1001 created, IT equipment assigned, and welcome notification delivered.',
        auditLogIds: ['AUD-101', 'AUD-102', 'AUD-103', 'AUD-104', 'AUD-105']
      }
    ];
  }

  public addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(log);
    return log;
  }
}

export const db = new EnterpriseDatabase();
