# TekForge on GKE

This directory bootstraps the TekForge execution plane on an existing GKE cluster.

## Architecture

```text
Vercel / Next.js
      |
      | HTTPS + Kubernetes ServiceAccount bearer token
      v
GKE Kubernetes API
      |
      v
Tekton PipelineRun
      |
      +--> git-clone
      +--> npm-test
      +--> trivy-scanner
      +--> kaniko-build --> Artifact Registry
      +--> kubectl-deploy --> GKE workload
```

For a production installation, replace the direct Vercel-to-kube-apiserver path with an authenticated in-cluster TekForge agent. The direct path is intentionally used for the MVP because it keeps the architecture small and testable.

## 1. Bootstrap

From this directory:

```bash
export GCP_PROJECT_ID="your-gcp-project"
export GKE_CLUSTER="your-gke-cluster"
export GKE_LOCATION="your-gke-region-or-zone"
export AR_LOCATION="your-artifact-registry-region"
export AR_REPOSITORY="tekforge"

bash bootstrap.sh
```

The bootstrap creates:

- Artifact Registry Docker repository if it does not already exist.
- `tekforge` Kubernetes namespace.
- `tekforge-build` Kubernetes ServiceAccount for Tekton tasks.
- `tekforge-controlplane` Kubernetes ServiceAccount for the Vercel control plane.
- Least-privilege RBAC for PipelineRun/TaskRun operations.
- Workload Identity binding for Artifact Registry pushes.
- Tekton Pipelines and the TekForge starter Tasks/Pipeline.

GKE Workload Identity Federation is the recommended mechanism for workloads accessing Google Cloud services without service-account key files. citeturn0search1turn0search2

## 2. Get the Kubernetes API endpoint

```bash
gcloud container clusters describe "$GKE_CLUSTER" \
  --location "$GKE_LOCATION" \
  --project "$GCP_PROJECT_ID" \
  --format='value(endpoint)'
```

The TekForge Vercel environment variable should use:

```text
TEKTON_API_URL=https://<cluster-endpoint>
```

The endpoint must be reachable from Vercel. If the cluster control plane is private-only, use the future in-cluster agent architecture instead of exposing the control plane publicly.

## 3. Create the MVP control-plane token

Kubernetes recommends short-lived TokenRequest credentials over persistent ServiceAccount token Secrets. citeturn2search0turn2search4

For this MVP, if a persistent Vercel credential is required, create a dedicated token Secret only for `tekforge-controlplane`:

```bash
kubectl -n tekforge apply -f - <<'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: tekforge-controlplane-token
  annotations:
    kubernetes.io/service-account.name: tekforge-controlplane
type: kubernetes.io/service-account-token
EOF
```

Retrieve the token locally:

```bash
kubectl -n tekforge get secret tekforge-controlplane-token \
  -o jsonpath='{.data.token}' | base64 --decode
```

Do not commit this token to GitHub. Store it only as the Vercel server-side `TEKTON_BEARER_TOKEN` environment variable. Long-lived ServiceAccount tokens are a compatibility/MVP mechanism and should be replaced by a short-lived or agent-based authentication flow before production. citeturn2search3turn2search6

## 4. Vercel environment variables

Configure these as server-side variables:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
TEKTON_API_URL=https://<cluster-endpoint>
TEKTON_BEARER_TOKEN=<token-from-step-3>
TEKFORGE_TEKTON_NAMESPACE=tekforge
TEKFORGE_TEKTON_SERVICE_ACCOUNT=tekforge-build
```

Never prefix the Tekton endpoint or token with `NEXT_PUBLIC_`.

## 5. Artifact Registry image

The bootstrap creates:

```text
<AR_LOCATION>-docker.pkg.dev/<GCP_PROJECT_ID>/<AR_REPOSITORY>
```

Set each TekForge application's `image_repository` to a repository/image path under that repository, for example:

```text
<AR_LOCATION>-docker.pkg.dev/<GCP_PROJECT_ID>/tekforge/demo-commerce
```

GKE can pull from Artifact Registry when the relevant Google identity has the required repository permissions. citeturn0search0turn0search4

## 6. Application repository requirements for the starter pipeline

The current `node-ci` pipeline expects:

- a public Git repository for the initial MVP checkout;
- a `Dockerfile` at repository root;
- `package.json` and an `npm test` script;
- `k8s/deployment.yaml`;
- deployment name `tekforge-app` unless overridden later;
- container name `app` unless overridden later.

The pipeline builds the configured `image_repository` and then updates the deployment to that exact image.

## 7. Verify

```bash
kubectl get task,pipeline -n tekforge
kubectl get serviceaccount -n tekforge
kubectl get role,rolebinding -n tekforge
```

Then trigger a PipelineRun from TekForge and inspect:

```bash
kubectl get pipelineruns -n tekforge -w
kubectl get taskruns -n tekforge
```
