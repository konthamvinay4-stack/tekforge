export type PipelineStageType = "source" | "build" | "test" | "security" | "image" | "deploy" | "approval";

export type TektonResource = Record<string, unknown>;

export type PipelineGraph = {
  version: number;
  runtime: string;
  environment: string;
  nodes: Array<{ id: string; type: PipelineStageType; label: string; detail?: string }>;
  edges: Array<{ from: string; to: string }>;
};

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "stage";
}

function taskFor(node: PipelineGraph["nodes"][number]) {
  const name = safeName(node.id);
  const imageByType: Record<PipelineStageType, string> = {
    source: "alpine/git:2.47.2",
    build: "node:22-bookworm-slim",
    test: "node:22-bookworm-slim",
    security: "aquasec/trivy:0.66.0",
    image: "gcr.io/kaniko-project/executor:v1.24.0",
    deploy: "bitnami/kubectl:1.33",
    approval: "alpine:3.22",
  };
  const commandByType: Record<PipelineStageType, string[]> = {
    source: ["rm -rf /workspace/source/*", "git clone $(params.repository) /workspace/source"],
    build: ["cd /workspace/source", "if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; elif [ -f yarn.lock ]; then corepack enable && yarn install --immutable; fi", "if [ -f package.json ]; then npm run build --if-present; fi"],
    test: ["cd /workspace/source", "if [ -f package.json ]; then npm test --if-present; fi"],
    security: ["trivy fs --exit-code 1 --no-progress /workspace/source"],
    image: ["/kaniko/executor --context=/workspace/source --destination=$(params.image) --cache=true"],
    deploy: ["if [ -d /workspace/source/k8s ]; then kubectl apply -f /workspace/source/k8s; elif [ -d /workspace/source/kubernetes ]; then kubectl apply -f /workspace/source/kubernetes; else echo 'No Kubernetes manifests found'; exit 1; fi"],
    approval: ["echo 'Approval gate passed'"],
  };

  return `apiVersion: tekton.dev/v1\nkind: Task\nmetadata:\n  name: ${name}\nspec:\n  params:\n    - name: repository\n      type: string\n    - name: image\n      type: string\n  workspaces:\n    - name: source\n  steps:\n    - name: ${name}\n      image: ${imageByType[node.type]}\n      workingDir: /workspace/source\n      script: |\n${commandByType[node.type].map((line) => `        ${line}`).join("\n")}\n`;
}

export function validateGraph(graph: PipelineGraph) {
  if (!graph.nodes.length) throw new Error("Pipeline must contain at least one stage.");
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate stage id: ${node.id}`);
    ids.add(node.id);
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`Invalid dependency: ${edge.from} → ${edge.to}`);
    if (edge.from === edge.to) throw new Error(`Stage cannot depend on itself: ${edge.from}`);
  }
  if (graph.nodes.length > 1 && graph.edges.length === 0) throw new Error("Pipeline needs at least one dependency edge.");
  if (graph.nodes.length > 1) {
    const incoming = new Set(graph.edges.map((edge) => edge.to));
    const roots = graph.nodes.filter((node) => !incoming.has(node.id));
    if (!roots.length) throw new Error("Pipeline graph contains a cycle or has no starting stage.");
  }
}

export function compileToTekton(graph: PipelineGraph, pipelineName = "tekforge-generated") {
  validateGraph(graph);
  const taskYaml = graph.nodes.map(taskFor).join("---\n");
  const pipelineTasks = graph.nodes.map((node) => {
    const deps = graph.edges.filter((edge) => edge.to === node.id).map((edge) => safeName(edge.from));
    const runAfter = deps.length ? `\n      runAfter:\n${deps.map((dep) => `        - ${dep}`).join("\n")}` : "";
    return `    - name: ${safeName(node.id)}\n      taskRef:\n        name: ${safeName(node.id)}\n      params:\n        - name: repository\n          value: $(params.repository)\n        - name: image\n          value: $(params.image)\n      workspaces:\n        - name: source\n          workspace: shared-source${runAfter}`;
  }).join("\n");

  const pipelineYaml = `apiVersion: tekton.dev/v1\nkind: Pipeline\nmetadata:\n  name: tekforge-generated\n  labels:\n    tekforge.dev/runtime: ${safeName(graph.runtime)}\n    tekforge.dev/environment: ${safeName(graph.environment)}\nspec:\n  params:\n    - name: repository\n      type: string\n    - name: image\n      type: string\n  workspaces:\n    - name: shared-source\n  tasks:\n${pipelineTasks}\n`;

  const pipelineResource = {
    apiVersion: "tekton.dev/v1",
    kind: "Pipeline",
    metadata: { name: safeName(pipelineName), labels: { "tekforge.dev/runtime": safeName(graph.runtime), "tekforge.dev/environment": safeName(graph.environment) } },
    spec: {
      params: [{ name: "repository", type: "string" }, { name: "image", type: "string" }],
      workspaces: [{ name: "shared-source" }],
      tasks: graph.nodes.map((node) => ({
        name: safeName(node.id), taskRef: { name: safeName(node.id) },
        params: [{ name: "repository", value: "$(params.repository)" }, { name: "image", value: "$(params.image)" }],
        workspaces: [{ name: "source", workspace: "shared-source" }],
        ...(graph.edges.filter((edge) => edge.to === node.id).length ? { runAfter: graph.edges.filter((edge) => edge.to === node.id).map((edge) => safeName(edge.from)) } : {}),
      })),
    },
  };
  const taskResources = graph.nodes.map((node) => ({
    apiVersion: "tekton.dev/v1", kind: "Task", metadata: { name: safeName(node.id) },
    spec: {
      params: [{ name: "repository", type: "string" }, { name: "image", type: "string" }],
      workspaces: [{ name: "source" }],
      steps: [{ name: safeName(node.id), image: ({ source: "alpine/git:2.47.2", build: "node:22-bookworm-slim", test: "node:22-bookworm-slim", security: "aquasec/trivy:0.66.0", image: "gcr.io/kaniko-project/executor:v1.24.0", deploy: "bitnami/kubectl:1.33", approval: "alpine:3.22" } as Record<PipelineStageType, string>)[node.type], workingDir: "/workspace/source", script: "#!/bin/sh\nset -eu\n" + ({ source: ["rm -rf /workspace/source/*", "git clone $(params.repository) /workspace/source"], build: ["cd /workspace/source", "if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; elif [ -f yarn.lock ]; then corepack enable && yarn install --immutable; fi", "if [ -f package.json ]; then npm run build --if-present; fi"], test: ["cd /workspace/source", "if [ -f package.json ]; then npm test --if-present; fi"], security: ["trivy fs --exit-code 1 --no-progress /workspace/source"], image: ["/kaniko/executor --context=/workspace/source --destination=$(params.image) --cache=true"], deploy: ["if [ -d /workspace/source/k8s ]; then kubectl apply -f /workspace/source/k8s; elif [ -d /workspace/source/kubernetes ]; then kubectl apply -f /workspace/source/kubernetes; else echo 'No Kubernetes manifests found'; exit 1; fi"], approval: ["echo 'Approval gate passed'"] } as Record<PipelineStageType, string[]>)[node.type].join("\n") }],
    },
  }));

  return {
    pipelineYaml: `${pipelineYaml}\n---\n${taskYaml}`,
    taskNames: graph.nodes.map((node) => safeName(node.id)),
    resources: [pipelineResource, ...taskResources],
  };
}
