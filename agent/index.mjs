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
const intervalMs = Number(process.env.TEKFORGE_HEARTBEAT_INTERVAL_MS || 15000);

if (!controlPlane || !clusterId || !agentToken) {
  throw new Error("TEKFORGE_CONTROL_PLANE_URL, TEKFORGE_CLUSTER_ID and TEKFORGE_AGENT_TOKEN are required");
}

function kube(path) {
  return new Promise((resolve, reject) => {
    const request = https.request(`${apiBase}${path}`, { ca, headers: { Authorization: `Bearer ${token}` } }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else reject(new Error(`Kubernetes API ${response.statusCode}: ${body}`));
      });
    });
    request.on("error", reject);
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
    request.write(data);
    request.end();
  });
}

async function snapshot() {
  const [version, nodes, namespaces, pods, tekton] = await Promise.all([
    kube("/version"),
    kube("/api/v1/nodes"),
    kube("/api/v1/namespaces"),
    kube("/api/v1/pods"),
    kube("/apis/tekton.dev/v1/pipelines").catch(() => null),
  ]);
  return {
    kubernetesVersion: version.gitVersion || version.gitVersionShort || "unknown",
    nodes: nodes.items?.length || 0,
    namespaces: namespaces.items?.length || 0,
    pods: pods.items?.length || 0,
    tekton: Boolean(tekton),
    agentNamespace: namespace,
    observedAt: new Date().toISOString(),
  };
}

async function heartbeat() {
  try {
    const cluster = await snapshot();
    await post("/api/agent/heartbeat", { clusterId, cluster });
    console.log(JSON.stringify({ level: "info", message: "heartbeat sent", clusterId, ...cluster }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) }));
  }
}

await heartbeat();
setInterval(heartbeat, intervalMs);
