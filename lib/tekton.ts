const TEKTON_API_URL = process.env.TEKTON_API_URL || "http://127.0.0.1:8001";
const TEKFORGE_TEKTON_NAMESPACE = process.env.TEKFORGE_TEKTON_NAMESPACE || "tekforge";

function apiUrl(path: string) {
  return `${TEKTON_API_URL.replace(/\/$/, "")}${path}`;
}

function headers() {
  const token = process.env.TEKTON_BEARER_TOKEN;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function tektonFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Kubernetes API ${response.status}: ${detail}`);
  }

  return body;
}

export function tektonNamespace() {
  return TEKFORGE_TEKTON_NAMESPACE;
}

export async function ensureNamespace() {
  const path = `/api/v1/namespaces/${encodeURIComponent(TEKFORGE_TEKTON_NAMESPACE)}`;
  const response = await fetch(apiUrl(path), {
    headers: headers(),
    cache: "no-store",
  });

  if (response.ok) return;
  if (response.status !== 404) {
    throw new Error(`Kubernetes API ${response.status}: ${await response.text()}`);
  }

  await tektonFetch("/api/v1/namespaces", {
    method: "POST",
    body: JSON.stringify({
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: TEKFORGE_TEKTON_NAMESPACE },
    }),
  });
}

export async function applyPipeline(name: string, repositoryUrl: string, branch: string, buildCommand: string, testCommand: string) {
  await ensureNamespace();

  const pipeline = {
    apiVersion: "tekton.dev/v1",
    kind: "Pipeline",
    metadata: { name, namespace: TEKFORGE_TEKTON_NAMESPACE },
    spec: {
      workspaces: [{ name: "source" }],
      params: [
        { name: "repo-url", type: "string" },
        { name: "repo-revision", type: "string", default: branch },
        { name: "build-command", type: "string", default: buildCommand },
        { name: "test-command", type: "string", default: testCommand },
      ],
      tasks: [
        {
          name: "checkout",
          taskSpec: {
            params: [
              { name: "repo-url", type: "string" },
              { name: "repo-revision", type: "string" },
            ],
            workspaces: [{ name: "source" }],
            steps: [
              {
                name: "clone",
                image: "alpine/git:latest",
                script: "#!/bin/sh\nset -eu\nrm -rf $(workspaces.source.path)/* $(workspaces.source.path)/.[!.]* $(workspaces.source.path)/..?* 2>/dev/null || true\ngit clone --depth 1 --branch $(params.repo-revision) $(params.repo-url) $(workspaces.source.path)",
              },
            ],
          },
          params: [
            { name: "repo-url", value: "$(params.repo-url)" },
            { name: "repo-revision", value: "$(params.repo-revision)" },
          ],
          workspaces: [{ name: "source", workspace: "source" }],
        },
        {
          name: "build-test",
          runAfter: ["checkout"],
          taskSpec: {
            params: [
              { name: "build-command", type: "string" },
              { name: "test-command", type: "string" },
            ],
            workspaces: [{ name: "source" }],
            steps: [
              {
                name: "build-test",
                image: "node:22-bookworm",
                workingDir: "$(workspaces.source.path)",
                script: "#!/bin/bash\nset -e\nif [ -f package-lock.json ]; then npm ci; else npm install; fi\necho \"Running build: $(params.build-command)\"\nbash -lc \"$(params.build-command)\"\necho \"Running tests: $(params.test-command)\"\nbash -lc \"$(params.test-command)\"",
              },
            ],
          },
          params: [
            { name: "build-command", value: "$(params.build-command)" },
            { name: "test-command", value: "$(params.test-command)" },
          ],
          workspaces: [{ name: "source", workspace: "source" }],
        },
      ],
    },
  };

  const path = `/apis/tekton.dev/v1/namespaces/${encodeURIComponent(TEKFORGE_TEKTON_NAMESPACE)}/pipelines/${encodeURIComponent(name)}`;
  const existing = await fetch(apiUrl(path), { headers: headers(), cache: "no-store" });

  if (existing.ok) {
    return tektonFetch(path, { method: "PUT", body: JSON.stringify(pipeline) });
  }
  if (existing.status !== 404) throw new Error(`Kubernetes API ${existing.status}: ${await existing.text()}`);
  return tektonFetch(`/apis/tekton.dev/v1/namespaces/${encodeURIComponent(TEKFORGE_TEKTON_NAMESPACE)}/pipelines`, {
    method: "POST",
    body: JSON.stringify(pipeline),
  });
}

export async function createPipelineRun(pipelineName: string, repositoryUrl: string, branch: string, buildCommand: string, testCommand: string) {
  await ensureNamespace();
  const run = {
    apiVersion: "tekton.dev/v1",
    kind: "PipelineRun",
    metadata: {
      generateName: `${pipelineName}-run-`,
      namespace: TEKFORGE_TEKTON_NAMESPACE,
      labels: { "tekforge.dev/pipeline": pipelineName },
    },
    spec: {
      pipelineRef: { name: pipelineName },
      params: [
        { name: "repo-url", value: repositoryUrl },
        { name: "repo-revision", value: branch },
        { name: "build-command", value: buildCommand },
        { name: "test-command", value: testCommand },
      ],
      workspaces: [{ name: "source", emptyDir: {} }],
    },
  };

  return tektonFetch(`/apis/tekton.dev/v1/namespaces/${encodeURIComponent(TEKFORGE_TEKTON_NAMESPACE)}/pipelineruns`, {
    method: "POST",
    body: JSON.stringify(run),
  });
}

export async function getPipelineRuns() {
  return tektonFetch(`/apis/tekton.dev/v1/namespaces/${encodeURIComponent(TEKFORGE_TEKTON_NAMESPACE)}/pipelineruns`);
}
