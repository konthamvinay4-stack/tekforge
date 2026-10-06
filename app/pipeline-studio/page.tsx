"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type StageType = "trigger" | "source" | "build" | "test" | "security" | "image" | "deploy" | "helm" | "gitops" | "verify" | "approval" | "notify" | "rollback";

type StageConfig = {
  repository?: string;
  branch?: string;
  provider?: string;
  buildTool?: string;
  command?: string;
  testCommand?: string;
  scanners?: string[];
  failOn?: string;
  registry?: string;
  image?: string;
  tag?: string;
  target?: string;
  namespace?: string;
  manifestPath?: string;
  strategy?: string;
  environment?: string;
  message?: string;
  timeout?: string;
};

type StageDefinition = {
  type: StageType;
  label: string;
  detail: string;
  category: string;
  description: string;
  icon: string;
  defaults: StageConfig;
};

type StageData = {
  label: string;
  detail: string;
  type: StageType;
  config: StageConfig;
};

type StageNode = Node<StageData, "stage">;

const definitions: StageDefinition[] = [
  { type: "trigger", label: "Git Trigger", detail: "Start from a Git event", category: "Triggers", description: "Start this pipeline from a push, pull request, tag, or manual trigger.", icon: "⚡", defaults: { provider: "GitHub", event: "Push", branch: "main" } },
  { type: "source", label: "Git Checkout", detail: "Clone source from Git", category: "Source", description: "Fetch the selected repository and revision into the shared workspace.", icon: "⌘", defaults: { provider: "GitHub", repository: "", branch: "main" } },
  { type: "build", label: "Build", detail: "Compile the application", category: "Build", description: "Install dependencies and run the project's build command.", icon: "⚙", defaults: { buildTool: "Auto detect", command: "npm run build" } },
  { type: "test", label: "Test", detail: "Run automated tests", category: "Quality", description: "Run unit, integration or custom verification commands.", icon: "✓", defaults: { testCommand: "npm test", timeout: "10m" } },
  { type: "security", label: "Security Scan", detail: "Scan source and dependencies", category: "Security", description: "Scan source, dependencies, secrets, or images against your security policy.", icon: "◇", defaults: { scanners: ["Trivy"], failOn: "High or Critical" } },
  { type: "image", label: "Build Image", detail: "Build and push container", category: "Container", description: "Build the application image and publish it to a container registry.", icon: "▣", defaults: { registry: "Artifact Registry", image: "", tag: "$(commit)" } },
  { type: "deploy", label: "Kubernetes Deploy", detail: "Roll out to Kubernetes", category: "Delivery", description: "Apply Kubernetes manifests to a selected namespace.", icon: "↗", defaults: { target: "Kubernetes", namespace: "default", manifestPath: "k8s/", strategy: "Rolling" } },
  { type: "helm", label: "Helm Deploy", detail: "Install or upgrade a chart", category: "Delivery", description: "Deploy and manage Helm releases with configurable values and rollout behavior.", icon: "♢", defaults: { release: "", chart: "./helm", namespace: "default", values: "values.yaml", strategy: "Rolling" } },
  { type: "gitops", label: "GitOps Sync", detail: "Sync through Argo CD", category: "Delivery", description: "Promote an application by updating the GitOps source and synchronizing Argo CD.", icon: "⇄", defaults: { application: "", revision: "main", syncPolicy: "Automated" } },
  { type: "verify", label: "Deployment Verify", detail: "Verify live health", category: "Verification", description: "Check rollout health, readiness, smoke tests, metrics, or HTTP endpoints after deployment.", icon: "◎", defaults: { check: "Kubernetes rollout", endpoint: "", timeout: "10m", onFailure: "Fail" } },
  { type: "approval", label: "Approval", detail: "Manual environment gate", category: "Governance", description: "Pause execution until an authorized person approves the promotion.", icon: "●", defaults: { environment: "production", message: "Approve production deployment", timeout: "24h" } },
  { type: "notify", label: "Notification", detail: "Send release update", category: "Integrations", description: "Send pipeline, deployment, or failure notifications to your team.", icon: "◌", defaults: { channel: "Slack", target: "", event: "Failure or completion" } },
  { type: "rollback", label: "Rollback", detail: "Restore last stable release", category: "Recovery", description: "Automatically or manually return the workload to the last known-good revision.", icon: "↶", defaults: { target: "Kubernetes", revision: "Previous successful", condition: "Verification failed" } },
];
