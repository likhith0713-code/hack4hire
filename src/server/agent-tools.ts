import { db } from './db.js';
import { Employee, ITRequest, Invoice, CommunicationRecord, ApprovalRequest, RiskLevel, TaskDependency } from '../types.js';

export interface ToolExecutionContext {
  workflowId: string;
  taskId: string;
  agent: string;
  actor: string;
}

export class AgentToolRegistry {
  private executedIdempotencyKeys = new Set<string>();

  private getIdempotencyKey(toolName: string, workflowId: string, taskId: string): string {
    return `${workflowId}:${taskId}:${toolName}`;
  }

  // --- HR AGENT TOOLS ---
  public async executeHrCreateEmployee(
    args: { name: string; department?: string; designation?: string; joiningDate?: string; salary?: number; manager?: string },
    ctx: ToolExecutionContext
  ) {
    const key = this.getIdempotencyKey('create_employee', ctx.workflowId, ctx.taskId);
    if (this.executedIdempotencyKeys.has(key)) {
      const existing = db.employees.find(e => e.name.toLowerCase() === args.name.toLowerCase());
      return { status: 'already_executed', employee: existing };
    }

    const employeeId = `EMP-${1000 + db.employees.length + 1}`;
    const cleanEmail = `${args.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@workforce.ai`;
    const department = args.department || 'Engineering';
    const designation = args.designation || 'Software Engineer';
    const joiningDate = args.joiningDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    const salary = args.salary || 120000;
    const manager = args.manager || (department === 'Engineering' ? 'Sarah Jenkins' : 'Amit Patel');

    const newEmp: Employee = {
      id: employeeId,
      name: args.name,
      email: cleanEmail,
      department,
      designation,
      joiningDate,
      status: 'Pending Onboarding',
      manager,
      salary,
      equipmentAssigned: [],
      accountsCreated: [],
      createdAt: new Date().toISOString()
    };

    db.employees.unshift(newEmp);
    this.executedIdempotencyKeys.add(key);

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'hr',
      actor: 'HR Agent',
      action: 'HR_CREATE_EMPLOYEE',
      details: `Created new employee record ${employeeId} for ${args.name} in department ${department}.`,
      status: 'success',
      metadata: { employeeId, email: cleanEmail, department }
    });

    return {
      success: true,
      employeeId,
      email: cleanEmail,
      department,
      designation,
      joiningDate,
      manager
    };
  }

  public async executeHrValidateEmployee(args: { name: string; department?: string }) {
    if (!args.name || args.name.trim().length < 2) {
      throw new Error('Employee name is invalid or too short.');
    }
    const validDepts = ['Engineering', 'Finance', 'Product Design', 'Operations', 'Marketing', 'Sales'];
    const dept = args.department || 'Engineering';
    const isValidDept = validDepts.some(d => d.toLowerCase() === dept.toLowerCase());

    return {
      isValid: true,
      nameValidated: args.name.trim(),
      department: isValidDept ? dept : 'Engineering',
      compliancePassed: true,
      backgroundCheckPreApproved: true
    };
  }

  // --- IT AGENT TOOLS ---
  public async executeItRequestAccount(
    args: { employeeName: string; employeeId?: string; department?: string },
    ctx: ToolExecutionContext
  ) {
    const key = this.getIdempotencyKey('create_account_request', ctx.workflowId, ctx.taskId);
    if (this.executedIdempotencyKeys.has(key)) {
      return { status: 'already_executed', message: 'IT accounts already generated' };
    }

    const email = `${args.employeeName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@workforce.ai`;
    const accounts = [
      `${email} (Okta SSO)`,
      `github.com/${args.employeeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-workforce`,
      `slack.workforce.ai/@${args.employeeName.toLowerCase().replace(/[^a-z0-9]/g, '.')}`,
      `google-workspace.workforce.ai/${email}`
    ];

    const itReq: ITRequest = {
      id: `IT-REQ-${800 + db.itRequests.length + 1}`,
      workflowId: ctx.workflowId,
      employeeName: args.employeeName,
      employeeId: args.employeeId,
      type: 'Account Provisioning',
      details: `Automated SSO & developer credentials provisioning for ${args.employeeName} (${args.department || 'Engineering'})`,
      softwarePackages: ['Google Workspace Enterprise', 'Okta SSO', 'Slack Enterprise Grid', 'GitHub Enterprise'],
      priority: 'high',
      status: 'Provisioned',
      assignedEngineer: 'Autonomous IT Agent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.itRequests.unshift(itReq);
    this.executedIdempotencyKeys.add(key);

    // Update employee record if found
    const emp = db.employees.find(e => e.id === args.employeeId || e.name.toLowerCase() === args.employeeName.toLowerCase());
    if (emp) {
      emp.accountsCreated = accounts;
      emp.status = 'Onboarding In Progress';
    }

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'it',
      actor: 'IT Agent',
      action: 'IT_ACCOUNT_PROVISIONED',
      details: `Provisioned 4 enterprise accounts (Okta, Google Workspace, GitHub, Slack) for ${args.employeeName}.`,
      status: 'success',
      metadata: { requestId: itReq.id, accounts }
    });

    return {
      success: true,
      requestId: itReq.id,
      accounts,
      status: 'Provisioned'
    };
  }

  public async executeItRequestLaptop(
    args: { employeeName: string; employeeId?: string; department?: string; model?: string },
    ctx: ToolExecutionContext
  ) {
    const key = this.getIdempotencyKey('request_laptop', ctx.workflowId, ctx.taskId);
    if (this.executedIdempotencyKeys.has(key)) {
      return { status: 'already_executed', message: 'Laptop allocation already completed' };
    }

    const dept = (args.department || 'Engineering').toLowerCase();
    const hardwareModel = args.model || (dept.includes('eng') ? 'Apple MacBook Pro 16" M3 Pro (36GB RAM, 1TB SSD)' : 'Lenovo ThinkPad X1 Carbon Gen 12 (32GB RAM)');
    const serial = `WFA-${Math.floor(100000 + Math.random() * 900000)}`;

    const itReq: ITRequest = {
      id: `IT-REQ-${800 + db.itRequests.length + 1}`,
      workflowId: ctx.workflowId,
      employeeName: args.employeeName,
      employeeId: args.employeeId,
      type: 'Hardware Allocation',
      details: `Hardware provisioning: ${hardwareModel} (Serial: ${serial}) with zero-touch MDM enrollment`,
      hardwareItem: hardwareModel,
      priority: 'high',
      status: 'Provisioned',
      assignedEngineer: 'Autonomous IT Agent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.itRequests.unshift(itReq);
    this.executedIdempotencyKeys.add(key);

    const emp = db.employees.find(e => e.id === args.employeeId || e.name.toLowerCase() === args.employeeName.toLowerCase());
    if (emp) {
      emp.equipmentAssigned = [hardwareModel, 'Apple 140W USB-C Power Adapter', 'YubiKey 5C NFC Security Key'];
    }

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'it',
      actor: 'IT Agent',
      action: 'IT_LAPTOP_ALLOCATED',
      details: `Reserved and configured ${hardwareModel} (Serial: ${serial}) for ${args.employeeName}.`,
      status: 'success',
      metadata: { requestId: itReq.id, serial, hardware: hardwareModel }
    });

    return {
      success: true,
      requestId: itReq.id,
      hardwareModel,
      serialNumber: serial,
      status: 'Provisioned & MDM Configured'
    };
  }

  // --- FINANCE AGENT TOOLS ---
  public async executeFinanceValidateInvoice(
    args: { invoiceNumber: string; vendorName?: string; amount?: number; currency?: string },
    ctx: ToolExecutionContext
  ) {
    const amount = Number(args.amount) || 50000;
    const currency = args.currency || (args.invoiceNumber.startsWith('INV') ? 'INR' : 'USD');
    const vendorName = args.vendorName || 'ABC Technologies';

    // Duplicate detection check
    const duplicate = db.invoices.find(
      inv => inv.invoiceNumber.toLowerCase() === args.invoiceNumber.toLowerCase() ||
             (inv.vendorName.toLowerCase() === vendorName.toLowerCase() && inv.amount === amount && inv.status === 'Paid')
    );

    const isDuplicate = Boolean(duplicate);

    const invoice: Invoice = {
      id: args.invoiceNumber,
      invoiceNumber: args.invoiceNumber,
      vendorName,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      amount,
      currency,
      category: 'Software & Cloud Services',
      description: `Invoice ${args.invoiceNumber} from ${vendorName}`,
      status: isDuplicate ? 'Flagged Duplicate' : 'Pending Approval',
      isDuplicateFlag: isDuplicate,
      duplicateMatchedWith: duplicate ? duplicate.invoiceNumber : undefined,
      ocrConfidence: 0.985,
      createdAt: new Date().toISOString()
    };

    // If not existing, add to db
    const existingIndex = db.invoices.findIndex(i => i.invoiceNumber === args.invoiceNumber);
    if (existingIndex >= 0) {
      db.invoices[existingIndex] = invoice;
    } else {
      db.invoices.unshift(invoice);
    }

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'finance',
      actor: 'Finance Agent',
      action: 'FINANCE_INVOICE_VALIDATED',
      details: `Validated invoice ${args.invoiceNumber} for ${vendorName} with amount ${currency} ${amount.toLocaleString()}. Duplicate Check: ${isDuplicate ? 'DUPLICATE DETECTED!' : 'Clean'}.`,
      status: isDuplicate ? 'warning' : 'success',
      metadata: { invoiceNumber: args.invoiceNumber, amount, currency, isDuplicate }
    });

    return {
      success: true,
      invoiceNumber: args.invoiceNumber,
      vendorName,
      amount,
      currency,
      isDuplicate,
      matchedDuplicate: duplicate ? duplicate.invoiceNumber : null,
      ocrConfidence: 0.985,
      status: invoice.status
    };
  }

  public async executeFinanceSimulatePayment(
    args: { invoiceNumber: string; amount: number; currency?: string },
    ctx: ToolExecutionContext
  ) {
    const inv = db.invoices.find(i => i.invoiceNumber === args.invoiceNumber);
    if (inv) {
      inv.status = 'Paid';
    }

    const transactionRef = `TXN-ACH-${Math.floor(10000000 + Math.random() * 90000000)}`;

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'finance',
      actor: 'Finance Agent',
      action: 'FINANCE_PAYMENT_SIMULATED',
      details: `Simulated corporate ACH payment disbursement for ${args.invoiceNumber} (${args.currency || 'INR'} ${args.amount.toLocaleString()}). Reference: ${transactionRef}.`,
      status: 'success',
      metadata: { transactionRef, invoiceNumber: args.invoiceNumber, amount: args.amount }
    });

    return {
      success: true,
      transactionRef,
      invoiceNumber: args.invoiceNumber,
      disbursementStatus: 'Disbursed',
      settlementTime: 'Simulated Instant (ACH Tier-1)'
    };
  }

  // --- COMMUNICATION AGENT TOOLS ---
  public async executeCommunicationWelcomeEmail(
    args: { employeeName: string; department?: string; joiningDate?: string; manager?: string; hardware?: string },
    ctx: ToolExecutionContext
  ) {
    const email = `${args.employeeName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@workforce.ai`;
    const joiningDate = args.joiningDate || 'November 10, 2026';
    const dept = args.department || 'Engineering';
    const manager = args.manager || 'Sarah Jenkins';
    const hardware = args.hardware || 'Apple MacBook Pro 16" M3 Pro';

    const subject = `Welcome to WorkForce AI, ${args.employeeName}! Your Onboarding Itinerary`;
    const body = `Dear ${args.employeeName},

Welcome to the ${dept} team at WorkForce AI! We are thrilled to confirm your official start date on ${joiningDate}.

Here is an overview of what our autonomous multi-agent system has already coordinated for you:

1. Workplace Identity:
   - Primary Corporate Email: ${email}
   - Single Sign-On (Okta) and Google Workspace have been provisioned.

2. Hardware Allocation:
   - Asset: ${hardware}
   - Delivered with pre-enrolled security profiles and YubiKey NFC token.

3. Team Connection:
   - Reporting Manager: ${manager} (${manager.toLowerCase().replace(/[^a-z0-9]/g, '.')}@workforce.ai)
   - First day orientation kick-off: 09:30 AM via Google Meet.

If you have any questions ahead of your start date, please reach out directly to your manager or our autonomous people operations desk.

Warm regards,
WorkForce AI Autonomous Enterprise Operations`;

    const record: CommunicationRecord = {
      id: `COMM-${300 + db.communications.length + 1}`,
      workflowId: ctx.workflowId,
      recipient: args.employeeName,
      recipientEmail: email,
      subject,
      channel: 'Email',
      status: 'Sent',
      body,
      sentAt: new Date().toISOString()
    };

    db.communications.unshift(record);

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'communication',
      actor: 'Communication Agent',
      action: 'COMMUNICATION_WELCOME_EMAIL_SENT',
      details: `Generated and dispatched personalized welcome email to ${email} (Subject: "${subject}").`,
      status: 'success',
      metadata: { emailId: record.id, recipientEmail: email }
    });

    return {
      success: true,
      emailId: record.id,
      recipientEmail: email,
      subject,
      preview: body
    };
  }

  // --- APPROVAL AGENT TOOLS ---
  public async executeCreateApprovalCheckpoint(
    args: { title: string; requestedAction: string; reason: string; riskLevel: RiskLevel; payload: Record<string, any> },
    ctx: ToolExecutionContext
  ) {
    const approvalId = `APP-${500 + db.approvals.length + 1}`;
    const approval: ApprovalRequest = {
      id: approvalId,
      workflowId: ctx.workflowId,
      taskId: ctx.taskId,
      title: args.title,
      requestedAction: args.requestedAction,
      assignedAgent: 'approval',
      requester: `${ctx.agent.toUpperCase()} Agent (Workflow ${ctx.workflowId})`,
      reason: args.reason,
      riskLevel: args.riskLevel,
      status: 'pending',
      payload: args.payload,
      createdAt: new Date().toISOString()
    };

    db.approvals.unshift(approval);

    db.addAuditLog({
      workflowId: ctx.workflowId,
      agent: 'approval',
      actor: 'Approval Agent',
      action: 'HUMAN_APPROVAL_CHECKPOINT_CREATED',
      details: `Workflow execution paused. Created human approval request ${approvalId} [Risk: ${args.riskLevel.toUpperCase()}]: "${args.title}".`,
      status: 'warning',
      metadata: { approvalId, riskLevel: args.riskLevel }
    });

    return {
      requiresApproval: true,
      approvalId,
      status: 'pending',
      riskLevel: args.riskLevel,
      instructions: 'Execution is suspended until an authorized human manager reviews and approves this action in the Approval Center.'
    };
  }
}

export const tools = new AgentToolRegistry();
