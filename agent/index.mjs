import fs from "node:fs";
import https from "node:https";

const serviceAccountPath = "/var/run/secrets/kubernetes.io/serviceaccount";
const token = fs.readFileSync(`${serviceAccountPath}/token`, "utf8").trim();
const ca = fs.readFileSync(`${serviceAccountPath}/ca.crt`);
const namespace = fs.readFileSync(`${serviceAccountPath}/namespace`, "utf8").trim();
const apiHost = process.env.KUBERNETES_SERVICE_HOST || "kubernetes.default.svc";
const apiPort = process.env.KUBERNETES_SERVICE_PORT_HTTPS || "443";
const apiBase = `https://${apiHost}:${apiPort}`;
const controlPlane = (process.env.TEKFORGE_CONTROL_PLANE_URL || "").replace(/\/$/, "");
const clusterId = process.env.TEKFORGE_CLUSTER_ID;
const agentToken = process.env.TEKFORGE_AGENT_TOKEN;
const executionNamespace = process.env.TEKFORGE_EXECUTION_NAMESPACE || "tekforge";
const intervalMs = Math.max(Number(process.env.TEKFORGE_HEARTBEAT_INTERVAL_MS || 15000), 5000);
const pollMs = Math.max(Number(process.env.TEKFORGE_COMMAND_POLL_MS || 5000), 3000);

if (!controlPlane || !clusterId || !agentToken) {
  throw new Error("TEKFORGE_CONTROL_PLANE_URL, TEKFORGE_CLUSTER_ID and TEKFORGE_AGENT_TOKEN are required");
}

function kube(path, options = {}) {
  return new Promise((resolve, reject) => {
    const data = options.body ? JSON.stringify(options.body) : null;
    const request = https.request(`${apiBase}${path}`, {
      method: options.method || "GET",
      ca,
      headers: { Authorization: `Bearer ${token}`, ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) },
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try { resolve(body ? JSON.parse(body) : null); } catch { resolve(body); }
        } else reject(new Error(`Kubernetes API ${response.statusCode}: ${body}`));
      });
    });
    request.on("error", reject);
    request.setTimeout(15000, () => request.destroy(new Error("Kubernetes API timeout")));
    if (data) request.write(data);
    request.end();
  });
}

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(`${controlPlane}${path}`);
    const request = https.request(url, { method: "POST", headers: { Authorization: `Bearer ${agentToken}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => response.statusCode >= 200 && response.statusCode < 300 ? resolve(body) : reject(new Error(`Control plane ${response.statusCode}: ${body}`)));
    });
    request.on("error", reject);
    request.setTimeout(10000, () => request.destroy(new Error("Control plane timeout")));
    request.write(data);
    request.end();
  });
}

async function optional(path) { try { return await kube(path); } catch { return null; } }

async function snapshot() {
  const [version, nodes, namespaces, pods, services, deployments, events, tektonPipelines, pipelineRuns, taskRuns] = await Promise.all([
    kube("/version"), kube("/api/v1/nodes"), kube("/api/v1/namespaces"), kube("/api/v1/pods"),
    optional("/api/v1/services"), optional("/apis/apps/v1/deployments"), optional("/api/v1/events?limit=50"),
    optional("/apis/tekton.dev/v1/pipelines"), optional("/apis/tekton.dev/v1/pipelineruns"), optional("/apis/tekton.dev/v1/taskruns"),
  ]);
  const readyDeployments = (deployments?.items || []).filter((item) => item.status?.readyReplicas === item.status?.replicas && (item.status?.replicas || 0) > 0).length;
  return {
    kubernetesVersion: version.gitVersion || "unknown", nodes: nodes.items?.length || 0, namespaces: namespaces.items?.length || 0,
    pods: pods.items?.length || 0, services: services?.items?.length || 0, deployments: deployments?.items?.length || 0,
    healthyDeployments: readyDeployments, tekton: Boolean(tektonPipelines), pipelineCount: tektonPipelines?.items?.length || 0,
    pipelineRunCount: pipelineRuns?.items?.length || 0, taskRunCount: taskRuns?.items?.length || 0,
    recentEvents: (events?.items || []).slice(-25).map((event) => ({ type: event.type, reason: event.reason, message: event.message, namespace: event.metadata?.namespace, involvedKind: event.involvedObject?.kind, involvedName: event.involvedObject?.name, lastTimestamp: event.lastTimestamp || event.eventTime })),
    agentNamespace: namespace, executionNamespace, observedAt: new Date().toISOString(),
  };
}

function validName(value) { return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value); }

async function executeCommand(command) {
  const payload = command.payload || {};
  const targetNamespace = String(payload.namespace || executionNamespace);
  if (targetNamespace !== executionNamespace) throw new Error(`Execution is restricted to namespace ${executionNamespace}`);
  if (!validName(targetNamespace)) throw new Error("Invalid namespace");

  if (command.type === "get-pipelinerun") {
    const name = String(payload.name || "").trim();
    if (!validName(name)) throw new Error("Invalid PipelineRun name");
    const resource = await kube(`/apis/tekton.dev/v1/namespaces/${encodeURIComponent(targetNamespace)}/pipelineruns/${encodeURIComponent(name)}`);
    return { operation: command.type, namespace: targetNamespace, resource };
  }

  if (command.type === "create-pipelinerun") {
    const pipelineName = String(payload.pipelineName || "").trim();
    if (!validName(pipelineName)) throw new Error("Invalid Tekton Pipeline name");
    const runName = String(payload.runName || `tekforge-${Date.now()}`).trim();
    if (!validName(runName)) throw new Error("Invalid PipelineRun name");

    const params = Array.isArray(payload.params) ? payload.params : [];
    const run = {
      apiVersion: "tekton.dev/v1",
      kind: "PipelineRun",
      metadata: { name: runName, namespace: targetNamespace, labels: { "tekforge.dev/managed": "true" } },
      spec: { pipelineRef: { name: pipelineName }, params, workspaces: [{ name: "source", emptyDir: {} }] },
    };
    const resource = await kube(`/apis/tekton.dev/v1/namespaces/${encodeURIComponent(targetNamespace)}/pipelineruns`, { method: "POST", body: run });
    return { operation: command.type, namespace: targetNamespace, resource };
  }

  throw new Error(`Unsupported agent command: ${command.type}`);
}

async function heartbeat() {
  try { const cluster = await snapshot(); await post("/api/agent/heartbeat", { clusterId, cluster }); console.log(JSON.stringify({ level: "info", message: "heartbeat sent", clusterId, ...cluster })); }
  catch (error) { console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) })); }
}

async function pollCommands() {
  try {
    const response = await fetch(`${controlPlane}/api/agent/commands`, { headers: { Authorization: `Bearer ${agentToken}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Command poll ${response.status}`);
    const body = await response.json();
    for (const command of body.commands || []) {
      try {
        const result = await executeCommand(command);
        await post("/api/agent/commands/result", { commandId: command.id, status: "completed", result });
      } catch (error) {
        await post("/api/agent/commands/result", { commandId: command.id, status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch (error) { console.error(JSON.stringify({ level: "warn", message: error instanceof Error ? error.message : String(error) })); }
}

await heartbeat();
setInterval(heartbeat, intervalMs);
setInterval(pollCommands, pollMs);
await pollCommands();
