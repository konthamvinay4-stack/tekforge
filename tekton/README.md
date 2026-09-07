# Tekton execution layer

TekForge treats Tekton as the execution engine. The Next.js control plane creates a `PipelineRun` in the configured Tekton namespace and periodically reads its status back into Supabase.

## Cluster prerequisites

1. Kubernetes cluster
2. Tekton Pipelines installed
3. `tekforge` namespace
4. Node CI Pipeline and Tasks applied
5. A service account/RBAC binding that permits TekForge to create, read and cancel PipelineRuns
6. Git credentials if private repositories are used
7. Container registry credentials for image publishing

Tekton `PipelineRun` is the execution object; creating it instantiates the Pipeline and its TaskRuns. The status contains execution state used by TekForge for the run UI.

## Control-plane environment

Set these server-side only:

```text
TEKTON_API_URL=https://<kubernetes-api-or-secure-proxy>
TEKTON_BEARER_TOKEN=<service-account-token>
TEKFORGE_TEKTON_NAMESPACE=tekforge
```

Do not expose the bearer token as a `NEXT_PUBLIC_*` variable.

## Local development option

For a local Kubernetes cluster, expose the Kubernetes API securely to the Next.js server or run the control plane in the same cluster. Do not put a cluster-admin credential into Vercel or a browser bundle.

## Execution path

```text
Git push
   -> Tekton EventListener / Trigger
   -> PipelineRun
   -> TaskRuns
   -> Kubernetes Pods
   -> Supabase synchronization
   -> TekForge run UI
```

The platform API can also start a PipelineRun directly for manual runs.
