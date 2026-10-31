export type AgentType = 
  | 'planner' 
  | 'hr' 
  | 'it' 
  | 'finance' 
  | 'communication' 
  | 'approval';

export type TaskStatus = 
  | 'pending' 
  | 'running' 
  | 'waiting_approval' 
  | 'completed' 
  | 'failed' 
  | 'rejected' 
  | 'skipped';

export type WorkflowStatus = 
  | 'pending' 
  | 'planning' 
  | 'running' 
  | 'waiting_approval' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'rejected';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentInfo {
  id: AgentType;
  name: string;
  role: string;
  description: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed';
  icon: string;
  color: string;
  responsibilities: string[];
  tools: {
    name: string;
    description: string;
    parameters: string;
    riskLevel: RiskLevel;
  }[];
  permissions: string[];
  completedTasks: number;
  failedTasks: number;
  lastActive: string;
}

export interface TaskDependency {
  id: string;
  title: string;
  agent: AgentType;
  tool: string;
  toolArgs?: Record<string, any>;
  status: TaskStatus;
  dependsOn?: string[];
  requiresApproval?: boolean;
  approvalId?: string;
  result?: any;
  error?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
}

export interface WorkflowSharedContext {
  employee?: {
    id?: string;
    name: string;
    email?: string;
    department: string;
    designation: string;
    joiningDate: string;
    manager?: string;
    salary?: number;
  };
  itRequest?: {
    id?: string;
    accounts?: string[];
    hardware?: string;
    accessLevel?: string;
    status?: string;
  };
  finance?: {
    invoiceId?: string;
    vendor?: string;
    amount?: number;
    currency?: string;
    isDuplicate?: boolean;
    paymentStatus?: string;
  };
  communication?: {
    welcomeEmailSubject?: string;
    welcomeEmailBody?: string;
    sentNotifications?: string[];
  };
  custom?: Record<string, any>;
}

export interface Workflow {
  id: string;
  title: string;
  originalRequest: string;
  requester: {
    name: string;
    email: string;
    role: string;
  };
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  executionPlan: string[];
  tasks: TaskDependency[];
  assignedAgents: AgentType[];
  sharedContext: WorkflowSharedContext;
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  activeApprovalId?: string;
  errorDetails?: string;
  finalResult?: string;
  auditLogIds: string[];
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  taskId: string;
  title: string;
  requestedAction: string;
  assignedAgent: AgentType;
  requester: string;
  reason: string;
  riskLevel: RiskLevel;
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, any>;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  workflowId?: string;
  agent?: AgentType;
  actor: string;
  action: string;
  details: string;
  metadata?: Record<string, any>;
  status: 'info' | 'success' | 'warning' | 'error';
  ipAddress?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string;
  status: 'Pending Onboarding' | 'Onboarding In Progress' | 'Active' | 'On Leave' | 'Terminated';
  manager: string;
  salary: number;
  avatarUrl?: string;
  equipmentAssigned?: string[];
  accountsCreated?: string[];
  createdAt: string;
}

export interface ITRequest {
  id: string;
  workflowId?: string;
  employeeName: string;
  employeeId?: string;
  type: 'Account Provisioning' | 'Hardware Allocation' | 'Software License' | 'Access Revocation';
  details: string;
  hardwareItem?: string;
  softwarePackages?: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'Pending' | 'Approved' | 'Provisioned' | 'Rejected';
  assignedEngineer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  status: 'Extracted' | 'Pending Approval' | 'Approved' | 'Paid' | 'Flagged Duplicate' | 'Rejected';
  isDuplicateFlag: boolean;
  duplicateMatchedWith?: string;
  ocrConfidence: number;
  approvalId?: string;
  createdAt: string;
}

export interface CommunicationRecord {
  id: string;
  workflowId?: string;
  recipient: string;
  recipientEmail: string;
  subject: string;
  channel: 'Email' | 'Slack' | 'System Notification';
  status: 'Draft' | 'Sent' | 'Failed';
  body: string;
  sentAt: string;
}

export interface UserRole {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'HR Lead' | 'IT Admin' | 'Finance Director' | 'Standard Employee';
  department: string;
  avatar: string;
}
