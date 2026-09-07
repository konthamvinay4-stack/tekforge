#!/usr/bin/env bash
set -euo pipefail

# Required environment variables:
#   GCP_PROJECT_ID, GKE_CLUSTER, GKE_LOCATION
# Optional:
#   AR_LOCATION (default: GKE location)
#   AR_REPOSITORY (default: tekforge)
#   TEKFORGE_NAMESPACE (default: tekforge)

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GKE_CLUSTER:?Set GKE_CLUSTER}"
: "${GKE_LOCATION:?Set GKE_LOCATION}"

AR_LOCATION="${AR_LOCATION:-$GKE_LOCATION}"
AR_REPOSITORY="${AR_REPOSITORY:-tekforge}"
TEKFORGE_NAMESPACE="${TEKFORGE_NAMESPACE:-tekforge}"
GSA_NAME="tekforge-builder"
KSA_NAME="tekforge-build"
GSA_EMAIL="${GSA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"

printf '\n==> Selecting GCP project\n'
gcloud config set project "$GCP_PROJECT_ID" >/dev/null

gcloud services enable \
  container.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com

printf '\n==> Getting GKE credentials\n'
gcloud container clusters get-credentials "$GKE_CLUSTER" \
  --location "$GKE_LOCATION" \
  --project "$GCP_PROJECT_ID"

printf '\n==> Enabling Workload Identity Federation for GKE\n'
gcloud container clusters update "$GKE_CLUSTER" \
  --location "$GKE_LOCATION" \
  --workload-pool="${GCP_PROJECT_ID}.svc.id.goog" \
  --project "$GCP_PROJECT_ID"

printf '\n==> Creating Artifact Registry repository if missing\n'
if ! gcloud artifacts repositories describe "$AR_REPOSITORY" \
  --location "$AR_LOCATION" \
  --project "$GCP_PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPOSITORY" \
    --repository-format=docker \
    --location="$AR_LOCATION" \
    --description='TekForge application images' \
    --project="$GCP_PROJECT_ID"
fi

printf '\n==> Creating builder IAM service account if missing\n'
gcloud iam service-accounts describe "$GSA_EMAIL" \
  --project "$GCP_PROJECT_ID" >/dev/null 2>&1 || \
gcloud iam service-accounts create "$GSA_NAME" \
  --display-name='TekForge build and deploy' \
  --project "$GCP_PROJECT_ID"

printf '\n==> Granting Artifact Registry writer permission\n'
gcloud artifacts repositories add-iam-policy-binding "$AR_REPOSITORY" \
  --location "$AR_LOCATION" \
  --project "$GCP_PROJECT_ID" \
  --member="serviceAccount:${GSA_EMAIL}" \
  --role='roles/artifactregistry.writer'

printf '\n==> Creating TekForge namespace and Kubernetes service account\n'
kubectl apply -f ../../tekton/namespace.yaml
kubectl apply -f ../../tekton/rbac.yaml
kubectl -n "$TEKFORGE_NAMESPACE" annotate serviceaccount "$KSA_NAME" \
  "iam.gke.io/gcp-service-account=${GSA_EMAIL}" --overwrite

printf '\n==> Binding Kubernetes service account to Google service account\n'
gcloud iam service-accounts add-iam-policy-binding "$GSA_EMAIL" \
  --project "$GCP_PROJECT_ID" \
  --role='roles/iam.workloadIdentityUser' \
  --member="serviceAccount:${PROJECT_NUMBER}.svc.id.goog[${TEKFORGE_NAMESPACE}/${KSA_NAME}]"

printf '\n==> Installing/upgrading Tekton Pipelines\n'
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml

printf '\n==> Applying TekForge Tasks and Pipeline\n'
kubectl apply -f ../../tekton/tasks/
kubectl apply -f ../../tekton/pipelines/node-ci.yaml

printf '\n==> Verifying\n'
kubectl get pods -n tekton-pipelines
kubectl get task,pipeline -n "$TEKFORGE_NAMESPACE"

cat <<EOF

Bootstrap complete.

Artifact Registry:
  ${AR_LOCATION}-docker.pkg.dev/${GCP_PROJECT_ID}/${AR_REPOSITORY}

TekForge Kubernetes service account:
  ${TEKFORGE_NAMESPACE}/${KSA_NAME}

Next:
  1. Configure Vercel server-side environment variables.
  2. Set TEKTON_API_URL to the GKE Kubernetes API endpoint.
  3. Use a short-lived Kubernetes service-account token or an authenticated in-cluster agent for Tekton API access.
  4. Set application image_repository values to the Artifact Registry path above.
EOF
