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
import { getTaskCatalogItem, taskCatalog } from "@/lib/task-catalog";

type StageType = "trigger" | "source" | "build" | "test" | "quality" | "security" | "image" | "deploy" | "helm" | "gitops" | "verify" | "approval" | "notify" | "rollback";

type StageConfig = {
  repository?: string;
  branch?: string;
  provider?: string;
  buildTool?: string;
  command?: string;
  testCommand?: string;
  tool?: string;
  serverUrl?: string;
  projectKey?: string;
  organization?: string;
  credentialSecret?: string;
  sources?: string;
  qualityGate?: string;
  coverage?: boolean;
  coveragePath?: string;
  workingDirectory?: string;
  baseUrl?: string;
  severity?: string;
  configPath?: string;
  scanners?: string[];
  failOn?: string | boolean;
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
  event?: string;
  release?: string;
  chart?: string;
  values?: string;
  application?: string;
  revision?: string;
  syncPolicy?: string;
  check?: string;
  endpoint?: string;
  onFailure?: string;
  channel?: string;
  condition?: string;
  query?: string;
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
  { type: "test", label: "Test", detail: "Run automated tests", category: "Testing", description: "Choose a test framework and configure its command, coverage and environment.", icon: "✓", defaults: { tool: "test-command", testCommand: "npm test", timeout: "10m" } },
  { type: "quality", label: "Code Quality", detail: "Analyze code quality", category: "Code Quality", description: "Connect SonarQube or SonarCloud and optionally fail the pipeline on a quality-gate failure.", icon: "⌁", defaults: { tool: "sonarqube", serverUrl: "", projectKey: "", credentialSecret: "", sources: ".", qualityGate: "Wait and fail", timeout: "10m" } },
  { type: "security", label: "Security Scan", detail: "Scan source and dependencies", category: "Security", description: "Choose one or more reusable security scanners and define the failure policy.", icon: "◇", defaults: { tool: "trivy", scanners: ["Trivy"], severity: "HIGH,CRITICAL", failOn: "High or Critical" } },
  { type: "image", label: "Build Image", detail: "Build and push container", category: "Container", description: "Build the application image and publish it to a container registry.", icon: "▣", defaults: { registry: "Artifact Registry", image: "", tag: "$(commit)" } },
  { type: "deploy", label: "Kubernetes Deploy", detail: "Roll out to Kubernetes", category: "Delivery", description: "Apply Kubernetes manifests to a selected namespace.", icon: "↗", defaults: { target: "Kubernetes", namespace: "default", manifestPath: "k8s/", strategy: "Rolling" } },
  { type: "helm", label: "Helm Deploy", detail: "Install or upgrade a chart", category: "Delivery", description: "Deploy and manage Helm releases with configurable values and rollout behavior.", icon: "♢", defaults: { release: "", chart: "./helm", namespace: "default", values: "values.yaml", strategy: "Rolling" } },
  { type: "gitops", label: "GitOps Sync", detail: "Sync through Argo CD", category: "Delivery", description: "Promote an application through a GitOps repository and Argo CD.", icon: "⇄", defaults: { application: "", revision: "main", syncPolicy: "Automated" } },
  { type: "verify", label: "Deployment Verify", detail: "Verify live health", category: "Verification", description: "Check rollout health, readiness, smoke tests, or HTTP endpoints after deployment.", icon: "◎", defaults: { check: "Kubernetes rollout", endpoint: "", timeout: "10m", onFailure: "Fail" } },
  { type: "approval", label: "Approval", detail: "Manual environment gate", category: "Governance", description: "Pause execution until an authorized person approves the promotion.", icon: "●", defaults: { environment: "production", message: "Approve production deployment", timeout: "24h" } },
  { type: "notify", label: "Notification", detail: "Send release update", category: "Integrations", description: "Send pipeline, deployment, or failure notifications to your team.", icon: "◌", defaults: { channel: "Slack", target: "", event: "Failure or completion" } },
  { type: "rollback", label: "Rollback", detail: "Restore last stable release", category: "Recovery", description: "Return the workload to the last known-good revision.", icon: "↶", defaults: { target: "Kubernetes", revision: "Previous successful", condition: "Verification failed" } },
];

function createNode(def: StageDefinition, index: number): StageNode {
  return {
    id: `${def.type}-${crypto.randomUUID().slice(0, 8)}`,
    type: "stage",
    position: { x: 100 + (index % 3) * 300, y: 80 + Math.floor(index / 3) * 190 },
    data: { label: def.label, detail: def.detail, type: def.type, config: { ...def.defaults } },
  };
}

const initialNodes: StageNode[] = definitions.slice(1, 9).map(createNode);
const initialEdges: Edge[] = initialNodes.slice(0, -1).map((node, index) => ({
  id: `${node.id}-${initialNodes[index + 1].id}`,
  source: node.id,
  target: initialNodes[index + 1].id,
}));

