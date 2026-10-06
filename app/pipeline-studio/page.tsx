"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type StageType = "source" | "build" | "test" | "security" | "image" | "deploy" | "approval";
type StageNode = Node<{ label: string; detail: string; type: StageType }, "stage">;

const library: Array<{ type: StageType; label: string; detail: string }> = [
  { type: "source", label: "Git Checkout", detail: "GitHub / GitLab / Bitbucket" },
  { type: "build", label: "Build", detail: "Node / Java / Python / Go" },
  { type: "test", label: "Test", detail: "Unit / integration" },
  { type: "security", label: "Security", detail: "Trivy / SAST / dependency" },
  { type: "image", label: "Build Image", detail: "Kaniko / BuildKit / Jib" },
  { type: "deploy", label: "Deploy", detail: "Kubernetes / Helm / Kustomize" },
  { type: "approval", label: "Approval", detail: "Environment gate" },
];

const initialNodes: StageNode[] = [
  { id: "source", type: "stage", position: { x: 80, y: 80 }, data: library[0] },
  { id: "build", type: "stage", position: { x: 80, y: 230 }, data: library[1] },
  { id: "test", type: "stage", position: { x: 80, y: 380 }, data: library[2] },
  { id: "security", type: "stage", position: { x: 80, y: 530 }, data: library[3] },
  { id: "image", type: "stage", position: { x: 80, y: 680 }, data: library[4] },
  { id: "deploy", type: "stage", position: { x: 80, y: 830 }, data: library[5] },
];

const initialEdges: Edge[] = initialNodes.slice(0, -1).map((node, index) => ({ id: `${node.id}-${initialNodes[index + 1].id}`, source: node.id, target: initialNodes[index + 1].id, animated: true }));

function StageCard({ data, selected }: NodeProps<StageNode>) {
  return (
    <div style={{ width: 260, border: selected ? "2px solid #101828" : "1px solid #d0d5dd", borderRadius: 14, background: "white", boxShadow: "0 8px 24px rgba(16,24,40,.10)", padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "#667085" }}>{data.type.toUpperCase()}</div>
      <div style={{ fontWeight: 800, marginTop: 5 }}>{data.label}</div>
      <div style={{ color: "#667085", fontSize: 12, marginTop: 4 }}>{data.detail}</div>
    </div>
  );
}

const nodeTypes = { stage: StageCard };

