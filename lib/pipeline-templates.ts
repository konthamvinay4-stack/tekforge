import type { PipelineGraph, PipelineStageType } from "@/lib/pipeline-compiler";

export type PipelineTemplate = {
  id: string;
  name: string;
  description: string;
  category: "CI/CD" | "Kubernetes" | "GitOps" | "Progressive Delivery";
  runtime: string;
  tags: string[];
  featured?: boolean;
  graph: PipelineGraph;
};

const node = (
  id: string,
  type: PipelineStageType,
  label: string,
  config: Record<string, unknown> = {},
): PipelineGraph["nodes"][number] => ({
  id,
  type,
  label,
  detail: "",
  config,
});

const graph = (
  runtime: string,
  environment: string,
  nodes: PipelineGraph["nodes"],
): PipelineGraph => ({
  version: 4,
  runtime,
  environment,
  nodes,
  edges: nodes.slice(1).map((item, index) => ({
    from: nodes[index].id,
    to: item.id,
  })),
});

export const pipelineTemplates: PipelineTemplate[] = [
  {
    id: "node-kubernetes-standard",
    name: "Node.js → Kubernetes",
    description: "Production-ready Node.js delivery with tests, Trivy, image build, deployment and rollout verification.",
    category: "CI/CD",
    runtime: "nodejs-22",
    tags: ["Node.js", "Kubernetes", "Trivy", "Kaniko"],
    featured: true,
    graph: graph("nodejs-22", "production", [
      node("source", "source", "Git Checkout", { provider: "GitHub", branch: "main" }),
      node("build", "build", "Build", { buildTool: "Auto detect", command: "npm run build" }),
      node("test", "test", "Test", { testCommand: "npm test", timeout: "10m" }),
      node("security", "security", "Security Scan", { scanners: ["Trivy"], failOn: "High or Critical" }),
      node("image", "image", "Build Image", { registry: "Artifact Registry", tag: "$(commit)" }),
      node("deploy", "deploy", "Kubernetes Deploy", { target: "Kubernetes", namespace: "default", manifestPath: "k8s/", strategy: "Rolling" }),
      node("verify", "verify", "Deployment Verify", { check: "Kubernetes rollout", timeout: "10m", onFailure: "Fail" }),
    ]),
  },
  {
    id: "spring-boot-helm",
    name: "Spring Boot → Helm",
    description: "Java/Spring delivery flow with Maven tests, security scanning, image publishing and Helm release management.",
    category: "Kubernetes",
    runtime: "java-21",
    tags: ["Java", "Spring Boot", "Maven", "Helm"],
    featured: true,
    graph: graph("java-21", "staging", [
      node("source", "source", "Git Checkout", { provider: "GitHub", branch: "main" }),
      node("build", "build", "Build", { buildTool: "Maven", command: "./mvnw -B package -DskipTests" }),
      node("test", "test", "Test", { testCommand: "./mvnw -B test", timeout: "15m" }),
      node("security", "security", "Security Scan", { scanners: ["Trivy", "Dependency"], failOn: "High or Critical" }),
      node("image", "image", "Build Image", { registry: "Google Artifact Registry", tag: "$(commit)" }),
      node("helm", "helm", "Helm Deploy", { release: "spring-app", chart: "./helm", namespace: "staging", values: "values.yaml", strategy: "Rolling" }),
      node("verify", "verify", "Deployment Verify", { check: "Kubernetes rollout", timeout: "10m", onFailure: "Rollback" }),
    ]),
  },
  {
    id: "gitops-production",
    name: "GitOps Production",
    description: "Build once, promote through GitOps, verify the deployment, require production approval and notify the team.",
    category: "GitOps",
    runtime: "nodejs-22",
    tags: ["GitOps", "Argo CD", "Approval", "Verification", "Slack"],
    featured: true,
    graph: graph("nodejs-22", "production", [
      node("source", "source", "Git Checkout", { provider: "GitHub", branch: "main" }),
      node("build", "build", "Build", { buildTool: "Auto detect", command: "npm run build" }),
      node("test", "test", "Test", { testCommand: "npm test", timeout: "10m" }),
      node("security", "security", "Security Scan", { scanners: ["Trivy"], failOn: "High or Critical" }),
      node("image", "image", "Build Image", { registry: "Artifact Registry", tag: "$(commit)" }),
      node("approval", "approval", "Production Approval", { environment: "production", message: "Approve production deployment", timeout: "24h" }),
      node("gitops", "gitops", "GitOps Sync", { application: "my-app-production", revision: "main", syncPolicy: "Manual" }),
      node("verify", "verify", "Deployment Verify", { check: "Kubernetes rollout", timeout: "10m", onFailure: "Rollback" }),
      node("notify", "notify", "Release Notification", { channel: "Slack", event: "Failure or completion" }),
    ]),
  },
  {
    id: "progressive-delivery",
    name: "Progressive Delivery",
    description: "A delivery blueprint for canary/blue-green rollout with verification and rollback hooks.",
    category: "Progressive Delivery",
    runtime: "nodejs-22",
    tags: ["Canary", "Verification", "Rollback", "Production"],
    graph: graph("nodejs-22", "production", [
      node("source", "source", "Git Checkout", { provider: "GitHub", branch: "main" }),
      node("build", "build", "Build", { buildTool: "Auto detect", command: "npm run build" }),
      node("test", "test", "Test", { testCommand: "npm test", timeout: "10m" }),
      node("security", "security", "Security Scan", { scanners: ["Trivy"], failOn: "High or Critical" }),
      node("image", "image", "Build Image", { registry: "Artifact Registry", tag: "$(commit)" }),
      node("deploy", "deploy", "Canary Deploy", { target: "Kubernetes", namespace: "production", manifestPath: "k8s/", strategy: "Canary" }),
      node("verify", "verify", "Health Verification", { check: "Kubernetes rollout", timeout: "10m", onFailure: "Rollback" }),
      node("rollback", "rollback", "Automatic Rollback", { target: "Kubernetes", revision: "Previous successful", condition: "Verification failed" }),
    ]),
  },
];

export function getPipelineTemplate(id: string) {
  return pipelineTemplates.find((template) => template.id === id) ?? null;
}
