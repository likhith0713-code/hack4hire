import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { tools } from './agent-tools.js';
import {
  AgentType,
  RiskLevel,
  TaskDependency,
  TaskStatus,
  Workflow,
  WorkflowStatus
} from '../types.js';

// Setup Gemini AI client if API key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

export type WorkflowEventType =
  | 'PLANNING_STARTED'
  | 'PLAN_GENERATED'
  | 'TASK_STARTED'
  | 'TASK_PROGRESS'
  | 'TOOL_CALLED'
  | 'TASK_COMPLETED'
  | 'WAITING_APPROVAL'
  | 'APPROVAL_RESOLVED'
  | 'TASK_FAILED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_REJECTED'
  | 'WORKFLOW_FAILED';

export interface WorkflowEvent {
  workflowId: string;
  type: WorkflowEventType;
  timestamp: string;
  agent?: AgentType;
  taskId?: string;
  message: string;
  data?: any;
}

export class AgentOrchestrator {
  private eventListeners = new Map<string, Set<(event: WorkflowEvent) => void>>();

  public subscribe(workflowId: string, listener: (event: WorkflowEvent) => void): () => void {
    if (!this.eventListeners.has(workflowId)) {
      this.eventListeners.set(workflowId, new Set());
    }
    this.eventListeners.get(workflowId)!.add(listener);

    return () => {
      const set = this.eventListeners.get(workflowId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.eventListeners.delete(workflowId);
        }
      }
    };
  }

  public emitEvent(event: WorkflowEvent) {
    const set = this.eventListeners.get(event.workflowId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (e) {
          console.error('Error in event listener:', e);
        }
      }
    }
  }

  /**
   * Plan request with Gemini AI or intelligent domain fallback
   */
  public async planWorkflow(requestPrompt: string, requester: { name: string; email: string; role: string }): Promise<Workflow> {
    const workflowId = `WF-${Date.now().toString().slice(-6)}`;
    const startTime = new Date().toISOString();

    db.addAuditLog({
      workflowId,
      agent: 'planner',
      actor: requester.name,
      action: 'WORKFLOW_INITIATED',
      details: `Initiated autonomous workflow: "${requestPrompt}"`,
      status: 'info'
    });

    let executionPlan: string[] = [];
    let tasks: TaskDependency[] = [];
    let assignedAgents: AgentType[] = ['planner'];
    let title = 'Enterprise Autonomous Operation';
    let isAiGenerated = false;

    // Check if Gemini can analyze and plan the request
    if (ai && process.env.GEMINI_API_KEY) {
      try {
        const prompt = `You are the central Planner Agent of WorkForce AI, an enterprise multi-agent operations platform.
Available Agents:
- "hr": Employee records, onboarding, validation, employee data
- "it": SSO accounts, laptop allocation, software licenses, access
- "finance": Invoice processing, payments, duplicate detection, salary reports
- "communication": Welcome emails, notifications, alerts
- "approval": Human-in-the-loop checkpoint for sensitive/high-risk actions

Analyze this user request:
"${requestPrompt}"

Decompose this into a structured JSON with:
1. "title": Short descriptive title (max 8 words)
2. "plan": Array of 4-7 natural language steps
3. "tasks": Array of task objects:
   - "id": string like "task-1", "task-2"
   - "title": concise task title
   - "agent": one of ["hr", "it", "finance", "communication", "approval"]
   - "tool": specific tool name
   - "toolArgs": object with parameters
   - "dependsOn": array of task ids this depends on
   - "requiresApproval": boolean (true if involves payment > $10,000, sensitive salary change, termination, or high-risk access)
   - "approvalReason": string explaining why human approval is required if requiresApproval is true

Respond ONLY with valid JSON.`;

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 4000)
        );
        const resp: any = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json'
            }
          }),
          timeoutPromise
        ]);

        const text = resp.text?.trim() || '{}';
        const parsed = JSON.parse(text);

        if (parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          title = parsed.title || 'Enterprise Multi-Agent Workflow';
          executionPlan = parsed.plan || [];
          tasks = parsed.tasks.map((t: any, index: number) => ({
            id: t.id || `task-${index + 1}`,
            title: t.title || `Task ${index + 1}`,
            agent: (['hr', 'it', 'finance', 'communication', 'approval'].includes(t.agent) ? t.agent : 'planner') as AgentType,
            tool: t.tool || 'execute_step',
            toolArgs: t.toolArgs || {},
            status: 'pending' as TaskStatus,
            dependsOn: t.dependsOn || (index > 0 ? [`task-${index}`] : []),
            requiresApproval: Boolean(t.requiresApproval),
            retryCount: 0,
            logs: []
          }));
          isAiGenerated = true;
        }
      } catch (err) {
        console.warn('Gemini planning encountered an issue, falling back to enterprise template engine:', err);
      }
    }

    // Fallback deterministic enterprise planner
    if (!isAiGenerated || tasks.length === 0) {
      const lower = requestPrompt.toLowerCase();

      if (lower.includes('invoice') || lower.includes('inv-') || lower.includes('payment') || lower.includes('bill')) {
        // Workflow 2: Invoice Processing Demo
        const invMatch = requestPrompt.match(/inv-?[0-9]+/i);
        const invoiceNum = invMatch ? invMatch[0].toUpperCase() : 'INV-1025';
        const amountMatch = requestPrompt.match(/(?:₹|\$|rs\.?|inr|usd)?\s?([0-9,]+(?:\.[0-9]+)?)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 50000;
        const vendor = lower.includes('abc') ? 'ABC Technologies' : 'CloudScale Infrastructure Ltd';

        title = `Invoice Processing: ${invoiceNum} (${vendor})`;
        executionPlan = [
          `Extract invoice parameters & scan OCR metadata for ${invoiceNum}`,
          'Validate vendor compliance and calculate tax breakdown',
          'Run duplicate invoice detection against historic transaction records',
          'Request Human-in-the-Loop manager approval for financial disbursement',
          'Execute simulated instant ACH payment batch settlement',
          'Send financial reconciliation confirmation to accounting team'
        ];

        tasks = [
          {
            id: 'task-1',
            title: `Extract & Validate Invoice Data (${invoiceNum})`,
            agent: 'finance',
            tool: 'validate_invoice',
            toolArgs: { invoiceNumber: invoiceNum, vendorName: vendor, amount, currency: lower.includes('₹') || lower.includes('inr') ? 'INR' : 'USD' },
            status: 'pending',
            dependsOn: [],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-2',
            title: 'Audit Duplicate Invoices & Vendor History',
            agent: 'finance',
            tool: 'detect_duplicate_invoice',
            toolArgs: { invoiceNumber: invoiceNum, vendorName: vendor, amount },
            status: 'pending',
            dependsOn: ['task-1'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-3',
            title: `Manager Sign-Off Checkpoint for ${invoiceNum}`,
            agent: 'approval',
            tool: 'create_approval_request',
            toolArgs: {
              title: `Disburse Payment for ${invoiceNum} (${vendor})`,
              amount,
              riskLevel: amount > 25000 ? 'high' : 'medium'
            },
            status: 'pending',
            dependsOn: ['task-2'],
            requiresApproval: true,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-4',
            title: 'Simulate Automated Corporate ACH Settlement',
            agent: 'finance',
            tool: 'simulate_payment',
            toolArgs: { invoiceNumber: invoiceNum, amount, vendorName: vendor },
            status: 'pending',
            dependsOn: ['task-3'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-5',
            title: 'Dispatch Payment Voucher & Financial Notification',
            agent: 'communication',
            tool: 'send_notification',
            toolArgs: { invoiceNumber: invoiceNum, vendorName: vendor, amount },
            status: 'pending',
            dependsOn: ['task-4'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          }
        ];
      } else {
        // Workflow 1: Employee Onboarding Demo
        const nameMatch = requestPrompt.match(/named?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        const employeeName = nameMatch ? nameMatch[1] : (lower.includes('rahul') ? 'Rahul Kumar' : 'Alex Mercer');
        const dept = lower.includes('design') ? 'Product Design' : (lower.includes('finance') ? 'Finance' : 'Engineering');
        const joiningDate = 'November 10, 2026';

        title = `Employee Onboarding: ${employeeName} (${dept})`;
        executionPlan = [
          `Analyze onboarding requirements and validate profile for ${employeeName}`,
          'Create primary employee record in enterprise HR directory',
          'Provision enterprise Okta SSO, Google Workspace and Slack credentials',
          'Allocate developer workstation (MacBook Pro M3) and configure MDM',
          'Generate and dispatch personalized executive welcome email',
          'Complete audit trail and publish directory updates'
        ];

        tasks = [
          {
            id: 'task-1',
            title: `Validate Candidate Info & Compliance (${employeeName})`,
            agent: 'hr',
            tool: 'validate_employee_data',
            toolArgs: { name: employeeName, department: dept },
            status: 'pending',
            dependsOn: [],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-2',
            title: `Create Employee Profile in HR Database`,
            agent: 'hr',
            tool: 'create_employee',
            toolArgs: { name: employeeName, department: dept, designation: 'Senior Software Engineer', joiningDate, salary: 140000 },
            status: 'pending',
            dependsOn: ['task-1'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-3',
            title: `Provision IT Accounts & SSO Credentials`,
            agent: 'it',
            tool: 'create_account_request',
            toolArgs: { employeeName, department: dept },
            status: 'pending',
            dependsOn: ['task-2'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-4',
            title: `Allocate Hardware (MacBook Pro M3 Max) & MDM Profile`,
            agent: 'it',
            tool: 'request_laptop',
            toolArgs: { employeeName, department: dept, model: 'Apple MacBook Pro 16" M3 Pro (36GB RAM)' },
            status: 'pending',
            dependsOn: ['task-2'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-5',
            title: `Human Approval: Finalize New Hire Package & Compensation`,
            agent: 'approval',
            tool: 'create_approval_request',
            toolArgs: {
              title: `Approve Onboarding Package for ${employeeName}`,
              employeeName,
              department: dept,
              riskLevel: 'medium'
            },
            status: 'pending',
            dependsOn: ['task-3', 'task-4'],
            requiresApproval: true,
            retryCount: 0,
            logs: []
          },
          {
            id: 'task-6',
            title: `Generate & Dispatch Welcome Email to ${employeeName}`,
            agent: 'communication',
            tool: 'generate_welcome_email',
            toolArgs: { employeeName, department: dept, joiningDate },
            status: 'pending',
            dependsOn: ['task-5'],
            requiresApproval: false,
            retryCount: 0,
            logs: []
          }
        ];
      }
    }

    assignedAgents = Array.from(new Set(['planner', ...tasks.map(t => t.agent)])) as AgentType[];

    const workflow: Workflow = {
      id: workflowId,
      title,
      originalRequest: requestPrompt,
      requester,
      status: 'planning',
      createdAt: startTime,
      updatedAt: startTime,
      executionPlan,
      tasks,
      assignedAgents,
      sharedContext: {},
      approvalStatus: tasks.some(t => t.requiresApproval) ? 'pending' : 'none',
      auditLogIds: []
    };

    db.workflows.unshift(workflow);

    db.addAuditLog({
      workflowId,
      agent: 'planner',
      actor: 'Planner Agent',
      action: 'WORKFLOW_DAG_CREATED',
      details: `Generated DAG with ${tasks.length} tasks assigned to [${assignedAgents.join(', ')}]. ${isAiGenerated ? 'Reasoning powered by Google Gemini 3.8 Flash.' : 'Reasoning generated via Enterprise Rule Engine.'}`,
      status: 'success',
      metadata: { taskCount: tasks.length, agents: assignedAgents, isAiGenerated }
    });

    return workflow;
  }

  /**
   * Execute state graph step by step
   */
  public async executeWorkflow(workflowId: string): Promise<Workflow> {
    const wf = db.workflows.find(w => w.id === workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);

    if (wf.status === 'completed' || wf.status === 'cancelled' || wf.status === 'rejected') {
      return wf;
    }

    wf.status = 'running';
    wf.updatedAt = new Date().toISOString();

    this.emitEvent({
      workflowId,
      type: 'TASK_STARTED',
      timestamp: new Date().toISOString(),
      agent: 'planner',
      message: `Planner Agent initialized execution loop for workflow ${wf.id}.`
    });

    // Loop through tasks that are ready to run
    let changed = true;
    while (changed) {
      changed = false;

      // Find pending tasks whose dependencies are completed
      const readyTasks = wf.tasks.filter(t => {
        if (t.status !== 'pending') return false;
        if (!t.dependsOn || t.dependsOn.length === 0) return true;
        return t.dependsOn.every(depId => {
          const depTask = wf.tasks.find(x => x.id === depId);
          return depTask && depTask.status === 'completed';
        });
      });

      for (const task of readyTasks) {
        // Check if this task requires human approval
        if (task.requiresApproval && task.status === 'pending') {
          task.status = 'waiting_approval';
          wf.status = 'waiting_approval';
          wf.approvalStatus = 'pending';

          // Set agent status
          const approvalAgent = db.agents.find(a => a.id === 'approval');
          if (approvalAgent) approvalAgent.status = 'waiting_approval';

          // Create approval record
          const riskLevel: RiskLevel = (task.toolArgs?.riskLevel as RiskLevel) || 'high';
          const approvalRes = await tools.executeCreateApprovalCheckpoint(
            {
              title: task.toolArgs?.title || task.title,
              requestedAction: `Authorize autonomous execution of: ${task.title}`,
              reason: task.toolArgs?.reason || `Sensitive enterprise operation requiring human verification.`,
              riskLevel,
              payload: { ...wf.sharedContext, ...task.toolArgs }
            },
            {
              workflowId: wf.id,
              taskId: task.id,
              agent: task.agent,
              actor: `${task.agent.toUpperCase()} Agent`
            }
          );

          task.approvalId = approvalRes.approvalId;
          wf.activeApprovalId = approvalRes.approvalId;

          this.emitEvent({
            workflowId,
            type: 'WAITING_APPROVAL',
            timestamp: new Date().toISOString(),
            agent: 'approval',
            taskId: task.id,
            message: `Execution halted at checkpoint. Human approval required for ${task.title}.`,
            data: { approvalId: approvalRes.approvalId }
          });

          // Stop loop until approved
          return wf;
        }

        // Execute task
        task.status = 'running';
        task.startedAt = new Date().toISOString();
        changed = true;

        this.emitEvent({
          workflowId,
          type: 'TASK_PROGRESS',
          timestamp: new Date().toISOString(),
          agent: task.agent,
          taskId: task.id,
          message: `${task.agent.toUpperCase()} Agent began execution: ${task.title}`
        });

        // Small simulation tick for realistic agent collaboration
        await new Promise(r => setTimeout(r, 600));

        try {
          const result = await this.executeTaskTool(wf, task);
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          task.result = result;

          // Update agent metrics
          const ag = db.agents.find(a => a.id === task.agent);
          if (ag) {
            ag.completedTasks += 1;
            ag.lastActive = 'Just now';
            ag.status = 'idle';
          }

          this.emitEvent({
            workflowId,
            type: 'TASK_COMPLETED',
            timestamp: new Date().toISOString(),
            agent: task.agent,
            taskId: task.id,
            message: `Completed ${task.title} successfully.`,
            data: result
          });
        } catch (err: any) {
          console.error(`Task ${task.id} failed:`, err);
          task.status = 'failed';
          task.error = err.message || 'Execution error';

          const ag = db.agents.find(a => a.id === task.agent);
          if (ag) {
            ag.failedTasks += 1;
            ag.status = 'failed';
          }

          this.emitEvent({
            workflowId,
            type: 'TASK_FAILED',
            timestamp: new Date().toISOString(),
            agent: task.agent,
            taskId: task.id,
            message: `Task failed: ${task.error}`,
            data: { error: task.error }
          });

          // Check retry policy
          if (task.retryCount < 2) {
            task.retryCount += 1;
            task.status = 'pending';
            task.logs.push(`Retrying task (attempt ${task.retryCount})...`);
            changed = true;
          } else {
            wf.status = 'failed';
            wf.errorDetails = `Task ${task.id} (${task.title}) failed after retries: ${task.error}`;
            return wf;
          }
        }
      }
    }

    // Check if all tasks are complete
    const allDone = wf.tasks.every(t => t.status === 'completed');
    if (allDone) {
      wf.status = 'completed';
      wf.completedAt = new Date().toISOString();
      const startMs = new Date(wf.createdAt).getTime();
      const endMs = new Date(wf.completedAt).getTime();
      wf.durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
      wf.finalResult = `Workflow completed successfully with ${wf.tasks.length} tasks executed by specialized agents [${wf.assignedAgents.join(', ')}]. All operations audited.`;

      db.addAuditLog({
        workflowId,
        agent: 'planner',
        actor: 'Planner Agent',
        action: 'WORKFLOW_COMPLETED',
        details: `Autonomous workflow completed in ${wf.durationSeconds}s.`,
        status: 'success'
      });

      this.emitEvent({
        workflowId,
        type: 'WORKFLOW_COMPLETED',
        timestamp: new Date().toISOString(),
        agent: 'planner',
        message: 'Workflow completed successfully.',
        data: { finalResult: wf.finalResult }
      });
    }

    return wf;
  }

  /**
   * Resume an approved workflow
   */
  public async resumeWorkflow(workflowId: string, approvalId: string, approved: boolean, reason?: string, reviewer?: string) {
    const wf = db.workflows.find(w => w.id === workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);

    const approval = db.approvals.find(a => a.id === approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found`);

    approval.status = approved ? 'approved' : 'rejected';
    approval.decidedAt = new Date().toISOString();
    approval.decidedBy = reviewer || 'Authorized Manager';
    approval.decisionReason = reason || (approved ? 'Authorized by human reviewer.' : 'Rejected by human reviewer.');

    const targetTask = wf.tasks.find(t => t.approvalId === approvalId || t.requiresApproval);

    if (approved) {
      wf.approvalStatus = 'approved';
      if (targetTask) {
        targetTask.status = 'completed';
        targetTask.completedAt = new Date().toISOString();
        targetTask.logs.push(`Approved by ${approval.decidedBy}: ${approval.decisionReason}`);
      }

      db.addAuditLog({
        workflowId,
        agent: 'approval',
        actor: approval.decidedBy,
        action: 'APPROVAL_DECIDED_APPROVED',
        details: `Human Manager APPROVED request "${approval.title}". Reason: ${approval.decisionReason}`,
        status: 'success',
        metadata: { approvalId, reviewer: approval.decidedBy }
      });

      this.emitEvent({
        workflowId,
        type: 'APPROVAL_RESOLVED',
        timestamp: new Date().toISOString(),
        agent: 'approval',
        message: `Approval granted by ${approval.decidedBy}. Resuming workflow execution...`,
        data: { approved: true }
      });

      // Continue execution
      return await this.executeWorkflow(workflowId);
    } else {
      wf.status = 'rejected';
      wf.approvalStatus = 'rejected';
      if (targetTask) {
        targetTask.status = 'rejected';
        targetTask.completedAt = new Date().toISOString();
        targetTask.logs.push(`REJECTED by ${approval.decidedBy}: ${approval.decisionReason}`);
      }

      db.addAuditLog({
        workflowId,
        agent: 'approval',
        actor: approval.decidedBy,
        action: 'APPROVAL_DECIDED_REJECTED',
        details: `Human Manager REJECTED request "${approval.title}". Reason: ${approval.decisionReason}. Workflow halted.`,
        status: 'warning',
        metadata: { approvalId, reviewer: approval.decidedBy }
      });

      this.emitEvent({
        workflowId,
        type: 'WORKFLOW_REJECTED',
        timestamp: new Date().toISOString(),
        agent: 'approval',
        message: `Workflow halted due to human rejection: ${approval.decisionReason}`,
        data: { approved: false }
      });

      return wf;
    }
  }

  /**
   * Helper to dispatch specific tool logic based on task
   */
  private async executeTaskTool(wf: Workflow, task: TaskDependency): Promise<any> {
    const ctx = {
      workflowId: wf.id,
      taskId: task.id,
      agent: task.agent,
      actor: `${task.agent.toUpperCase()} Agent`
    };

    switch (task.tool) {
      case 'create_employee': {
        const res = await tools.executeHrCreateEmployee(task.toolArgs as any, ctx);
        const empRecord = (res as any).employee || res;
        wf.sharedContext.employee = {
          id: (res as any).employeeId || empRecord.id,
          name: task.toolArgs?.name || empRecord.name || 'New Hire',
          email: res.email || empRecord.email,
          department: res.department || empRecord.department || 'Engineering',
          designation: res.designation || empRecord.designation || 'Software Engineer',
          joiningDate: res.joiningDate || empRecord.joiningDate || '2026-11-10',
          manager: res.manager || empRecord.manager
        };
        return res;
      }
      case 'validate_employee_data': {
        return await tools.executeHrValidateEmployee(task.toolArgs as any);
      }
      case 'create_account_request': {
        const empName = task.toolArgs?.employeeName || wf.sharedContext.employee?.name || 'Rahul Kumar';
        const empId = wf.sharedContext.employee?.id;
        const res = await tools.executeItRequestAccount({ employeeName: empName, employeeId: empId, department: task.toolArgs?.department }, ctx);
        wf.sharedContext.itRequest = {
          ...wf.sharedContext.itRequest,
          id: res.requestId,
          accounts: res.accounts,
          status: 'Accounts Configured'
        };
        return res;
      }
      case 'request_laptop': {
        const empName = task.toolArgs?.employeeName || wf.sharedContext.employee?.name || 'Rahul Kumar';
        const empId = wf.sharedContext.employee?.id;
        const res = await tools.executeItRequestLaptop({ employeeName: empName, employeeId: empId, department: task.toolArgs?.department, model: task.toolArgs?.model }, ctx);
        wf.sharedContext.itRequest = {
          ...wf.sharedContext.itRequest,
          hardware: res.hardwareModel,
          status: 'Provisioned'
        };
        return res;
      }
      case 'validate_invoice':
      case 'detect_duplicate_invoice': {
        const res = await tools.executeFinanceValidateInvoice(task.toolArgs as any, ctx);
        wf.sharedContext.finance = {
          invoiceId: res.invoiceNumber,
          vendor: res.vendorName,
          amount: res.amount,
          currency: res.currency,
          isDuplicate: res.isDuplicate,
          paymentStatus: res.status
        };
        return res;
      }
      case 'simulate_payment': {
        const invNum = task.toolArgs?.invoiceNumber || wf.sharedContext.finance?.invoiceId || 'INV-1025';
        const amount = task.toolArgs?.amount || wf.sharedContext.finance?.amount || 50000;
        const res = await tools.executeFinanceSimulatePayment({ invoiceNumber: invNum, amount }, ctx);
        if (wf.sharedContext.finance) {
          wf.sharedContext.finance.paymentStatus = 'Paid';
        }
        return res;
      }
      case 'generate_welcome_email': {
        const empName = task.toolArgs?.employeeName || wf.sharedContext.employee?.name || 'Rahul Kumar';
        const dept = task.toolArgs?.department || wf.sharedContext.employee?.department || 'Engineering';
        const joiningDate = task.toolArgs?.joiningDate || wf.sharedContext.employee?.joiningDate || 'November 10, 2026';
        const manager = wf.sharedContext.employee?.manager;
        const hardware = wf.sharedContext.itRequest?.hardware;
        const res = await tools.executeCommunicationWelcomeEmail({ employeeName: empName, department: dept, joiningDate, manager, hardware }, ctx);
        wf.sharedContext.communication = {
          welcomeEmailSubject: res.subject,
          welcomeEmailBody: res.preview,
          sentNotifications: [res.recipientEmail]
        };
        return res;
      }
      case 'send_notification': {
        return {
          delivered: true,
          channel: 'Email & Slack',
          timestamp: new Date().toISOString()
        };
      }
      default:
        return { executed: true, tool: task.tool };
    }
  }
}

export const orchestrator = new AgentOrchestrator();
