import { getTaskCatalogItem } from "@/lib/task-catalog";

export type PipelineStageType =
  | "trigger" | "source" | "build" | "test" | "quality" | "security"
  | "image" | "deploy" | "helm" | "gitops" | "verify" | "approval"
  | "notify" | "rollback";

export type TektonResource = Record<string, unknown>;

export type PipelineGraph = {
  version: number;
  runtime: string;
  environment: string;
  nodes: Array<{
    id: string;
    type: PipelineStageType;
    label: string;
    detail?: string;
    config?: Record<string, unknown>;
  }>;
  edges: Array<{ from: string; to: string }>;
};

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "stage";
}

function shellQuote(value: unknown) {
  return "'" + String(value ?? "").replace(/'/g, "'\\''") + "'";
}

const imageByType: Record<PipelineStageType, string> = {
  trigger: "alpine:3.22",
  source: "alpine/git:2.47.2",
  build: "node:22-bookworm-slim",
  test: "node:22-bookworm-slim",
  quality: "sonarsource/sonar-scanner-cli:7.0",
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

function integrationImage(node: PipelineGraph["nodes"][number]) {
  const tool = String(node.config?.tool || "");
  return getTaskCatalogItem(tool)?.image || imageByType[node.type];
}

function scriptFor(node: PipelineGraph["nodes"][number]) {
  const config = node.config || {};
  const timeout = String(config.timeout || "10m");
  const manifestPath = String(config.manifestPath || "k8s/");
  const target = String(config.target || "Kubernetes");
  const tool = String(config.tool || "");

  switch (node.type) {
    case "trigger":
      return ["echo Pipeline triggered"];
    case "source":
      return [
        "rm -rf /workspace/source/*",
        "git clone " + shellQuote("$(params.repository)") + " /workspace/source",
        config.branch ? "cd /workspace/source && git checkout " + shellQuote(config.branch) : "true",
      ];
    case "build":
      return [
        "cd /workspace/source",
        "if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; elif [ -f yarn.lock ]; then corepack enable && yarn install --immutable; fi",
        String(config.command || "if [ -f package.json ]; then npm run build --if-present; fi"),
      ];
    case "test": {
      const command = String(config.testCommand || "npm test --if-present");
      if (tool === "jest" && config.coverage) return ["cd /workspace/source", command + " --coverage"];
      if (tool === "vitest" && config.coverage) return ["cd /workspace/source", command + " --coverage"];
      if (tool === "pytest" && config.coverage) return ["cd /workspace/source", "python -m pip install --no-cache-dir pytest pytest-cov", command + " --cov=. --cov-report=xml:" + shellQuote(config.coveragePath || "coverage.xml")];
      return ["cd /workspace/source", command];
    }
    case "quality": {
      const qualityTool = tool || "sonarqube";
      if (qualityTool !== "sonarqube" && qualityTool !== "sonarcloud") {
        return ["cd /workspace/source", String(config.command || "echo 'Code quality tool not configured'")];
      }
      const args = [
        "sonar-scanner",
        "-Dsonar.host.url=" + shellQuote(config.serverUrl || "https://sonarcloud.io"),
        "-Dsonar.projectKey=" + shellQuote(config.projectKey || "$(params.repository)"),
        "-Dsonar.sources=" + shellQuote(config.sources || "."),
      ];
      if (config.organization) args.push("-Dsonar.organization=" + shellQuote(config.organization));
      if (config.qualityGate === "Wait and fail") args.push("-Dsonar.qualitygate.wait=true");
      if (config.qualityGate === "Wait and warn") args.push("-Dsonar.qualitygate.wait=true", "-Dsonar.qualitygate.timeout=" + String(config.timeout || "10m").replace(/m$/, "0"));
      return ["cd /workspace/source", args.join(" ")];
    }
    case "security": {
      const scanners = Array.isArray(config.scanners) ? config.scanners : [config.tool || "Trivy"];
      const commands: string[] = [];
      if (scanners.includes("Trivy") || scanners.includes("trivy") || tool === "trivy") {
        const severity = String(config.severity || (config.failOn === "Never" ? "HIGH,CRITICAL" : "HIGH,CRITICAL"));
        commands.push("trivy fs --no-progress --severity " + shellQuote(severity) + " --exit-code " + (config.failOn === "Never" || config.failOn === false ? "0" : "1") + " /workspace/source");
      }
      if (scanners.includes("Gitleaks") || scanners.includes("gitleaks") || tool === "gitleaks") {
        commands.push("gitleaks detect --source /workspace/source --no-banner " + (config.failOn === false ? "--exit-code 0" : "--exit-code 1"));
      }
      if (scanners.includes("Dependency") || tool === "dependency-scan") {
        commands.push("trivy fs --scanners vuln --no-progress --severity " + shellQuote(config.severity || "HIGH,CRITICAL") + " --exit-code " + (config.failOn === false ? "0" : "1") + " /workspace/source");
      }
      return commands.length ? commands : ["echo 'No security scanner configured'"];
    }
    case "image":
      return ["/kaniko/executor --context=/workspace/source --destination=" + String(config.image || "$(params.image)") + ":" + String(config.tag || "latest") + " --cache=true"];
    case "deploy":
      return [
        "if [ -d /workspace/source/" + manifestPath.replace(/^\/+/, "") + " ]; then kubectl apply -f /workspace/source/" + manifestPath.replace(/^\/+/, "") + " -R; else echo 'Deployment manifest path not found: " + manifestPath.replace(/'/g, "'\\''") + "'; exit 1; fi",
      ];
    case "helm":
      return [
        "helm upgrade --install " + shellQuote(config.release || "tekforge-app") + " " + shellQuote(config.chart || "./helm") +
          " --namespace " + shellQuote(config.namespace || "default") + " --create-namespace" +
          (config.values ? " -f " + shellQuote(config.values) : ""),
      ];
    case "gitops": {
      const server = String(config.serverUrl || "").replace(/\/$/, "");
      const app = String(config.application || "");
      if (!server || !app) return ["echo 'GitOps configuration requires Argo CD server URL and application name'; exit 1"];
      const revision = String(config.revision || "main");
      const token = config.credentialSecret ? " -H \"Authorization: Bearer $ARGOCD_AUTH_TOKEN\"" : "";
      const body = JSON.stringify({ revision, prune: true, dryRun: false });
      return [
        "curl --fail --silent --show-error -X POST " + shellQuote(server + "/api/v1/applications/" + app + "/sync") + " -H 'Content-Type: application/json'" + token + " --data " + shellQuote(body),
      ];
    }
    case "verify":
      if (config.check === "Prometheus metric" && config.serverUrl && config.query) {
        const query = encodeURIComponent(String(config.query));
        return ["curl --fail --silent --show-error --max-time 30 " + shellQuote(String(config.serverUrl).replace(/\/$/, "") + "/api/v1/query?query=" + query) + " | grep -q 'success'"];
      }
      if (config.check === "HTTP smoke test" && config.endpoint) {
        return ["curl --fail --silent --show-error --max-time 30 " + shellQuote(config.endpoint)];
      }
      if (config.check === "Custom command" && config.command) return [String(config.command)];
      return ["kubectl rollout status -f /workspace/source/" + manifestPath.replace(/^\/+/, "") + " -R --timeout=" + timeout];
    case "approval":
      return ["echo Approval gate passed"];
    case "notify": {
      if (!config.target) return ["echo 'Notification target is not configured'; exit 1"];
      const message = String(config.message || "TekForge pipeline completed");
      if (String(config.channel || "Slack") === "Webhook") {
        return ["curl --fail --silent --show-error -X POST " + shellQuote(config.target) + " -H 'Content-Type: application/json' --data " + shellQuote(JSON.stringify({ text: message }))];
      }
      return ["echo " + shellQuote("Notification requested for " + String(config.event || "completion") + ": " + message)];
    }
    case "rollback":
      if (target === "Helm") {
        return ["helm rollback " + shellQuote(config.release || "tekforge-app") + " 0 --namespace " + shellQuote(config.namespace || "default")];
      }
      return ["kubectl rollout undo -f /workspace/source/" + manifestPath.replace(/^\/+/, "") + " -R"];
  }
}

function taskEnv(node: PipelineGraph["nodes"][number]) {
  const config = node.config || {};
  const secret = typeof config.credentialSecret === "string" ? config.credentialSecret.trim() : "";
  if (!secret) return "";
  const tool = String(config.tool || "");
  if (tool === "sonarqube" || tool === "sonarcloud") {
    return `\n      env:
        - name: SONAR_TOKEN
          valueFrom:
            secretKeyRef:
              name: ${safeName(secret)}
              key: SONAR_TOKEN`;
  }
  if (node.type === "gitops") {
    return `\n      env:
        - name: ARGOCD_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: ${safeName(secret)}
              key: ARGOCD_AUTH_TOKEN`;
  }
  return "";
}

function taskFor(node: PipelineGraph["nodes"][number]) {
  const lines = scriptFor(node) || ["echo 'No operation configured'"];
  return `apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: ${safeName(node.id)}
  labels:
    tekforge.dev/task-type: ${safeName(node.type)}
    tekforge.dev/integration: ${safeName(String(node.config?.tool || node.type))}
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
      image: ${integrationImage(node)}
      workingDir: /workspace/source${taskEnv(node)}
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
    if (!node.type) throw new Error(`Stage ${node.id} has no type.`);
    if ((node.type === "quality") && !node.config?.tool) throw new Error(`Code Quality stage ${node.id} requires an integration tool.`);
    if ((node.type === "test") && !node.config?.tool && !node.config?.testCommand) throw new Error(`Test stage ${node.id} requires a test tool or command.`);
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
    const deps = graph.edges
      .filter((edge) => edge.to === node.id && edge.from !== node.id && graph.nodes.some((candidate) => candidate.id === edge.from && candidate.type !== "rollback"))
      .map((edge) => safeName(edge.from));
    const runAfter = deps.length ? `\n      runAfter:\n${deps.map((dep) => `        - ${dep}`).join("\n")}` : "";
    return `    - name: ${safeName(node.id)}
      taskRef:
        name: ${safeName(node.id)}
      params:
        - name: repository
          value: $(params.repository)
        - name: image
          value: $(params.image)
      workspaces:
        - name: source
          workspace: shared-source${runAfter}`;
  }).join("\n");

  const finallyYaml = rollbackNodes.length ? `\n  finally:\n${rollbackNodes.map((node) => {
    const predecessor = graph.edges.find((edge) => edge.to === node.id && graph.nodes.find((candidate) => candidate.id === edge.from)?.type === "verify");
    const when = predecessor ? `\n      when:\n        - input: "$(tasks.${safeName(predecessor.from)}.status)"\n          operator: in\n          values: ["Failed"]` : "";
    return `    - name: ${safeName(node.id)}
      taskRef:
        name: ${safeName(node.id)}
      params:
        - name: repository
          value: $(params.repository)
        - name: image
          value: $(params.image)
      workspaces:
        - name: source
          workspace: shared-source${when}`;
  }).join("\n")}` : "";

  const pipelineYaml = `apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: ${safeName(pipelineName)}
  labels:
    tekforge.dev/runtime: ${safeName(graph.runtime)}
    tekforge.dev/environment: ${safeName(graph.environment)}
spec:
  params:
    - name: repository
      type: string
    - name: image
      type: string
  workspaces:
    - name: shared-source
  tasks:
${pipelineTasks}${finallyYaml}
`;

  const pipelineResource = {
    apiVersion: "tekton.dev/v1",
    kind: "Pipeline",
    metadata: { name: safeName(pipelineName), labels: { "tekforge.dev/runtime": safeName(graph.runtime), "tekforge.dev/environment": safeName(graph.environment) } },
    spec: {
      params: [{ name: "repository", type: "string" }, { name: "image", type: "string" }],
      workspaces: [{ name: "shared-source" }],
      tasks: executableNodes.map((node) => ({
        name: safeName(node.id),
        taskRef: { name: safeName(node.id) },
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
    apiVersion: "tekton.dev/v1",
    kind: "Task",
    metadata: {
      name: safeName(node.id),
      labels: {
        "tekforge.dev/task-type": safeName(node.type),
        "tekforge.dev/integration": safeName(String(node.config?.tool || node.type)),
      },
    },
    spec: {
      params: [{ name: "repository", type: "string" }, { name: "image", type: "string" }],
      workspaces: [{ name: "source" }],
      steps: [{
        name: safeName(node.id),
        image: integrationImage(node),
        workingDir: "/workspace/source",
        ...(typeof node.config?.credentialSecret === "string" && node.config.credentialSecret.trim() && ["sonarqube", "sonarcloud"].includes(String(node.config?.tool || ""))
          ? { env: [{ name: "SONAR_TOKEN", valueFrom: { secretKeyRef: { name: safeName(String(node.config.credentialSecret)), key: "SONAR_TOKEN" } } }] }
          : {}),
        script: "#!/bin/sh\nset -eu\n" + (scriptFor(node) || ["echo 'No operation configured'"]).join("\n"),
      }],
    },
  }));

  return {
    pipelineYaml: `${pipelineYaml}\n---\n${taskYaml}`,
    taskNames: graph.nodes.map((node) => safeName(node.id)),
    resources: [pipelineResource, ...taskResources],
  };
}
