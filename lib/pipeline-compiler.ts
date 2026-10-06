export type PipelineStageType = "trigger" | "source" | "build" | "test" | "security" | "image" | "deploy" | "helm" | "gitops" | "verify" | "approval" | "notify" | "rollback";

export type TektonResource = Record<string, unknown>;

export type PipelineGraph = {
  version: number;
  runtime: string;
  environment: string;
  nodes: Array<{ id: string; type: PipelineStageType; label: string; detail?: string; config?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string }>;
};

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "stage";
}

function scriptFor(node: PipelineGraph["nodes"][number]) {
  const config = node.config || {};
  const timeout = String(config.timeout || "10m");
  const manifestPath = String(config.manifestPath || "k8s/");
  const target = String(config.target || "Kubernetes");

  switch (node.type) {
    case "trigger": return ["echo Pipeline triggered"];
    case "source": return [
      "rm -rf /workspace/source/*",
      "git clone " + String(config.repository || "$(params.repository)") + " /workspace/source",
    ];
    case "build": return [
      "cd /workspace/source",
      "if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; elif [ -f yarn.lock ]; then corepack enable && yarn install --immutable; fi",
      String(config.command || "if [ -f package.json ]; then npm run build --if-present; fi"),
    ];
    case "test": return [
      "cd /workspace/source",
      String(config.testCommand || "if [ -f package.json ]; then npm test --if-present; fi"),
    ];
    case "security":
      return [String(config.failOn === "Never"
        ? "trivy fs --exit-code 0 --no-progress /workspace/source"
        : "trivy fs --exit-code 1 --severity HIGH,CRITICAL --no-progress /workspace/source")];
    case "image":
      return ["/kaniko/executor --context=/workspace/source --destination=" + String(config.image || "$(params.image)") + ":" + String(config.tag || "latest") + " --cache=true"];
    case "deploy":
      return [
        "if [ -d /workspace/source/" + manifestPath.replace(/^\/+/, "") + " ]; then kubectl apply -f /workspace/source/" + manifestPath.replace(/^\/+/, ") + " -R; else echo 'Deployment manifest path not found: " + manifestPath.replace(/'/g, "'\\''") + "'; exit 1; fi",
      ];
    case "helm":
      return [
        "helm upgrade --install " + String(config.release || "tekforge-app") + " " + String(config.chart || "./helm") +
          " --namespace " + String(config.namespace || "default") + " --create-namespace",
      ];
    case "gitops":
      return ["echo GitOps sync requested for " + String(config.application || "application")];
    case "verify":
      if (config.check === "HTTP smoke test" && config.endpoint) {
        return ["curl --fail --silent --show-error --max-time 30 " + String(config.endpoint)];
      }
      if (config.check === "Custom command" && config.command) {
        return [String(config.command)];
      }
      return ["kubectl rollout status -f /workspace/source/" + manifestPath.replace(/^\/+/, "") + " -R --timeout=" + timeout];
    case "approval":
      return ["echo Approval gate passed"];
    case "notify":
      return ["echo Notification requested for " + String(config.event || "completion")];
    case "rollback":
      if (target === "Helm") {
        return ["helm rollback " + String(config.release || "tekforge-app") + " 0 --namespace " + String(config.namespace || "default")];
      }
      return ["kubectl rollout undo -f /workspace/source/" + manifestPath.replace(/^\/+/, "") + " -R"];
  }
}