function StageCard({ data, selected }: NodeProps<StageNode>) {
  const def = definitions.find((item) => item.type === data.type)!;
  const configured = Object.values(data.config || {}).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  return (
    <div className={`studio-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="studio-handle" />
      <div className="node-accent" />
      <div className="node-top">
        <span className="node-icon">{def.icon}</span>
        <span className="node-category">{def.category}</span>
        {configured && <span className="node-configured">●</span>}
      </div>
      <strong>{data.label}</strong>
      <span className="node-detail">{data.detail}</span>
      <div className="node-summary">{nodeSummary(data)}</div>
      <Handle type="source" position={Position.Right} className="studio-handle" />
    </div>
  );
}

function nodeSummary(node: StageData) {
  const c = node.config || {};
  if (node.type === "source") return c.repository ? c.repository.replace(/^https?:\/\//, "") : "Configure repository";
  if (node.type === "build") return c.command || "Configure build command";
  if (node.type === "test") return `${c.tool || "Test"} · ${c.testCommand || "Configure tests"}`;
  if (node.type === "quality") return c.projectKey ? `${c.tool || "SonarQube"} · ${c.projectKey}` : "Configure code quality";
  if (node.type === "security") return Array.isArray(c.scanners) ? c.scanners.join(" · ") : "Configure scanner";
  if (node.type === "image") return c.image ? `${c.image}:${c.tag || "latest"}` : "Configure image";
  if (node.type === "deploy") return `${c.target || "Kubernetes"} · ${c.namespace || "default"}`;
  return c.environment ? `Gate · ${c.environment}` : "Configure approval";
}

const nodeTypes = { stage: StageCard };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="inspector-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function PipelineStudio() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StageNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState(initialNodes[0]?.id || "");
  const [runtime, setRuntime] = useState("nodejs-22");
  const [environment, setEnvironment] = useState("production");
  const [compileResult, setCompileResult] = useState("");
  const [showCompile, setShowCompile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clusterId, setClusterId] = useState("");
  const [namespace, setNamespace] = useState("tekforge");
  const [message, setMessage] = useState("");
  const [pipelineName, setPipelineName] = useState("tekforge-pipeline");
  const [applicationId, setApplicationId] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [runId, setRunId] = useState("");
  const [runStatus, setRunStatus] = useState("not_started");
  const [runAgent, setRunAgent] = useState<any>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [stageSearch, setStageSearch] = useState("");
  const [showLibrary, setShowLibrary] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ state: "idle" | "testing" | "connected" | "failed"; message?: string }>({ state: "idle" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const app = params.get("applicationId") || "";
    const requestedPipeline = params.get("pipelineId") || "";
    const isNew = params.get("new") === "1";
    setApplicationId(app);
    setPipelineId(isNew ? "" : requestedPipeline);
    Promise.all([
      fetch("/api/agent/clusters", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ clusters: [] })),
      fetch("/api/applications", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ applications: [] })),
      fetch(app ? `/api/pipelines?applicationId=${encodeURIComponent(app)}` : "/api/pipelines", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ pipelines: [] })),
    ]).then(([clusterData, appData, pipelineData]) => {
      setClusters(clusterData.clusters || []);
      setApplications(appData.applications || []);
      const selectedApp = app ? (appData.applications || []).find((item: any) => item.id === app) : (appData.applications || [])[0];
      if (!app && selectedApp) setApplicationId(selectedApp.id);
      const availablePipelines = pipelineData.pipelines || [];
      const existingPipelineId = !isNew ? (requestedPipeline || availablePipelines[0]?.id || "") : "";
      if (existingPipelineId) {
        setPipelineId(existingPipelineId);
        const existing = availablePipelines.find((item: any) => item.id === existingPipelineId);
        const graph = existing?.spec?.graph;
        if (existing) setPipelineName(existing.name || "tekforge-pipeline");
        if (graph?.nodes?.length) {
          setRuntime(graph.runtime || "nodejs-22");
          setEnvironment(graph.environment || "production");
          const restored = graph.nodes.map((node: any, index: number) => ({
            id: node.id,
            type: "stage",
            position: { x: 100 + (index % 3) * 300, y: 80 + Math.floor(index / 3) * 190 },
            data: { label: node.label, detail: node.detail || definitions.find((d) => d.type === node.type)?.detail || "", type: node.type, config: node.config || definitions.find((d) => d.type === node.type)?.defaults || {} },
          })) as StageNode[];
          setNodes(restored);
          setEdges((graph.edges || []).map((edge: any) => ({ id: `${edge.from}-${edge.to}`, source: edge.from, target: edge.to })));
          setSelectedId(restored[0]?.id || "");
        } else if (selectedApp) {
          setNodes((current) => current.map((node) => node.data.type === "source" ? { ...node, data: { ...node.data, config: { ...node.data.config, repository: selectedApp.repository_url, branch: selectedApp.default_branch || "main" } } } : node));
        }
      } else if (selectedApp) {
        setPipelineName(`${selectedApp.name}-delivery`);
        setRuntime(`${selectedApp.runtime || "nodejs"}-${selectedApp.runtime_version || "22"}`);
        setNodes((current) => current.map((node) => node.data.type === "source" ? { ...node, data: { ...node.data, config: { ...node.data.config, repository: selectedApp.repository_url, branch: selectedApp.default_branch || "main" } } } : node));
      }
    });  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!runId) return;
    const poll = async () => {
      try {
        const response = await fetch(`/api/pipeline-runs/${runId}/status`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to read run status");
        setRunStatus(data.run?.status || data.status || "queued");
        setRunAgent(data.agent || null);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Unable to read run status");
      }
    };
    poll();
    const timer = window.setInterval(poll, 4000);
    return () => window.clearInterval(timer);
  }, [runId]);

  const selected = useMemo(() => nodes.find((node) => node.id === selectedId), [nodes, selectedId]);
  const filteredDefinitions = useMemo(() => {
    const query = stageSearch.trim().toLowerCase();
    return definitions.filter((item) => !query || [item.label, item.detail, item.category].join(" ").toLowerCase().includes(query));
  }, [stageSearch]);

  async function openTemplates() {
    setShowTemplates(true);
    if (templates.length) return;
    setTemplateLoading(true);
    try {
      const response = await fetch("/api/pipeline-templates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load templates");
      setTemplates(data.templates || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load templates");
    } finally {
      setTemplateLoading(false);
    }
  }

  function applyGraph(graph: any, name?: string) {
    const restored = (graph.nodes || []).map((item: any, index: number) => ({
      id: item.id,
      type: "stage",
      position: { x: 100 + (index % 3) * 300, y: 80 + Math.floor(index / 3) * 190 },
      data: {
        label: item.label,
        detail: item.detail || definitions.find((d) => d.type === item.type)?.detail || "",
        type: item.type,
        config: item.config || definitions.find((d) => d.type === item.type)?.defaults || {},
      },
    })) as StageNode[];
    setNodes(restored);
    setEdges((graph.edges || []).map((edge: any) => ({
      id: edge.from + "-" + edge.to,
      source: edge.from,
      target: edge.to,
    })));
    setSelectedId(restored[0]?.id || "");
    setRuntime(graph.runtime || "nodejs-22");
    setEnvironment(graph.environment || "production");
    if (name) setPipelineName(name);
    setMessage("Pipeline graph loaded. Review the configuration before saving or deploying.");
  }

  async function useTemplate(id: string) {
    setTemplateLoading(true);
    try {
      const response = await fetch("/api/pipeline-templates?id=" + encodeURIComponent(id), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load template");
      applyGraph(data.template.graph, data.template.name);
      setShowTemplates(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load template");
    } finally {
      setTemplateLoading(false);
    }
  }

  async function autoGenerate() {
    if (!applicationId) {
      setMessage("Select an application before generating a pipeline.");
      return;
    }
    const application = applications.find((item) => item.id === applicationId);
    if (!application?.repository_url) {
      setMessage("The selected application does not have a repository URL.");
      return;
    }

    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/repository/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: application.repository_url, branch: application.default_branch || "main" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Repository analysis failed");

      const analysis = data.analysis;
      const generated: any[] = [];
      const addGenerated = (type: StageType, label: string, config: StageConfig = {}) => {
        const def = definitions.find((item) => item.type === type)!;
        generated.push({
          id: type + "-" + (generated.length + 1),
          type: "stage",
          position: { x: 100 + (generated.length % 3) * 300, y: 80 + Math.floor(generated.length / 3) * 190 },
          data: { label, detail: def.detail, type, config: { ...def.defaults, ...config } },
        });
      };

      addGenerated("source", "Git Checkout", { provider: "GitHub", repository: data.repository.url, branch: data.repository.branch });
      addGenerated("build", "Build", { buildTool: analysis.buildTool, command: analysis.buildCommand });
      if (analysis.testCommand) addGenerated("test", "Test", { testCommand: analysis.testCommand });
      addGenerated("security", "Security Scan", { scanners: ["Trivy"], failOn: "High or Critical" });
      if (analysis.dockerfile) addGenerated("image", "Build Image", { registry: "Artifact Registry", tag: "$(commit)" });
      addGenerated("deploy", "Kubernetes Deploy", { target: "Kubernetes", namespace: namespace || "default", manifestPath: "k8s/", strategy: "Rolling" });
      addGenerated("verify", "Deployment Verify", { check: "Kubernetes rollout", timeout: "10m", onFailure: "Fail" });

      const generatedNodes = generated as StageNode[];
      const generatedEdges = generatedNodes.slice(1).map((item, index) => ({
        id: generatedNodes[index].id + "-" + item.id,
        source: generatedNodes[index].id,
        target: item.id,
      }));
      setNodes(generatedNodes);
      setEdges(generatedEdges);
      setSelectedId(generatedNodes[0]?.id || "");
      setRuntime(analysis.runtime + "-" + analysis.runtimeVersion);
      setPipelineName(data.repository.repo + "-delivery");
      setMessage("Generated from repository analysis: " + (analysis.framework || analysis.runtime) + " · " + analysis.confidence + " confidence. Review stages before deployment.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate pipeline");
    } finally {
      setGenerating(false);
    }
  }

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEdges((current) => addEdge({ ...connection, animated: true, style: { stroke: "#5b7fc9", strokeWidth: 1.8 } }, current));
  }, [setEdges]);

  function addStage(def: StageDefinition) {
    const node = createNode(def, nodes.length);
    setNodes((current) => [...current, node]);
    setSelectedId(node.id);
    setMessage(`${def.label} added. Configure it in the inspector.`);
  }

  function updateSelectedConfig(key: keyof StageConfig, value: string | string[] | boolean | number) {
    if (!selected) return;
    setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, data: { ...node.data, config: { ...node.data.config, [key]: value } } } : node));
  }

  function toggleScanner(scanner: string) {
    if (!selected) return;
    const current = Array.isArray(selected.data.config.scanners) ? selected.data.config.scanners : [];
    updateSelectedConfig("scanners", current.includes(scanner) ? current.filter((item) => item !== scanner) : [...current, scanner]);
  }

  function removeSelected() {
    if (!selected) return;
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) => current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id));
    setSelectedId("");
  }

  function graphPayload() {
    return {
      version: 4,
      runtime,
      environment,
      nodes: nodes.map((node) => ({ id: node.id, type: node.data.type, label: node.data.label, detail: node.data.detail, config: node.data.config })),
      edges: edges.map((edge) => ({ from: edge.source, to: edge.target })),
    };
  }

  async function savePipeline(): Promise<string | null> {
    if (!applicationId) { setMessage("Select an application before saving the pipeline."); return null; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: pipelineId || undefined, applicationId, name: pipelineName, tektonPipelineName: pipelineName, template: "visual", spec: { runtime, environment, graph: graphPayload() } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save pipeline");
      setPipelineId(data.pipeline.id);
      setMessage("Pipeline saved.");
      return data.pipeline.id;
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save pipeline"); return null; }
    finally { setSaving(false); }
  }

  async function deployPipeline() {
    if (!clusterId) { setMessage("Select a connected cluster first."); return; }
    setSaving(true); setMessage("");
    try {
      const targetPipelineId = pipelineId || await savePipeline();
      if (!targetPipelineId) return;
      const response = await fetch(`/api/pipelines/${targetPipelineId}/deploy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clusterId, namespace, graph: graphPayload() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Deployment failed");
      setMessage("Deployment queued. The connected agent will apply the Tekton resources.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Deployment failed"); }
    finally { setSaving(false); }
  }

  async function runPipeline() {
    if (!pipelineId) { setMessage("Save the pipeline before running it."); return; }
    if (!clusterId) { setMessage("Select a connected cluster first."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/pipelines/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipelineId, clusterId, namespace }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start pipeline");
      setRunId(data.run?.id || "");
      setRunStatus(data.run?.status || "queued");
      setMessage("PipelineRun queued. Waiting for the agent.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to start pipeline"); }
    finally { setSaving(false); }
  }

  async function testIntegrationConnection() {
    if (!selected || selected.data.type !== "quality") return;
    const tool = selected.data.config.tool || "sonarqube";
    if (!["sonarqube", "sonarcloud"].includes(tool)) {
      setConnectionStatus({ state: "connected", message: "This integration does not require an external connection." });
      return;
    }
    if (!clusterId) {
      setConnectionStatus({ state: "failed", message: "Select a connected cluster first. The test runs from the agent cluster so private SonarQube URLs work." });
      return;
    }
    if (!selected.data.config.serverUrl) {
      setConnectionStatus({ state: "failed", message: "Enter the SonarQube/SonarCloud URL first." });
      return;
    }
    setTestingConnection(true);
    setConnectionStatus({ state: "testing", message: "Testing from the connected cluster agent…" });
    try {
      const response = await fetch("/api/integrations/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clusterId,
          namespace,
          integration: tool,
          serverUrl: selected.data.config.serverUrl,
          credentialSecret: selected.data.config.credentialSecret || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start connection test");
      if (!data.commandId) {
        setConnectionStatus({ state: data.status === "ready" ? "connected" : "failed", message: data.message });
        return;
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/integrations/test-connection/status?id=${encodeURIComponent(data.commandId)}`, { cache: "no-store" });
        const status = await statusResponse.json();
        if (status.status === "completed") {
          setConnectionStatus({
            state: "connected",
            message: `${tool === "sonarcloud" ? "SonarCloud" : "SonarQube"} connected successfully · ${status.result?.systemStatus || "UP"}${status.result?.credentialValidated ? " · credential validated" : ""}`,
          });
          return;
        }
        if (status.status === "failed") throw new Error(status.error || "Connection test failed");
      }
      throw new Error("Connection test timed out. Check that the agent is connected and can reach the configured URL.");
    } catch (error) {
      setConnectionStatus({ state: "failed", message: error instanceof Error ? error.message : "Connection test failed" });
    } finally {
      setTestingConnection(false);
    }
  }

  async function compile() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/pipelines/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(graphPayload()) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Compilation failed");
      setCompileResult(data.pipelineYaml || "");
      setShowCompile(true);
      setMessage("Pipeline validated and compiled successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Compilation failed");
      setShowCompile(true);
    } finally { setSaving(false); }
  }

  function inspector() {
    if (!selected) return <div className="inspector-empty"><div>＋</div><strong>Select a stage</strong><span>Click any node on the canvas to configure it.</span></div>;
    const def = definitions.find((item) => item.type === selected.data.type)!;
    const c = selected.data.config || {};
    return (
      <div className="inspector-content">
        <div className="inspector-stage-head"><span className="inspector-icon">{def.icon}</span><div><div className="inspector-category">{def.category}</div><h2>{selected.data.label}</h2><p>{def.description}</p></div></div>
        {selected.data.type === "source" && <><Field label="Git provider"><select value={c.provider || "GitHub"} onChange={(e) => updateSelectedConfig("provider", e.target.value)}><option>GitHub</option><option>GitLab</option><option>Bitbucket</option></select></Field><Field label="Repository" hint="HTTPS or SSH repository URL"><input value={c.repository || ""} onChange={(e) => updateSelectedConfig("repository", e.target.value)} placeholder="https://github.com/org/repository" /></Field><Field label="Branch / revision"><input value={c.branch || "main"} onChange={(e) => updateSelectedConfig("branch", e.target.value)} placeholder="main" /></Field></>}
        {selected.data.type === "build" && <><Field label="Build system"><select value={c.buildTool || "Auto detect"} onChange={(e) => updateSelectedConfig("buildTool", e.target.value)}><option>Auto detect</option><option>npm</option><option>pnpm</option><option>yarn</option><option>Maven</option><option>Gradle</option><option>pip</option><option>Go</option></select></Field><Field label="Build command"><input value={c.command || ""} onChange={(e) => updateSelectedConfig("command", e.target.value)} placeholder="npm run build" /></Field></>}
        {selected.data.type === "test" && <><Field label="Testing tool"><select value={c.tool || "test-command"} onChange={(e) => { const tool = e.target.value; const item = getTaskCatalogItem(tool); updateSelectedConfig("tool", tool); if (item) { for (const field of item.fields) if (field.defaultValue !== undefined) updateSelectedConfig(field.key as keyof StageConfig, String(field.defaultValue)); } }}>{taskCatalog.filter((item) => item.category === "Testing").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>{getTaskCatalogItem(c.tool || "test-command")?.description}</small></Field><Field label="Test command"><input value={c.testCommand || ""} onChange={(e) => updateSelectedConfig("testCommand", e.target.value)} placeholder="npm test" /></Field><Field label="Coverage"><select value={c.coverage ? "yes" : "no"} onChange={(e) => updateSelectedConfig("coverage", e.target.value === "yes")}><option value="yes">Collect coverage</option><option value="no">Skip coverage</option></select></Field><Field label="Coverage output"><input value={c.coveragePath || ""} onChange={(e) => updateSelectedConfig("coveragePath", e.target.value)} placeholder="coverage/lcov.info" /></Field><Field label="Base URL (E2E)"><input value={c.baseUrl || ""} onChange={(e) => updateSelectedConfig("baseUrl", e.target.value)} placeholder="https://staging.example.com" /></Field><Field label="Timeout"><select value={c.timeout || "10m"} onChange={(e) => updateSelectedConfig("timeout", e.target.value)}><option>5m</option><option>10m</option><option>20m</option><option>30m</option><option>60m</option></select></Field></>}
        {selected.data.type === "security" && <><Field label="Primary scanner"><select value={c.tool || "trivy"} onChange={(e) => updateSelectedConfig("tool", e.target.value)}><option value="trivy">Trivy</option><option value="gitleaks">Gitleaks</option><option value="dependency-scan">Dependency Scan</option></select></Field><div className="inspector-label">Additional scanners</div><div className="check-grid">{["Trivy","Gitleaks","Dependency"].map((scanner) => <button type="button" key={scanner} className={`check-chip ${c.scanners?.includes(scanner) ? "checked" : ""}`} onClick={() => toggleScanner(scanner)}><span>{c.scanners?.includes(scanner) ? "✓" : ""}</span>{scanner}</button>)}</div><Field label="Severity"><select value={c.severity || "HIGH,CRITICAL"} onChange={(e) => updateSelectedConfig("severity", e.target.value)}><option>CRITICAL</option><option>HIGH,CRITICAL</option><option>MEDIUM,HIGH,CRITICAL</option></select></Field><Field label="Fail pipeline on"><select value={String(c.failOn || "High or Critical")} onChange={(e) => updateSelectedConfig("failOn", e.target.value)}><option>Critical</option><option>High or Critical</option><option>Never</option></select></Field><Field label="Credential Secret (optional)"><input value={c.credentialSecret || ""} onChange={(e) => updateSelectedConfig("credentialSecret", e.target.value)} placeholder="registry-credentials" /></Field></>}
        {selected.data.type === "quality" && <><Field label="Quality tool"><select value={c.tool || "sonarqube"} onChange={(e) => updateSelectedConfig("tool", e.target.value)}><option value="sonarqube">SonarQube</option><option value="sonarcloud">SonarCloud</option></select></Field><Field label="Server URL" hint="For self-hosted SonarQube use your reachable cluster URL"><input value={c.serverUrl || ""} onChange={(e) => updateSelectedConfig("serverUrl", e.target.value)} placeholder="https://sonarqube.example.com" /></Field><Field label="Project key"><input value={c.projectKey || ""} onChange={(e) => updateSelectedConfig("projectKey", e.target.value)} placeholder="my-service" /></Field><Field label="Organization (SonarCloud)"><input value={c.organization || ""} onChange={(e) => updateSelectedConfig("organization", e.target.value)} placeholder="my-org" /></Field><Field label="Kubernetes Secret" hint="Secret must contain SONAR_TOKEN. TekForge only stores the secret name."><input value={c.credentialSecret || ""} onChange={(e) => updateSelectedConfig("credentialSecret", e.target.value)} placeholder="sonarqube-credentials" /></Field><div className="connection-test"><button type="button" className="connection-test-button" onClick={testIntegrationConnection} disabled={testingConnection}>{testingConnection ? "Testing connection…" : "Test connection"}</button>{connectionStatus.state !== "idle" && <div className={`connection-result ${connectionStatus.state}`}>{connectionStatus.state === "connected" ? "✓ " : connectionStatus.state === "failed" ? "⚠ " : "• "}{connectionStatus.message}</div>}</div><Field label="Sources"><input value={c.sources || "."} onChange={(e) => updateSelectedConfig("sources", e.target.value)} /></Field><Field label="Quality gate"><select value={c.qualityGate || "Wait and fail"} onChange={(e) => updateSelectedConfig("qualityGate", e.target.value)}><option>Wait and fail</option><option>Wait and warn</option><option>Do not wait</option></select></Field><Field label="Timeout"><select value={c.timeout || "10m"} onChange={(e) => updateSelectedConfig("timeout", e.target.value)}><option>5m</option><option>10m</option><option>20m</option><option>30m</option></select></Field></>}
        {selected.data.type === "image" && <><Field label="Container registry"><select value={c.registry || "Artifact Registry"} onChange={(e) => updateSelectedConfig("registry", e.target.value)}><option>Artifact Registry</option><option>Docker Hub</option><option>Amazon ECR</option><option>Google Artifact Registry</option><option>Custom registry</option></select></Field><Field label="Image repository"><input value={c.image || ""} onChange={(e) => updateSelectedConfig("image", e.target.value)} placeholder="us-central1-docker.pkg.dev/project/app" /></Field><Field label="Image tag"><input value={c.tag || "$(commit)"} onChange={(e) => updateSelectedConfig("tag", e.target.value)} placeholder="$(commit)" /></Field></>}
        {selected.data.type === "deploy" && <><Field label="Deployment target"><select value={c.target || "Kubernetes"} onChange={(e) => updateSelectedConfig("target", e.target.value)}><option>Kubernetes</option><option>Helm</option><option>Argo CD</option></select></Field><Field label="Namespace"><input value={c.namespace || "default"} onChange={(e) => updateSelectedConfig("namespace", e.target.value)} /></Field><Field label="Manifest / chart path"><input value={c.manifestPath || "k8s/"} onChange={(e) => updateSelectedConfig("manifestPath", e.target.value)} /></Field><Field label="Rollout strategy"><select value={c.strategy || "Rolling"} onChange={(e) => updateSelectedConfig("strategy", e.target.value)}><option>Rolling</option><option>Recreate</option><option>Canary</option></select></Field></>}
        {selected.data.type === "approval" && <><Field label="Environment"><select value={c.environment || "production"} onChange={(e) => updateSelectedConfig("environment", e.target.value)}><option>development</option><option>qa</option><option>staging</option><option>production</option></select></Field><Field label="Approval message"><textarea value={c.message || ""} onChange={(e) => updateSelectedConfig("message", e.target.value)} placeholder="Approve production deployment" rows={3} /></Field><Field label="Approval timeout"><select value={c.timeout || "24h"} onChange={(e) => updateSelectedConfig("timeout", e.target.value)}><option>1h</option><option>4h</option><option>24h</option><option>72h</option></select></Field></>}
        {selected.data.type === "trigger" && <><Field label="Git provider"><select value={c.provider || "GitHub"} onChange={(e) => updateSelectedConfig("provider", e.target.value)}><option>GitHub</option><option>GitLab</option><option>Bitbucket</option></select></Field><Field label="Event"><select value={c.event || "Push"} onChange={(e) => updateSelectedConfig("event", e.target.value)}><option>Push</option><option>Pull request</option><option>Tag</option><option>Manual</option></select></Field><Field label="Branch"><input value={c.branch || "main"} onChange={(e) => updateSelectedConfig("branch", e.target.value)} /></Field></>}
        {selected.data.type === "helm" && <><Field label="Release name"><input value={c.release || ""} onChange={(e) => updateSelectedConfig("release", e.target.value)} placeholder="my-app" /></Field><Field label="Chart path / repository"><input value={c.chart || "./helm"} onChange={(e) => updateSelectedConfig("chart", e.target.value)} /></Field><Field label="Namespace"><input value={c.namespace || "default"} onChange={(e) => updateSelectedConfig("namespace", e.target.value)} /></Field><Field label="Values file"><input value={c.values || "values.yaml"} onChange={(e) => updateSelectedConfig("values", e.target.value)} /></Field><Field label="Strategy"><select value={c.strategy || "Rolling"} onChange={(e) => updateSelectedConfig("strategy", e.target.value)}><option>Rolling</option><option>Canary</option><option>Blue-green</option></select></Field></>}
        {selected.data.type === "gitops" && <><Field label="Argo CD server URL"><input value={c.serverUrl || ""} onChange={(e) => updateSelectedConfig("serverUrl", e.target.value)} placeholder="https://argocd.example.com" /></Field><Field label="Argo application"><input value={c.application || ""} onChange={(e) => updateSelectedConfig("application", e.target.value)} placeholder="my-app-production" /></Field><Field label="Revision"><input value={c.revision || "main"} onChange={(e) => updateSelectedConfig("revision", e.target.value)} /></Field><Field label="Kubernetes Secret" hint="Secret must contain ARGOCD_AUTH_TOKEN."><input value={c.credentialSecret || ""} onChange={(e) => updateSelectedConfig("credentialSecret", e.target.value)} placeholder="argocd-credentials" /></Field><Field label="Sync policy"><select value={c.syncPolicy || "Automated"} onChange={(e) => updateSelectedConfig("syncPolicy", e.target.value)}><option>Automated</option><option>Manual</option></select></Field></>}
        {selected.data.type === "verify" && <><Field label="Verification check"><select value={c.check || "Kubernetes rollout"} onChange={(e) => updateSelectedConfig("check", e.target.value)}><option>Kubernetes rollout</option><option>HTTP smoke test</option><option>Prometheus metric</option><option>Custom command</option></select></Field><Field label="Endpoint (optional)"><input value={c.endpoint || ""} onChange={(e) => updateSelectedConfig("endpoint", e.target.value)} placeholder="https://api.example.com/health" /></Field><Field label="Prometheus URL"><input value={c.serverUrl || ""} onChange={(e) => updateSelectedConfig("serverUrl", e.target.value)} placeholder="http://prometheus.monitoring.svc:9090" /></Field><Field label="PromQL query"><input value={c.query || ""} onChange={(e) => updateSelectedConfig("query", e.target.value)} placeholder={'sum(up{job="my-app"}) > 0'} /></Field><Field label="Timeout"><select value={c.timeout || "10m"} onChange={(e) => updateSelectedConfig("timeout", e.target.value)}><option>5m</option><option>10m</option><option>20m</option></select></Field><Field label="On failure"><select value={c.onFailure || "Fail"} onChange={(e) => updateSelectedConfig("onFailure", e.target.value)}><option>Fail</option><option>Warn</option><option>Rollback</option></select></Field></>}
        {selected.data.type === "notify" && <><Field label="Channel"><select value={c.channel || "Slack"} onChange={(e) => updateSelectedConfig("channel", e.target.value)}><option>Slack</option><option>Microsoft Teams</option><option>Email</option><option>Webhook</option></select></Field><Field label="Target"><input value={c.target || ""} onChange={(e) => updateSelectedConfig("target", e.target.value)} placeholder="#deployments or webhook URL" /></Field><Field label="Message"><textarea value={c.message || ""} onChange={(e) => updateSelectedConfig("message", e.target.value)} placeholder="Deployment completed" rows={3} /></Field><Field label="Notify on"><select value={c.event || "Failure or completion"} onChange={(e) => updateSelectedConfig("event", e.target.value)}><option>Failure</option><option>Success</option><option>Failure or completion</option><option>Every stage</option></select></Field></>}
        {selected.data.type === "rollback" && <><Field label="Rollback target"><select value={c.target || "Kubernetes"} onChange={(e) => updateSelectedConfig("target", e.target.value)}><option>Kubernetes</option><option>Helm</option><option>Argo CD</option></select></Field><Field label="Revision"><select value={c.revision || "Previous successful"} onChange={(e) => updateSelectedConfig("revision", e.target.value)}><option>Previous successful</option><option>Specific revision</option></select></Field><Field label="Trigger condition"><select value={c.condition || "Verification failed"} onChange={(e) => updateSelectedConfig("condition", e.target.value)}><option>Verification failed</option><option>Manual</option><option>Deployment timeout</option></select></Field></>}
        <div className="inspector-divider" />
        <div className="inspector-meta"><span>Node ID</span><code>{selected.id}</code></div>
        <button className="remove-node" onClick={removeSelected}>Remove stage</button>
      </div>
    );
  }

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-title"><a href="/" className="studio-logo">TF</a><div><div className="studio-breadcrumb"><a href="/">TekForge</a><span>/</span><strong>Pipeline Studio</strong></div><div className="studio-name"><input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} aria-label="Pipeline name" /><span className="saved-dot" title="Local changes"></span></div></div></div>
        <div className="studio-actions"><span className="studio-status"><i /> {nodes.length} stages · {edges.length} connections</span><button className="tool-button" onClick={openTemplates}>Templates</button><button className="tool-button" onClick={autoGenerate} disabled={generating}>{generating ? "Analyzing…" : "Auto generate"}</button><button className="tool-button" onClick={() => setShowLibrary((value) => !value)}>Stages</button><button className="tool-button" onClick={() => setShowCompile(true)} disabled={!compileResult}>Code</button><button className="tool-button" onClick={() => { setNodes(initialNodes); setEdges(initialEdges); setSelectedId(initialNodes[0]?.id || ""); }}>Reset</button><button className="tool-button" disabled={saving} onClick={savePipeline}>{saving ? "Saving…" : "Save"}</button><button className="compile-button" disabled={saving} onClick={compile}>{saving ? "Validating…" : "Validate & compile"}</button></div>
      </header>

      <div className="studio-workspace">
        {showLibrary && <aside className="stage-library">
          <div className="library-head"><div><div className="panel-kicker">STAGE LIBRARY</div><h2>Build your pipeline</h2></div><button className="panel-close" onClick={() => setShowLibrary(false)}>×</button></div>
          <div className="stage-search"><span>⌕</span><input value={stageSearch} onChange={(e) => setStageSearch(e.target.value)} placeholder="Search stages..." /><kbd>⌘ K</kbd></div>
          <p className="library-hint">Select a stage to add it to the canvas. Configure it after adding.</p>
          <div className="library-list">{filteredDefinitions.map((def) => <button className="library-stage" key={def.type} onClick={() => addStage(def)}><span className="library-icon">{def.icon}</span><span><strong>{def.label}</strong><small>{def.detail}</small></span><b>+</b></button>)}{filteredDefinitions.length === 0 && <div className="no-results">No stages match “{stageSearch}”.</div>}</div>
          <div className="library-footer"><strong>Tip</strong><span>Connect the output handle of one stage to the input of another to define execution order.</span></div>
        </aside>}

        <section className="studio-canvas" onDrop={(e) => { e.preventDefault(); const type = e.dataTransfer.getData("tekforge-stage") as StageType; const def = definitions.find((item) => item.type === type); if (def) addStage(def); }} onDragOver={(e) => e.preventDefault()}>
          <div className="canvas-toolbar"><span><strong>Canvas</strong><small>Drag nodes · connect stages · click to configure</small></span><div><button onClick={() => setShowLibrary(true)}>＋ Add stage</button><button onClick={() => setSelectedId("")}>Deselect</button></div></div>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId("")} fitView snapToGrid snapGrid={[16, 16]} attributionPosition="bottom-left" defaultEdgeOptions={{ animated: true, style: { stroke: "#8da4c8", strokeWidth: 1.8 } }}>
            <Background gap={22} size={1} color="#dbe3ef" /><Controls position="bottom-left" /><MiniMap pannable zoomable nodeColor="#8ba9dd" />
          </ReactFlow>
        </section>

        <aside className="stage-inspector">
          <div className="inspector-head"><div><div className="panel-kicker">CONFIGURATION</div><h2>{selected ? "Stage settings" : "Pipeline settings"}</h2></div><span className="inspector-state">LIVE</span></div>
          {!selected ? <div className="pipeline-settings"><Field label="Application"><select value={applicationId} onChange={(e) => setApplicationId(e.target.value)}><option value="">Select application</option>{applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></Field><Field label="Runtime"><select value={runtime} onChange={(e) => setRuntime(e.target.value)}><option value="nodejs-22">Node.js 22</option><option value="java-21">Java 21</option><option value="python-3.12">Python 3.12</option><option value="go-1.24">Go 1.24</option></select></Field><Field label="Environment"><select value={environment} onChange={(e) => setEnvironment(e.target.value)}><option>development</option><option>qa</option><option>staging</option><option>production</option></select></Field><Field label="Execution cluster"><select value={clusterId} onChange={(e) => setClusterId(e.target.value)}><option value="">Select connected agent</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name} · {cluster.status}</option>)}</select></Field><Field label="Namespace"><input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="tekforge" /></Field><div className="settings-note">Pipeline settings apply to the whole graph. Select a stage to configure its individual behavior.</div><div className="run-actions"><button className="secondary wide-button" disabled={saving} onClick={savePipeline}>Save pipeline</button><button className="compile-button wide-button" disabled={saving} onClick={deployPipeline}>{saving ? "Deploying…" : "Deploy pipeline"}</button><button className="run-button wide-button" disabled={saving || !pipelineId} onClick={runPipeline}>Run pipeline</button></div></div> : inspector()}
          {message && <div className="studio-message">{message}</div>}
          {runId && <div className="live-run"><div className="panel-kicker">LIVE RUN</div><div className="run-status"><span className={`run-dot ${runStatus}`} />{runStatus}</div><small>{runId}</small>{runAgent?.tasks?.length ? <div className="run-tasks">{runAgent.tasks.map((task: any) => <div key={task.name}><strong>{task.name}</strong><span>{task.status?.conditions?.find((x: any) => x.type === "Succeeded")?.reason || "running"}</span></div>)}</div> : null}</div>}
        </aside>
      </div>

      {showTemplates && <div className="template-overlay" onClick={() => setShowTemplates(false)}>
        <div className="template-modal" onClick={(event) => event.stopPropagation()}>
          <div className="template-head">
            <div><div className="panel-kicker">PIPELINE TEMPLATES</div><h2>Start from a proven delivery pattern</h2><p>Templates are editable graphs, not locked workflows. Load one, configure it, then validate and deploy.</p></div>
            <button className="panel-close" onClick={() => setShowTemplates(false)}>×</button>
          </div>
          {templateLoading ? <div className="template-loading">Loading templates…</div> : <div className="template-grid">{templates.map((template) => <button key={template.id} className="template-card" onClick={() => useTemplate(template.id)}>
            <div className="template-card-top"><span className="template-category">{template.category}</span>{template.featured && <span className="template-featured">Featured</span>}</div>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="template-tags">{(template.tags || []).map((tag: string) => <span key={tag}>{tag}</span>)}</div>
            <div className="template-use">Use template <b>→</b></div>
          </button>)}</div>}
        </div>
      </div>}
      {showCompile && <div className="code-overlay"><div className="code-modal"><div className="code-modal-head"><div><div className="panel-kicker">TEKTON OUTPUT</div><h2>Compiled pipeline</h2></div><button className="panel-close" onClick={() => setShowCompile(false)}>×</button></div><pre>{compileResult || "Run Validate & compile to generate Tekton resources."}</pre></div></div>}
    </main>
  );
}

