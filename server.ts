import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './src/server/db.js';
import { orchestrator } from './src/server/agent-engine.js';
import { tools } from './src/server/agent-tools.js';
import { ITRequest } from './src/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Mock authenticated user session
  let currentUser = {
    id: 'USR-ADMIN',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@workforce.ai',
    role: 'Administrator',
    department: 'Engineering',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  };

  // --- AUTH ROUTES ---
  app.get('/api/auth/me', (req: Request, res: Response) => {
    res.json(currentUser);
  });

  app.post('/api/auth/switch-role', (req: Request, res: Response) => {
    const { role } = req.body;
    if (role) {
      currentUser = {
        ...currentUser,
        role,
        name: role === 'Finance Director' ? 'Amit Patel' : role === 'HR Lead' ? 'Elena Rostova' : role === 'IT Admin' ? 'Alex Thorne' : 'Sarah Jenkins'
      };
    }
    res.json(currentUser);
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email } = req.body;
    res.json({
      success: true,
      token: 'mock-jwt-token-workforce-ai',
      user: {
        ...currentUser,
        email: email || currentUser.email
      }
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, department } = req.body;
    currentUser = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      name: name || 'Demo Manager',
      email: email || 'demo@workforce.ai',
      role: 'Manager',
      department: department || 'Engineering',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    };
    res.json({ success: true, user: currentUser });
  });

  // --- AGENTS ROUTES ---
  app.get('/api/agents', (req: Request, res: Response) => {
    res.json(db.agents);
  });

  app.get('/api/agents/:id', (req: Request, res: Response) => {
    const agent = db.agents.find(a => a.id === req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const executions = db.auditLogs.filter(log => log.agent === agent.id);
    res.json({ agent, executions });
  });

  // --- WORKFLOW ROUTES ---
  app.get('/api/workflows', (req: Request, res: Response) => {
    const { status, search } = req.query;
    let list = [...db.workflows];

    if (status && status !== 'all') {
      list = list.filter(w => w.status === status);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(w => w.title.toLowerCase().includes(q) || w.originalRequest.toLowerCase().includes(q));
    }

    res.json(list);
  });

  app.get('/api/workflows/:id', (req: Request, res: Response) => {
    const wf = db.workflows.find(w => w.id === req.params.id);
    if (!wf) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const logs = db.auditLogs.filter(l => l.workflowId === wf.id);
    const approvals = db.approvals.filter(a => a.workflowId === wf.id);
    res.json({ workflow: wf, logs, approvals });
  });

  // Initiate new workflow from prompt
  app.post('/api/workflows', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Step 1: Planner Agent plans the workflow DAG
      const workflow = await orchestrator.planWorkflow(prompt, {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      });

      // Step 2: Begin asynchronous autonomous execution
      setTimeout(async () => {
        try {
          await orchestrator.executeWorkflow(workflow.id);
        } catch (err) {
          console.error('Error executing workflow loop:', err);
        }
      }, 500);

      res.status(201).json(workflow);
    } catch (err: any) {
      console.error('Workflow creation error:', err);
      res.status(500).json({ error: err.message || 'Failed to create workflow' });
    }
  });

  // SSE Stream for live workflow execution
  app.get('/api/workflows/:id/stream', (req: Request, res: Response) => {
    const { id } = req.params;
    const wf = db.workflows.find(w => w.id === id);

    if (!wf) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ type: 'SNAPSHOT', workflow: wf })}\n\n`);

    // Subscribe to orchestrator events
    const unsubscribe = orchestrator.subscribe(id, event => {
      const currentWf = db.workflows.find(w => w.id === id);
      res.write(`data: ${JSON.stringify({ event, workflow: currentWf })}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  });

  // Cancel workflow
  app.post('/api/workflows/:id/cancel', (req: Request, res: Response) => {
    const wf = db.workflows.find(w => w.id === req.params.id);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });

    wf.status = 'cancelled';
    wf.updatedAt = new Date().toISOString();

    db.addAuditLog({
      workflowId: wf.id,
      actor: currentUser.name,
      action: 'WORKFLOW_CANCELLED',
      details: `User ${currentUser.name} manually cancelled workflow ${wf.id}.`,
      status: 'warning'
    });

    res.json({ success: true, workflow: wf });
  });

  // Retry failed workflow
  app.post('/api/workflows/:id/retry', async (req: Request, res: Response) => {
    const wf = db.workflows.find(w => w.id === req.params.id);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });

    // Reset failed tasks to pending
    for (const t of wf.tasks) {
      if (t.status === 'failed') {
        t.status = 'pending';
        t.retryCount = 0;
        t.error = undefined;
      }
    }
    wf.status = 'running';
    wf.updatedAt = new Date().toISOString();

    db.addAuditLog({
      workflowId: wf.id,
      actor: currentUser.name,
      action: 'WORKFLOW_RETRIED',
      details: `User ${currentUser.name} requested retry for workflow ${wf.id}.`,
      status: 'info'
    });

    setTimeout(async () => {
      await orchestrator.executeWorkflow(wf.id);
    }, 200);

    res.json({ success: true, workflow: wf });
  });

  // --- APPROVALS ROUTES ---
  app.get('/api/approvals', (req: Request, res: Response) => {
    const { status } = req.query;
    let list = [...db.approvals];
    if (status && status !== 'all') {
      list = list.filter(a => a.status === status);
    }
    res.json(list);
  });

  app.post('/api/approvals/:id/decide', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { approved, reason } = req.body;
      const approval = db.approvals.find(a => a.id === id);

      if (!approval) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      const wf = await orchestrator.resumeWorkflow(
        approval.workflowId,
        id,
        Boolean(approved),
        reason,
        currentUser.name
      );

      res.json({ success: true, approval, workflow: wf });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to process approval' });
    }
  });

  // --- EMPLOYEES ROUTES ---
  app.get('/api/employees', (req: Request, res: Response) => {
    res.json(db.employees);
  });

  app.post('/api/employees', async (req: Request, res: Response) => {
    const { name, department, designation, joiningDate, salary, manager } = req.body;
    const resEmp = await tools.executeHrCreateEmployee(
      { name, department, designation, joiningDate, salary, manager },
      {
        workflowId: 'MANUAL',
        taskId: 'MANUAL',
        agent: 'hr',
        actor: currentUser.name
      }
    );
    res.status(201).json(resEmp);
  });

  // --- IT REQUESTS ROUTES ---
  app.get('/api/it/requests', (req: Request, res: Response) => {
    res.json(db.itRequests);
  });

  app.post('/api/it/requests', (req: Request, res: Response) => {
    const { employeeName, type, details, priority, hardwareItem } = req.body;
    const reqItem: ITRequest = {
      id: `IT-REQ-${800 + db.itRequests.length + 1}`,
      employeeName: employeeName || 'New Hire',
      type: type || 'Hardware Allocation',
      details: details || 'Manual IT Provisioning Request',
      hardwareItem: hardwareItem || 'MacBook Pro 16" M3',
      priority: priority || 'medium',
      status: 'Pending',
      assignedEngineer: 'Alex Thorne (IT Ops)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.itRequests.unshift(reqItem);
    res.status(201).json(reqItem);
  });

  // --- FINANCE ROUTES ---
  app.get('/api/finance/invoices', (req: Request, res: Response) => {
    res.json(db.invoices);
  });

  app.post('/api/finance/invoices/upload', async (req: Request, res: Response) => {
    const { invoiceNumber, vendorName, amount, currency } = req.body;
    const result = await tools.executeFinanceValidateInvoice(
      {
        invoiceNumber: invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        vendorName: vendorName || 'Acme Vendor',
        amount: Number(amount) || 12500,
        currency: currency || 'USD'
      },
      {
        workflowId: 'INVOICE_UPLOAD',
        taskId: 'MANUAL',
        agent: 'finance',
        actor: currentUser.name
      }
    );
    res.json(result);
  });

  // --- COMMUNICATIONS ROUTES ---
  app.get('/api/communications', (req: Request, res: Response) => {
    res.json(db.communications);
  });

  app.post('/api/communications/send', (req: Request, res: Response) => {
    const { recipient, recipientEmail, subject, body, channel } = req.body;
    const comm = {
      id: `COMM-${300 + db.communications.length + 1}`,
      recipient: recipient || 'Employee',
      recipientEmail: recipientEmail || 'employee@workforce.ai',
      subject: subject || 'Operational Notification',
      body: body || 'Workflow notification body.',
      channel: channel || 'Email',
      status: 'Sent' as const,
      sentAt: new Date().toISOString()
    };
    db.communications.unshift(comm);
    res.status(201).json(comm);
  });

  // --- AUDIT LOGS ROUTES ---
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const { agent, status, search } = req.query;
    let list = [...db.auditLogs];

    if (agent && agent !== 'all') {
      list = list.filter(l => l.agent === agent);
    }
    if (status && status !== 'all') {
      list = list.filter(l => l.status === status);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(l => l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q) || l.actor.toLowerCase().includes(q));
    }

    res.json(list);
  });

  // --- ANALYTICS ROUTES ---
  app.get('/api/analytics/overview', (req: Request, res: Response) => {
    const totalWorkflows = db.workflows.length;
    const completedWorkflows = db.workflows.filter(w => w.status === 'completed').length;
    const activeWorkflows = db.workflows.filter(w => ['running', 'planning', 'waiting_approval'].includes(w.status)).length;
    const pendingApprovals = db.approvals.filter(a => a.status === 'pending').length;
    const failedTasks = db.agents.reduce((acc, a) => acc + a.failedTasks, 0);

    const agentDistribution = db.agents.map(a => ({
      name: a.name,
      agentId: a.id,
      completed: a.completedTasks,
      failed: a.failedTasks,
      total: a.completedTasks + a.failedTasks,
      color: a.color
    }));

    res.json({
      metrics: {
        totalWorkflows,
        completedWorkflows,
        activeWorkflows,
        pendingApprovals,
        failedTasks,
        activeAgents: db.agents.length,
        completionRate: totalWorkflows > 0 ? Math.round((completedWorkflows / totalWorkflows) * 100) : 100,
        avgDurationSec: 4.2
      },
      agentDistribution,
      recentActivity: db.auditLogs.slice(0, 10)
    });
  });

  // Reset database to initial seed state
  app.post('/api/system/reset-demo', (req: Request, res: Response) => {
    db.seedInitialData();
    res.json({ success: true, message: 'Enterprise demo database reset successfully' });
  });

  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WorkForce AI server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
