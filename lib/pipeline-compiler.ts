export type PipelineStageType = "source" | "build" | "test" | "security" | "image" | "deploy" | "approval";

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
    source: ["git clone $(params.repository) /workspace/source"],
    build: ["cd /workspace/source", "npm ci", "npm run build"],
    test: ["cd /workspace/source", "npm test"],
    security: ["trivy fs --exit-code 1 /workspace/source"],
    image: ["/kaniko/executor --context=/workspace/source --destination=$(params.image)"],
    deploy: ["kubectl apply -f /workspace/source/k8s"],
    approval: ["echo 'Approval gate passed'"],
  };

  return `apiVersion: tekton.dev/v1\nkind: Task\nmetadata:\n  name: ${name}\nspec:\n  params:\n    - name: repository\n      type: string\n    - name: image\n      type: string\n  steps:\n    - name: ${name}\n      image: ${imageByType[node.type]}\n      script: |\n${commandByType[node.type].map((line) => `        ${line}`).join("\n")}\n`;
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
  const incoming = new Set(graph.edges.map((edge) => edge.to));
  if (graph.nodes.length > 1 && incoming.size === 0) throw new Error("Pipeline needs at least one dependency edge.");
}

export function compileToTekton(graph: PipelineGraph) {
  validateGraph(graph);
  const taskNames = graph.nodes.map((node) => safeName(node.id));
  const taskYaml = graph.nodes.map(taskFor).join("---\n");
  const pipelineTasks = graph.nodes.map((node, index) => {
    const deps = graph.edges.filter((edge) => edge.to === node.id).map((edge) => safeName(edge.from));
    const runAfter = deps.length ? `\n      runAfter:\n${deps.map((dep) => `        - ${dep}`).join("\n")}` : "";
    return `    - name: ${safeName(node.id)}\n      taskRef:\n        name: ${safeName(node.id)}${runAfter}`;
  }).join("\n");

  const pipelineYaml = `apiVersion: tekton.dev/v1\nkind: Pipeline\nmetadata:\n  name: tekforge-generated\n  labels:\n    tekforge.dev/runtime: ${safeName(graph.runtime)}\n    tekforge.dev/environment: ${safeName(graph.environment)}\nspec:\n  params:\n    - name: repository\n      type: string\n    - name: image\n      type: string\n  tasks:\n${pipelineTasks}\n`;

  return { pipelineYaml: `${pipelineYaml}\n---\n${taskYaml}`, taskNames };
}
