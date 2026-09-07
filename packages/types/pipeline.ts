export type Runtime = "nodejs" | "java" | "python" | "go";
export type ContainerBuilder = "kaniko" | "buildah" | "ko";
export type DeploymentTarget = "kubernetes" | "helm" | "argocd";

export interface TekForgePipelineSpec {
  runtime: Runtime;
  runtimeVersion: string;
  build: "npm" | "maven" | "gradle" | "pip" | "go";
  test: string;
  security: string[];
  container: ContainerBuilder;
  deployment: DeploymentTarget;
  environments: string[];
}

export interface PipelineRunSummary {
  id: string;
  application: string;
  revision: string;
  status: "queued" | "running" | "success" | "failed";
  startedAt?: string;
  finishedAt?: string;
}