export default function PipelineStudio() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StageNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState("deploy");
  const [runtime, setRuntime] = useState("nodejs-22");
  const [environment, setEnvironment] = useState("production");
  const [compileResult, setCompileResult] = useState<string>("");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setApplicationId(params.get("applicationId") || "");
    setPipelineId(params.get("pipelineId") || "");
  }, []);

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

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, animated: true }, current));
  }, [setEdges]);

  function addStage(item: typeof library[number]) {
    const id = `${item.type}-${crypto.randomUUID()}`;
    setNodes((current) => [...current, { id, type: "stage", position: { x: 520, y: 100 + current.length * 100 }, data: item }]);
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selected) return;
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) => current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id));
    setSelectedId("");
  }

  function graphPayload() {
    return {
      version: 2,
      runtime,
      environment,
      nodes: nodes.map((node) => ({ id: node.id, type: node.data.type, label: node.data.label, detail: node.data.detail })),
      edges: edges.map((edge) => ({ from: edge.source, to: edge.target })),
    };
  }

  async function savePipeline(): Promise<string | null> {
    if (!applicationId) { setMessage("Open Pipeline Studio with an applicationId, for example /pipeline-studio?applicationId=<id>."); return null; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, name: pipelineName, tektonPipelineName: pipelineName, template: "visual", spec: { runtime, environment, graph: graphPayload() } }),
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
    if (!pipelineId) { await savePipeline(); return; }
    if (!clusterId) { setMessage("Enter a connected cluster ID."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/pipelines/${targetPipelineId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId, namespace, graph: graphPayload() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Deployment failed");
      setMessage(`Deployment queued. Agent command ${data.commandId} is waiting for the cluster agent.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Deployment failed"); }
    finally { setSaving(false); }
  }

  async function runPipeline() {
    if (!pipelineId) { setMessage("Save the pipeline before running it."); return; }
    if (!clusterId) { setMessage("Enter a connected cluster ID."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/pipelines/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, clusterId, namespace }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start pipeline");
      setRunId(data.run?.id || "");
      setRunStatus(data.run?.status || "queued");
      setMessage("PipelineRun queued. The agent will create it in the connected cluster.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to start pipeline"); }
    finally { setSaving(false); }
  }


  async function compile() {
    setSaving(true);
    setCompileResult("");
    const graph = {
      version: 2,
      runtime,
      environment,
      nodes: nodes.map((node) => ({ id: node.id, type: node.data.type, label: node.data.label, detail: node.data.detail })),
      edges: edges.map((edge) => ({ from: edge.source, to: edge.target })),
    };
    try {
      const response = await fetch("/api/pipelines/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(graph) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Compilation failed");
      setCompileResult(data.pipelineYaml);
    } catch (error) {
      setCompileResult(error instanceof Error ? error.message : "Compilation failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", color: "#101828", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ height: 68, background: "white", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div><a href="/" style={{ color: "#667085", textDecoration: "none" }}>TekForge</a><span style={{ margin: "0 10px", color: "#d0d5dd" }}>/</span><strong>Pipeline Studio</strong></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={secondary} onClick={() => { setNodes(initialNodes); setEdges(initialEdges); }}>Reset</button>
          <button style={secondary} disabled={saving} onClick={savePipeline}>{saving ? "Saving…" : "Save pipeline"}</button>
          <button style={primary} disabled={saving} onClick={compile}>{saving ? "Working…" : "Validate & compile"}</button>
        </div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr 300px", height: "calc(100vh - 68px)" }}>
        <aside style={{ background: "white", borderRight: "1px solid #eaecf0", padding: 18, overflow: "auto" }}>
          <div style={eyebrow}>TASK LIBRARY</div><p style={muted}>Drag-and-drop foundation. Click to add.</p>
          <div style={{ display: "grid", gap: 8 }}>{library.map((item) => <button key={item.type} draggable onDragStart={(e) => e.dataTransfer.setData("tekforge-stage", item.type)} onClick={() => addStage(item)} style={libraryButton}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div>
          <div style={{ marginTop: 20, padding: 13, background: "#f2f4f7", borderRadius: 12, fontSize: 12, color: "#475467", lineHeight: 1.5 }}><strong>Compiler-first design</strong><br />The visual graph is the source of truth. TekForge validates it, then generates Tekton resources for the connected cluster.</div>
        </aside>
        <section onDrop={(e) => { e.preventDefault(); const type = e.dataTransfer.getData("tekforge-stage") as StageType; const item = library.find((x) => x.type === type); if (item) addStage(item); }} onDragOver={(e) => e.preventDefault()} style={{ background: "#f7f8fa" }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedId(node.id)} fitView snapToGrid snapGrid={[16, 16]} attributionPosition="bottom-left">
            <Background gap={18} size={1} /><Controls /><MiniMap pannable zoomable />
          </ReactFlow>
        </section>
        <aside style={{ background: "white", borderLeft: "1px solid #eaecf0", padding: 20, overflow: "auto" }}>
          <div style={eyebrow}>PIPELINE</div>
          <label style={field}>Pipeline name<input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} style={input} /></label><label style={field}>Application ID<input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} placeholder="Application UUID" style={input} /></label><label style={field}>Runtime<select value={runtime} onChange={(e) => setRuntime(e.target.value)} style={input}><option value="nodejs-22">Node.js 22</option><option value="java-21">Java 21</option><option value="python-3.12">Python 3.12</option><option value="go-1.24">Go 1.24</option></select></label>
          <label style={field}>Environment<select value={environment} onChange={(e) => setEnvironment(e.target.value)} style={input}><option>development</option><option>qa</option><option>staging</option><option>production</option></select></label><label style={field}>Connected cluster<input value={clusterId} onChange={(e) => setClusterId(e.target.value)} placeholder="Cluster ID" style={input} /></label><label style={field}>Namespace<input value={namespace} onChange={(e) => setNamespace(e.target.value)} style={input} /></label><div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <button style={{ ...primary, width: "100%" }} disabled={saving} onClick={deployPipeline}>{saving ? "Deploying…" : "Deploy Pipeline"}</button>
            <button style={{ ...secondary, width: "100%" }} disabled={saving || !pipelineId} onClick={runPipeline}>Run Pipeline</button>
          </div>
          {pipelineId && <div style={{ marginTop: 10, fontSize: 11, color: "#667085" }}>Pipeline ID: {pipelineId}</div>}
          {message && <div style={{ marginTop: 10, fontSize: 12, color: "#475467" }}>{message}</div>}
          {runId && <div style={{ marginTop: 24 }}><div style={eyebrow}>LIVE RUN</div><div style={{ fontWeight: 800, marginTop: 6 }}>{runStatus.toUpperCase()}</div><div style={{ fontSize: 11, color: "#667085", marginTop: 4 }}>Run: {runId}</div>{runAgent?.tasks?.length ? <div style={{ marginTop: 12, display: "grid", gap: 8 }}>{runAgent.tasks.map((task: any) => <div key={task.name} style={{ border: "1px solid #eaecf0", borderRadius: 9, padding: 9 }}><strong style={{ fontSize: 12 }}>{task.name}</strong><div style={{ fontSize: 10, color: "#667085" }}>{task.status?.conditions?.find((x: any) => x.type === "Succeeded")?.reason || "running"}</div>{task.logs && <pre style={{ ...code, maxHeight: 130, marginTop: 6 }}>{task.logs}</pre>}</div>)}</div> : <div style={{ fontSize: 11, color: "#667085", marginTop: 8 }}>Waiting for the agent to report TaskRuns…</div>}</div>}{selected && <div style={{ marginTop: 24 }}><div style={eyebrow}>SELECTED STAGE</div><h3 style={{ marginBottom: 4 }}>{selected.data.label}</h3><p style={muted}>{selected.data.detail}</p><label style={field}>Failure policy<select style={input}><option>Fail pipeline</option><option>Continue</option><option>Manual gate</option></select></label><button style={{ ...danger, marginTop: 14 }} onClick={removeSelected}>Remove stage</button></div>}
          {compileResult && <div style={{ marginTop: 22 }}><div style={eyebrow}>COMPILED TEKTON</div><pre style={code}>{compileResult}</pre></div>}
        </aside>
      </div>
    </main>
  );
}

const eyebrow = { fontSize: 10, letterSpacing: ".12em", fontWeight: 800, color: "#667085" };
const muted = { color: "#667085", fontSize: 12, lineHeight: 1.5 };
const field = { display: "grid", gap: 7, marginTop: 16, fontSize: 12, fontWeight: 700 };
const input = { width: "100%", boxSizing: "border-box" as const, padding: "10px 11px", border: "1px solid #d0d5dd", borderRadius: 9, background: "white" };
const primary = { border: 0, borderRadius: 9, padding: "10px 14px", background: "#101828", color: "white", fontWeight: 700, cursor: "pointer" };
const secondary = { border: "1px solid #d0d5dd", borderRadius: 9, padding: "9px 12px", background: "white", cursor: "pointer", fontWeight: 600 };
const danger = { ...secondary, color: "#b42318", width: "100%" };
const libraryButton = { display: "grid", textAlign: "left" as const, gap: 3, border: "1px solid #eaecf0", borderRadius: 10, padding: 11, background: "white", cursor: "grab" };
const code = { background: "#0b1220", color: "#d1fadf", borderRadius: 10, padding: 12, fontSize: 10, lineHeight: 1.5, maxHeight: 360, overflow: "auto" as const, whiteSpace: "pre-wrap" as const };
