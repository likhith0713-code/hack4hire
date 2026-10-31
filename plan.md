# WorkForce AI — Implementation Plan

## Product scope

WorkForce AI is a light-first enterprise operations control plane where a manager submits a natural-language request and a Planner Agent decomposes it into work for HR, IT, Finance, Communication, and Approval agents. The first complete vertical slice is employee onboarding: submit the Rahul Kumar request, generate a structured execution plan, pause sensitive provisioning behind a manager approval, resume the workflow after an approval decision, generate a welcome-email preview, and preserve the resulting workflow plus audit timeline.

The experience also includes a product landing page, workspace dashboard, workflow list/detail, approval center, agent directory, employees, finance, audit log, analytics, settings, dark mode, responsive navigation, and demo sign-in/create-account surfaces. The app is explicitly demo-safe: external accounts and payments are simulated, and communication falls back to preview/simulated send mode.

## Implementation approach

- **Frontend:** React 18 + TypeScript + Vite. A single responsive application shell uses view state and browser history for the named product areas, with a public landing page and a workspace mode. Lucide icons are used for consistent navigation and status affordances. Charts are rendered as lightweight SVG/CSS visuals so the demo remains dependency-light while preserving an analytics surface.
- **Backend:** FastAPI + Pydantic with REST endpoints under `/api`. SQLAlchemy and psycopg 3 connect to Supabase PostgreSQL through `DATABASE_URL`; Alembic manages the application schema and JSONB stores workflow/task context.
- **Workflow persistence:** LangGraph uses its PostgreSQL checkpointer with workflow IDs as stable thread IDs so approval interrupts survive API restarts.
- **Orchestration:** `api/main.py` models the Planner and specialist agents as explicit typed task assignments. The planner extracts an employee entity and creates dependent HR, IT, approval, and communication tasks. Approval decisions are backend actions that update the workflow and append immutable audit events. Task execution is idempotent through stable workflow/task IDs and safe updates.
- **Serving:** `uvicorn api.main:app` serves the compiled Vite output from `dist/` and exposes the API on port 3000. The development command builds the frontend before starting FastAPI, so the managed Preview has one listener and relative browser URLs.
- **Security posture:** the UI exposes demo role context and approval actions, while the backend validates that approval decisions include an authorized manager role. No real external accounts, payments, or unrestricted tool execution are performed.

## Design direction

Three candidate styles were considered: Precision Control Room (0.07), Soft Prism Enterprise (0.05), and Editorial Ops Ledger (0.08). The selected direction is **Soft Prism Enterprise**.

- **Design Movement:** premium B2B SaaS with glassmorphism restraint and a soft prism gradient vocabulary.
- **Core Principles:** calm clarity, operational confidence, visible provenance, and progressive disclosure.
- **Color Philosophy:** an off-white canvas keeps enterprise information legible; indigo is the ownable control color; lilac and aqua accents distinguish AI-generated context from human decisions; coral is reserved for risk and failure.
- **Layout Paradigm:** a persistent left rail anchors the workspace while wide content bands alternate between metric ribbons, execution timelines, and focused action panels instead of a dense grid of equal cards.
- **Signature Elements:** prism-gradient status dots, agent orbit rings, and approval cards with a clear human-decision boundary.
- **Interaction Philosophy:** every action returns a visible state change, and every sensitive action explains who must decide and why.
- **Animation:** short 180–260ms ease-out transitions, gentle hover elevation, a slow ambient gradient drift on the landing hero, and no distracting looping motion in the data-dense workspace.
- **Typography System:** Inter/system sans for compact operational reading, with oversized high-contrast display text on the landing page; uppercase eyebrow labels create hierarchy.
- **Brand Essence:** the operating layer for teams that want AI to move work forward without losing control; clear, composed, accountable.
- **Brand Voice:** direct, optimistic, and operational. Example lines: “Move work forward. Keep control.” and “Every agent action has a human-readable trail.”
- **Wordmark & Logo:** a compact four-node orbit mark beside the WorkForce AI wordmark, representing Planner, specialist agents, human approval, and completion.
- **Signature Brand Color:** Prism Indigo `#5B5BF7`, used only for primary controls and key orchestration signals.

## Project structure

```text
api/main.py              FastAPI app, PostgreSQL operations, seed data, orchestration endpoints
api/database.py          PostgreSQL engine, connection and schema metadata
alembic/                 Versioned PostgreSQL schema migrations
scripts/                 Repeat-safe SQLite-to-PostgreSQL data migration utility
src/main.tsx             React bootstrap and API-backed workspace UI
src/styles.css           Complete responsive light/dark visual system
public/manus-routes.json Managed route manifest for Preview/publishing
index.html               Vite HTML shell
app.config.ts            Project logo metadata
package.json             Frontend and serving scripts
Dockerfile               Production container path for FastAPI + built frontend
TODO.md                  Outcome-based delivery tracker
```

## Build workflow

1. Install pinned frontend dependencies with `npm install`.
2. Register TypeScript diagnostics through the managed Webdev runtime.
3. Build the React bundle into `dist/`.
4. Start FastAPI on `0.0.0.0:3000`, serving `dist/` and the REST API.
5. Verify API readiness, route manifest, frontend bundle, and type/build checks.
6. Commit the working application to the managed repository so it can be recovered as a checkpoint.
