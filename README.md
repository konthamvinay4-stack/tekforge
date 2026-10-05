# TekForge

TekForge is an agent-first Kubernetes application delivery platform. It combines cluster connectivity, repository intelligence, a visual pipeline studio, Tekton execution and deployment intelligence behind one control plane.

## Product flow

```text
Connect Kubernetes cluster
      ↓
Install TekForge Agent
      ↓
Agent heartbeat + cluster inventory
      ↓
Connect Git repository
      ↓
Analyze application
      ↓
Generate recommended pipeline
      ↓
Visual Pipeline Studio
      ↓
Validate graph + compile
      ↓
Tekton Pipeline / PipelineRun
      ↓
Live execution + logs + events
      ↓
Deployment health + release report + RCA
```

## Supported cluster model

TekForge is designed for AWS EKS, GCP GKE, Azure AKS, on-prem Kubernetes and local clusters. The control plane does not require inbound access to the customer Kubernetes API. The lightweight agent runs inside the cluster, uses its ServiceAccount for Kubernetes API access and sends heartbeat/telemetry outbound.

## Architecture

```text
                    TekForge Cloud
┌────────────────────────────────────────────────────────┐
│ Web UI                                                 │
│  ├── Clusters                                          │
│  ├── Applications / Repositories                       │
│  ├── Pipeline Studio                                   │
│  ├── Deployments / Runs                                │
│  └── Reports / RCA                                     │
│             │                                           │
│             ▼                                           │
│ Control Plane / API                                    │
│  ├── Agent Registry                                    │
│  ├── Repository Analyzer                               │
│  ├── Pipeline Compiler                                 │
│  ├── Policy / Validation                               │
│  └── Persistence                                       │
└─────────────┬──────────────────────────────────────────┘
              │ outbound HTTPS
       ┌──────┼─────────┐
       ▼      ▼         ▼
     EKS     GKE    Local / On-prem
       │      │         │
     Agent  Agent     Agent
       │      │         │
     Tekton Tekton    Tekton
       │      │         │
   Workloads Workloads Workloads
```

## Pipeline Studio

The visual graph is the platform source of truth. Users can add and connect source, build, test, security, image, approval and deployment stages. TekForge validates the graph and compiles it into Tekton resources.

The editor is built on React Flow; the current dependency tracks the 12.11.x line. React Flow provides the node/edge interaction model required for a serious pipeline canvas.

## Compiler

`lib/pipeline-compiler.ts` defines a platform-neutral `PipelineGraph` and validates node IDs and dependency edges before generating Tekton YAML. `/api/pipelines/compile` exposes the compiler for the Studio and future pipeline persistence/execution workflows.

The long-term compiler contract is:

```text
Visual Graph
    ↓
TekForge Pipeline Spec
    ↓
Policy validation
    ↓
Tekton compiler
    ↓
Task + Pipeline + PipelineRun
```

Do not make Tekton YAML the UI source of truth. This keeps the product portable and allows future execution backends without redesigning the user experience.

## Agent

The current agent reports Kubernetes version, nodes, namespaces, pods, services, deployments, Tekton availability, PipelineRun/TaskRun counts and recent Kubernetes events. Its RBAC is read-only for the current telemetry phase.

The production roadmap adds short-lived identity rotation, signed commands, scoped execution permissions and explicit per-organization authorization before enabling remote mutation.

## Security direction

TekForge should remain outbound-first. Customer clusters should not expose the Kubernetes API to the public internet. Agent identity must be rotated and scoped. Pipeline execution should use least-privilege ServiceAccounts, admission/policy checks and signed artifacts.

Tekton Chains is the intended supply-chain security integration for signed TaskRun/PipelineRun metadata, image signatures and attestations. Tekton's current release line includes security hardening and improved tracing, so the agent/compiler should target the current supported Tekton API rather than older beta resources.

## Current MVP

- Agent-based cluster onboarding
- Cluster heartbeat and inventory
- Repository/application persistence
- Visual drag-and-drop Pipeline Studio
- Platform-neutral pipeline graph
- Tekton compiler preview API
- Tekton execution adapter
- Git checkout, test, security, image and Kubernetes deployment tasks
- Pipeline run status/cancel endpoints

## Next platform upgrades

1. GitHub/GitLab/Bitbucket OAuth and repository analysis.
2. AI-generated pipeline recommendations with deterministic policy validation.
3. Agent command channel for PipelineRun creation, cancellation and log streaming.
4. Pipeline execution timeline with TaskRun logs/events.
5. Environment promotion DEV → QA → STAGING → PROD with approvals.
6. Artifact registry integrations and immutable image digests.
7. Trivy/SAST/SBOM/Cosign + Tekton Chains supply-chain evidence.
8. Kubernetes deployment health, rollout verification and automatic rollback.
9. Gateway API-based application exposure where supported; Gateway API has become the modern Kubernetes networking API and current releases continue moving features to Standard.
10. Multi-tenant RBAC, audit trail, secrets integration and organization policy.

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

For legacy local Tekton development, `kubectl proxy --port=8001` remains supported. The target SaaS architecture is the TekForge Agent.
