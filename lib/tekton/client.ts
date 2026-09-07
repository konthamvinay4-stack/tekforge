import type { TektonPipelineRun, TektonPipelineStatus } from "./types";

function baseUrl() {
  const value = process.env.TEKTON_API_URL;
  if (!value) throw new Error("TEKTON_API_URL is not configured");
  return value.replace(/\/$/, "");
}

function namespace() {
  return process.env.TEKFORGE_TEKTON_NAMESPACE || "tekforge";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tekton API ${response.status}: ${text}`);
  return text ? JSON.parse(text) as T : (undefined as T);
}

export async function createPipelineRun(input: {
  pipelineName: string;
  runName?: string;
  commitSha?: string;
  repoUrl?: string;
  branch?: string;
}) {
  const name = input.runName || `tekforge-${Date.now()}`;
  const body: TektonPipelineRun = {
    apiVersion: "tekton.dev/v1",
    kind: "PipelineRun",
    metadata: { name, namespace: namespace() },
    spec: {
      pipelineRef: { name: input.pipelineName },
      params: [
        ...(input.repoUrl ? [{ name: "repo-url", value: input.repoUrl }] : []),
        ...(input.branch ? [{ name: "repo-revision", value: input.branch }] : []),
        ...(input.commitSha ? [{ name: "commit-sha", value: input.commitSha }] : []),
      ],
    },
  };

  return request<TektonPipelineRun>(`/apis/tekton.dev/v1/namespaces/${namespace()}/pipelineruns`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function conditionStatus(conditions: Array<{ type?: string; status?: string; reason?: string; message?: string }> = []) {
  const ready = conditions.find((condition) => condition.type === "Succeeded");
  if (!ready) return { status: "Unknown" as const };
  if (ready.status === "True") return { status: "Succeeded" as const, message: ready.message };
  if (ready.status === "False") {
    if (/cancel/i.test(`${ready.reason} ${ready.message}`)) return { status: "Cancelled" as const, message: ready.message };
    return { status: "Failed" as const, message: ready.message };
  }
  return { status: "Running" as const, message: ready.message };
}

export async function getPipelineRun(runName: string): Promise<TektonPipelineStatus> {
  const result = await request<any>(`/apis/tekton.dev/v1/namespaces/${namespace()}/pipelineruns/${encodeURIComponent(runName)}`);
  const condition = conditionStatus(result.status?.conditions);
  const taskStatuses = result.status?.childReferences || [];
  const tasks = taskStatuses.map((task: any) => ({ name: task.pipelineTaskName || task.name, status: "Unknown" as const }));
  return {
    name: result.metadata.name,
    namespace: result.metadata.namespace,
    status: condition.status,
    message: condition.message,
    startedAt: result.status?.startTime,
    completedAt: result.status?.completionTime,
    tasks,
  };
}

export async function cancelPipelineRun(runName: string) {
  return request(`/apis/tekton.dev/v1/namespaces/${namespace()}/pipelineruns/${encodeURIComponent(runName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/merge-patch+json" },
    body: JSON.stringify({ spec: { status: "Cancelled" } }),
  });
}
