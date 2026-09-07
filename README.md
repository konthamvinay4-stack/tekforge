# TekForge

TekForge is a developer self-service CI/CD control plane built around Tekton on Kubernetes.

The goal is simple: a developer should be able to connect an application and understand exactly what the platform is doing without learning Tekton YAML.

## User experience

```text
Connect repository
      ↓
Choose runtime + deployment target
      ↓
TekForge generates a delivery plan
      ↓
Git push / Run now
      ↓
Checkout → Build → Test → Security → Image → Deploy
      ↓
Live status + logs + findings
      ↓
DEV → QA → approval → PROD
```

Every screen is designed around three questions:

1. What is happening?
2. Why is it happening?
3. What happens next?

## Architecture

```text
Developer
   │
   ▼
TekForge Web UI
   │
   ▼
TekForge Control Plane / API
   │
   ├── PostgreSQL
   ├── Git provider integration
   └── Pipeline Compiler
          │
          ▼
     Tekton resources
          │
          ▼
 Kubernetes
   ├── Checkout
   ├── Build + Test
   ├── Security scanning
   ├── Container build/push
   └── Deployment
```

Tekton's model is intentionally preserved: Tasks are executable building blocks, Pipelines compose Tasks, and a PipelineRun executes a Pipeline while exposing TaskRun status.

Git-based automation uses Tekton Triggers: EventListener receives the event, TriggerBinding extracts event data, and TriggerTemplate creates the PipelineRun.

## Repository layout

```text
app/                    Next.js control-plane UI
app/api/                API route handlers
packages/types/         Canonical platform types
tekton/tasks/           Reusable Tekton Tasks
tekton/pipelines/       Pipeline definitions
tekton/triggers/        Git event → PipelineRun definitions
docs/                   Product and developer workflow documentation
```

## Current MVP

- Friendly CI/CD dashboard
- Human-readable pipeline visualization
- Recent run/status experience
- Demo Run action that explains execution behavior
- Health API
- Node.js starter pipeline
- Git checkout Task
- npm test Task
- Trivy source scan Task
- Kaniko image build Task
- Kubernetes deployment Task
- GitHub webhook TriggerBinding / TriggerTemplate / EventListener
- Canonical `TekForgePipelineSpec`

The Tekton manifests are starter resources; registry credentials, Git authentication, cluster RBAC, deployment manifests and environment-specific policy must be configured before production execution.

## Next implementation phases

### Phase 1 — Platform foundation
- PostgreSQL persistence
- Projects and Applications CRUD
- Git repository connection
- Environment model
- Tekton API adapter

### Phase 2 — Real execution
- Create PipelineRun from the API
- Watch PipelineRun and TaskRun status
- Stream step logs
- Store run history
- Retry/cancel support

### Phase 3 — Developer workflow
- Pipeline Studio
- Runtime templates for Java/Python/Go
- DEV/QA/PROD promotion
- Approval gates
- Artifacts and deployment history

### Phase 4 — Security and intelligence
- SAST/dependency/container scanning
- SBOM and provenance
- Tekton Chains integration
- Failure RCA using logs/events/history
- Natural-language pipeline generation with policy validation

## Local development

```bash
npm install
npm run dev
```

The current dashboard can be reviewed without a Kubernetes connection. Live execution requires Tekton Pipelines and Triggers installed on a Kubernetes cluster and the manifests under `tekton/` configured for the target environment.
