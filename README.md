# TekForge

TekForge is a developer self-service CI/CD control plane built around Tekton on Kubernetes.

The product direction is now **agent-first**: users connect AWS EKS, GCP GKE, Azure AKS, on-prem or local Kubernetes by installing a lightweight TekForge Agent inside the cluster. The control plane uses the agent for cluster inventory, Tekton execution, deployment telemetry and health without requiring direct inbound access to the Kubernetes API.

## User experience

```text
Connect Kubernetes cluster
      ↓
Install TekForge Agent
      ↓
Agent heartbeat + cluster discovery
      ↓
Connect Git repository
      ↓
TekForge analyzes the codebase
      ↓
Recommended pipeline generated
      ↓
Visual Pipeline Studio
      ↓
Git → Build → Test → Security → Image → Deploy
      ↓
Compile visual graph → Tekton resources
      ↓
Live PipelineRun / TaskRun / logs / events
      ↓
Deployment health + report + RCA
```

## Product surfaces

- **Clusters** — install the outbound agent and see Kubernetes/Tekton health.
- **Applications** — connect a Git repository and detect runtime, build/test commands and deployment artifacts.
- **Pipeline Studio** — drag tasks from the library onto a visual canvas, reorder stages and configure runtime/environment.
- **Deployments** — execute compiled Tekton pipelines and expose rollout status.
- **Reports** — aggregate build, security, deployment and cluster signals for a release.

The current visual studio is intentionally platform-neutral. Its graph is the source of truth; a compiler maps the graph to Tekton Pipeline, Task and PipelineRun resources.

## Architecture

```text
                    TekForge Cloud
┌────────────────────────────────────────────────────┐
│ Web UI → Control Plane → Pipeline Compiler         │
│                    │                               │
│                    ├── Supabase / PostgreSQL       │
│                    ├── Git provider integration    │
│                    └── Agent registry              │
└────────────────────┬───────────────────────────────┘
                     │ outbound HTTPS
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       AWS EKS     GCP GKE    Local K8s
          │          │          │
       Agent       Agent      Agent
          │          │          │
       Tekton      Tekton     Tekton
          │          │          │
      Workloads  Workloads  Workloads
```

The agent uses its Kubernetes ServiceAccount to call the in-cluster Kubernetes API. Kubernetes documents this in-cluster pattern and the mounted ServiceAccount token/CA mechanism. citeturn1search1turn1search0

## Repository layout

```text
app/                       Next.js control-plane UI
app/api/                   API route handlers
app/clusters/              Cluster + agent onboarding UI
app/pipeline-studio/       Drag/drop visual pipeline studio
agent/                     Lightweight Kubernetes agent
charts/agent/              Helm chart for the agent
supabase/migrations/       Cluster/agent persistence schema
lib/                       Supabase and Tekton adapters
tekton/                    Starter Tekton resources
docs/                      Product and developer workflow documentation
```

## Agent

The agent is designed for outbound-only connectivity. It currently reports:

- Kubernetes version
- node count
- namespace count
- pod count
- Tekton availability
- heartbeat timestamp

The bootstrap flow is available at `/clusters`. The visual pipeline editor is available at `/pipeline-studio`.

The agent image is built by GitHub Actions and published to GHCR when `agent/**` changes.

## Environment

Add these server-only variables to Vercel/SaaS deployment:

```text
SUPABASE_SERVICE_ROLE_KEY=...
TEKFORGE_AGENT_SIGNING_SECRET=...
TEKFORGE_AGENT_IMAGE=ghcr.io/konthamvinay4-stack/tekforge-agent:latest
```

Apply `supabase/migrations/202610050001_agent_clusters.sql` before enabling persistent agent status.

## Current MVP

- Friendly CI/CD dashboard
- Repository analysis
- Application/project persistence
- Agent-based cluster onboarding
- Cluster heartbeat and inventory
- Visual drag/drop Pipeline Studio
- Platform-neutral pipeline graph
- Tekton pipeline execution adapter
- Git checkout Task
- npm test Task
- Trivy source scan Task
- Kaniko image build Task
- Kubernetes deployment Task

Production hardening still required: user/org authorization, per-organization cluster ownership policies, stronger agent identity/rotation, encrypted secret handling, log streaming, compiler validation, and full deployment/report persistence.

## Local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/clusters
http://localhost:3000/pipeline-studio
```

For the legacy local Tekton adapter, `kubectl proxy --port=8001` can still be used. The long-term SaaS path is the TekForge Agent.