function taskFor(node: PipelineGraph["nodes"][number]) {
  const imageByType: Record<PipelineStageType, string> = {
    trigger: "alpine:3.22",
    source: "alpine/git:2.47.2",
    build: "node:22-bookworm-slim",
    test: "node:22-bookworm-slim",
    security: "aquasec/trivy:0.66.0",
    image: "gcr.io/kaniko-project/executor:v1.24.0",
    deploy: "bitnami/kubectl:1.33",
    helm: "alpine/helm:3.18.4",
    gitops: "alpine:3.22",
    verify: "bitnami/kubectl:1.33",
    approval: "alpine:3.22",
    notify: "curlimages/curl:8.15.0",
    rollback: "bitnami/kubectl:1.33",
  };
  const lines = scriptFor(node);
  return `apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: ${safeName(node.id)}
spec:
  params:
    - name: repository
      type: string
    - name: image
      type: string
  workspaces:
    - name: source
  steps:
    - name: ${safeName(node.id)}
      image: ${imageByType[node.type]}
      workingDir: /workspace/source
      script: |
        #!/bin/sh
        set -eu
${lines.map((line) => `        ${line}`).join("\n")}
`;
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
  const executableNodes = graph.nodes.filter((node) => node.type !== "rollback");
  const rollbackNodes = graph.nodes.filter((node) => node.type === "rollback");
  const pipelineTasks = executableNodes.map((node) => {
    const deps = graph.edges.filter((edge) => edge.to === node.id && edge.from !== node.id && graph.nodes.some((candidate) => candidate.id === edge.from && candidate.type !== "rollback")).map((edge) => safeName(edge.from));
    const runAfter = deps.length ? `\n      runAfter:\n${deps.map((dep) => `        - ${dep}`).join("\n")}` : "";
    return `    - name: ${safeName(node.id)}\n      taskRef:\n        name: ${safeName(node.id)}\n      params:\n        - name: repository\n          value: $(params.repository)\n        - name: image\n          value: $(params.image)\n      workspaces:\n        - name: source\n          workspace: shared-source${runAfter}`;
  }).join("\n");
  const finallyYaml = rollbackNodes.length ? `\n  finally:\n${rollbackNodes.map((node) => {
    const predecessor = graph.edges.find((edge) => edge.to === node.id && graph.nodes.find((candidate) => candidate.id === edge.from)?.type === "verify");
    const when = predecessor ? `\n      when:\n        - input: "$(tasks.${safeName(predecessor.from)}.status)"\n          operator: in\n          values: ["Failed"]` : "";
    return `    - name: ${safeName(node.id)}\n      taskRef:\n        name: ${safeName(node.id)}\n      params:\n        - name: repository\n          value: $(params.repository)\n        - name: image\n          value: $(params.image)\n      workspaces:\n        - name: source\n          workspace: shared-source${when}`;
  }).join("\n")}` : "";

  const pipelineYaml = `apiVersion: tekton.dev/v1\nkind: Pipeline\nmetadata:\n  name: tekforge-generated\n  labels:\n    tekforge.dev/runtime: ${safeName(graph.runtime)}\n    tekforge.dev/environment: ${safeName(graph.environment)}\nspec:\n  params:\n    - name: repository\n      type: string\n    - name: image\n      type: string\n  workspaces:\n    - name: shared-source\n  tasks:\n${pipelineTasks}${finallyYaml}\n`;

  const pipelineResource = {
    apiVersion: "tekton.dev/v1",
    kind: "Pipeline",
    metadata: { name: safeName(pipelineName), labels: { "tekforge.dev/runtime": safeName(graph.runtime), "tekforge.dev/environment": safeName(graph.environment) } },
    spec: {
      params: [{ name: "repository", type: "string" }, { name: "image", type: "string" }],
      workspaces: [{ name: "shared-source" }],
      tasks: executableNodes.map((node) => ({
        name: safeName(node.id), taskRef: { name: safeName(node.id) },
        params: [{ name: "repository", value: "$(params.repository)" }, { name: "image", value: "$(params.image)" }],
        workspaces: [{ name: "source", workspace: "shared-source" }],
        ...(graph.edges.filter((edge) => edge.to === node.id && graph.nodes.some((candidate) => candidate.id === edge.from && candidate.type !== "rollback")).length
          ? { runAfter: graph.edges.filter((edge) => edge.to === node.id && graph.nodes.some((candidate) => candidate.id === edge.from && candidate.type !== "rollback")).map((edge) => safeName(edge.from)) }
          : {}),
      })),
      ...(rollbackNodes.length ? {
        finally: rollbackNodes.map((node) => {
          const predecessor = graph.edges.find((edge) => edge.to === node.id && graph.nodes.find((candidate) => candidate.id === edge.from)?.type === "verify");
          return {
            name: safeName(node.id),
            taskRef: { name: safeName(node.id) },
            params: [{ name: "repository", value: "$(params.repository)" }, { name: "image", value: "$(params.image)" }],
            workspaces: [{ name: "source", workspace: "shared-source" }],
            ...(predecessor ? { when: [{ input: "$(tasks." + safeName(predecessor.from) + ".status)", operator: "in", values: ["Failed"] }] } : {}),
          };
        }),
      } : {}),
    },
  };
  const taskResources = graph.nodes.map((node) => ({
    apiVersion: "tekton.dev/v1", kind: "Task", metadata: { name: safeName(node.id) },
    spec: {
      params: [{ name: "repository", type: "string" }, { name: "image", type: "string" }],
      workspaces: [{ name: "source" }],
      steps: [{ name: safeName(node.id), image: ({
        trigger: "alpine:3.22", source: "alpine/git:2.47.2", build: "node:22-bookworm-slim", test: "node:22-bookworm-slim",
        security: "aquasec/trivy:0.66.0", image: "gcr.io/kaniko-project/executor:v1.24.0", deploy: "bitnami/kubectl:1.33",
        helm: "alpine/helm:3.18.4", gitops: "alpine:3.22", verify: "bitnami/kubectl:1.33", approval: "alpine:3.22",
        notify: "curlimages/curl:8.15.0", rollback: "bitnami/kubectl:1.33",
      } as Record<PipelineStageType, string[]>)[node.type] as unknown as string, workingDir: "/workspace/source", script: "#!/bin/sh\nset -eu\n" + scriptFor(node).join("\n") }],
    },
  }));

  return {
    pipelineYaml: `${pipelineYaml}\n---\n${taskYaml}`,
    taskNames: graph.nodes.map((node) => safeName(node.id)),
    resources: [pipelineResource, ...taskResources],
  };
}
