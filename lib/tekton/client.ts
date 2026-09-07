import type { TektonPipelineRun, TektonPipelineStatus } from "./types";

function baseUrl() {
  const value = process.env.TEKTON_API_URL;
  if (!value) throw new Error("TEKTON_API_URL is not configured");
  return value.replace(/\/$/, "");
}

function namespace() {
  return process.env.TEKFORGE_TEKTON_NAMESPACE || "tekforge";
}

function bearerToken() {
  return process.env.TEKTON_BEARER_TOKEN;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = bearerToken();
  if (!token) throw new Error("TEKTON_BEARER_TOKEN is not configured");
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tekton API ${response.status}: ${text}`);
  return text ? JSON.parse(text) as T : (undefined as T);
}

const runtimeImages: Record<string, string> = {
  nodejs: "node:22-alpine",
  python: "python:3.13-slim",
  java: "maven:3.9-eclipse-temurin-21",
  go: "golang:1.24",
  rust: "rust:1.88",
};

export async function createPipelineRun(input: {
  pipelineName: string;
  runName?: string;
  commitSha?: string;
  repoUrl?: string;
  branch?: string;
  image?: string;
  runtime?: string;
  testCommand?: string;
}) {
  const name = input.runName || `tekforge-${Date.now()}`;
  if (!input.repoUrl) throw new Error("Application repository URL is required");
  if (!input.image) throw new Error("Application image repository is required");

  const body: TektonPipelineRun = {
    apiVersion: "tekton.dev/v1",
    kind: "PipelineRun",
    metadata: { name, namespace: namespace() },
    spec: {
      pipelineRef: { name: input.pipelineName },
      params: [
        { name: "repo-url", value: input.repoUrl },
        { name: "revision", value: input.branch || "main" },
        { name: "image", value: input.image },
        { name: "runtime-image", value: runtimeImages[input.runtime || "nodejs"] || "ubuntu:24.04" },
        { name: "test-command", value: input.testCommand || "" },
      ],
      workspaces: [{ name: "source", emptyDir: {} }],
    },
  };
  return request<TektonPipelineRun>(`/apis/tekton.dev/v1/namespaces/${namespace()}/pipelineruns`, { method: "POST", body: JSON.stringify(body) });
}

function conditionStatus(conditions: Array<{ type?: string; status?: string; reason?: string; message?: string }> = []) {
  const ready = conditions.find((condition) => condition.type === "Succeeded");
  if (!ready) return { status: "Unknown" as const };
  if (ready.status === "True") return { status: "Succeeded" as const, message: ready.message };
  if (ready.status === "False") return { status: /cancel/i.test(`${ready.reason} ${ready.message}`) ? "Cancelled" as const : "Failed" as const, message: ready.message };
  return { status: "Running" as const, message: ready.message };
}

export async function getPipelineRun(runName: string): Promise<TektonPipelineStatus> {
  const result = await request<any>(`/apis/tekton.dev/v1/namespaces/${namespace()}/pipelineruns/${encodeURIComponent(runName)}`);
  const condition = conditionStatus(result.status?.conditions);
  const taskRuns = await request<any>(`/apis/tekton.dev/v1/namespaces/${namespace()}/taskruns?labelSelector=${encodeURIComponent(`tekton.dev/pipelineRun=${runName}`)}`);
  const tasks = (taskRuns.items || []).map((task: any) => {
    const taskCondition = conditionStatus(task.status?.conditions);
    return { name: task.metadata?.labels?.["tekton.dev/pipelineTask" ] || task.metadata?.name, status: taskCondition.status, message: taskCondition.message };
  });
  return { name: result.metadata.name, namespace: result.metadata.namespace, status: condition.status, message: condition.message, startedAt: result.status?.startTime, completedAt: result.status?.completionTime, tasks };
}

export async function cancelPipelineRun(runName: string) {
  return request(`/apis/tekton.dev/v1/namespaces/${namespace()}/pipelineruns/${encodeURIComponent(runName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/merge-patch+json" },
    body: JSON.stringify({ spec: { status: "Cancelled" } }),
  });
}
