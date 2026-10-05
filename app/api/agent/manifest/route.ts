import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me";
}

function verifyToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return Date.now() <= Number(data.expiresAt) ? data : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const claims = verifyToken(token);
  if (!claims) return new Response("Invalid or expired token", { status: 401 });

  const controlPlane = url.origin;
  const image = process.env.TEKFORGE_AGENT_IMAGE || `ghcr.io/${process.env.GITHUB_REPOSITORY_OWNER || "konthamvinay4-stack"}/tekforge-agent:latest`;
  const yaml = `apiVersion: v1
kind: Namespace
metadata:
  name: tekforge-system
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tekforge-agent
  namespace: tekforge-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: tekforge-agent-read
rules:
- apiGroups: [""]
  resources: ["nodes", "namespaces", "pods", "services", "events"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["tekton.dev"]
  resources: ["pipelines", "pipelineruns", "tasks", "taskruns"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: tekforge-agent-read
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: tekforge-agent-read
subjects:
- kind: ServiceAccount
  name: tekforge-agent
  namespace: tekforge-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tekforge-agent
  namespace: tekforge-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tekforge-agent
  template:
    metadata:
      labels:
        app: tekforge-agent
    spec:
      serviceAccountName: tekforge-agent
      containers:
      - name: agent
        image: ${image}
        imagePullPolicy: Always
        env:
        - name: TEKFORGE_CONTROL_PLANE_URL
          value: "${controlPlane}"
        - name: TEKFORGE_CLUSTER_ID
          value: "${claims.clusterId}"
        - name: TEKFORGE_AGENT_TOKEN
          value: "${token}"
        - name: TEKFORGE_HEARTBEAT_INTERVAL_MS
          value: "15000"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
`;
  return new Response(yaml, { headers: { "Content-Type": "text/yaml; charset=utf-8", "Cache-Control": "no-store" } });
}
