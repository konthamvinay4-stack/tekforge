export type TektonObject = {
  apiVersion: "tekton.dev/v1";
  kind: string;
  metadata: { name: string; namespace?: string };
  spec: Record<string, unknown>;
};

export type TektonPipelineRun = TektonObject & {
  kind: "PipelineRun";
  spec: {
    pipelineRef: { name: string };
    params?: Array<{ name: string; value: string }>;
  };
};

export type TektonPipelineStatus = {
  name: string;
  namespace: string;
  status: "Unknown" | "Running" | "Succeeded" | "Failed" | "Cancelled";
  message?: string;
  startedAt?: string;
  completedAt?: string;
  tasks: Array<{
    name: string;
    status: "Unknown" | "Running" | "Succeeded" | "Failed" | "Cancelled";
    message?: string;
  }>;
};
