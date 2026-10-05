"use client";

import { DragEvent, useMemo, useState } from "react";

type NodeType = "source" | "build" | "test" | "security" | "image" | "deploy" | "approval";
type PipelineNode = { id: string; type: NodeType; label: string; detail: string };

const palette: { type: NodeType; label: string; detail: string }[] = [
  { type: "source", label: "Git Checkout", detail: "GitHub / GitLab / Bitbucket" },
  { type: "build", label: "Build", detail: "Node / Java / Python / Go" },
  { type: "test", label: "Test", detail: "Unit / integration / custom" },
  { type: "security", label: "Security Scan", detail: "Trivy / SAST / dependency" },
  { type: "image", label: "Build Image", detail: "Kaniko / BuildKit / Jib" },
  { type: "deploy", label: "Deploy", detail: "Kubernetes / Helm / Kustomize" },
  { type: "approval", label: "Approval", detail: "Manual environment gate" },
];

const defaults: PipelineNode[] = [
  { id: "1", type: "source", label: "Git Checkout", detail: "GitHub repository" },
  { id: "2", type: "build", label: "Build", detail: "npm run build" },
  { id: "3", type: "test", label: "Test", detail: "npm test" },
  { id: "4", type: "security", label: "Security Scan", detail: "Trivy filesystem scan" },
  { id: "5", type: "image", label: "Build Image", detail: "Kaniko → registry" },
  { id: "6", type: "deploy", label: "Deploy", detail: "Helm → Kubernetes" },
];

export default function PipelineStudio() {
  const [nodes, setNodes] = useState(defaults);
  const [selected, setSelected] = useState<string | null>("6");
  const [dragged, setDragged] = useState<NodeType | null>(null);
  const [runtime, setRuntime] = useState("Node.js 22");
  const [environment, setEnvironment] = useState("Production");
  const [saved, setSaved] = useState(false);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selected), [nodes, selected]);

  function addNode(type: NodeType) {
    const template = palette.find((item) => item.type === type)!;
    setNodes((current) => [...current, { ...template, id: crypto.randomUUID() }]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    if (dragged) addNode(dragged);
    setDragged(null);
  }

  function moveNode(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return;
    const next = [...nodes];
    [next[index], next[target]] = [next[target], next[index]];
    setNodes(next);
  }

  function savePipeline() {
    const payload = { version: 1, runtime, environment, nodes, edges: nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1].id })) };
    localStorage.setItem("tekforge-pipeline-draft", JSON.stringify(payload));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fa", color: "#101828", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ height: 72, background: "white", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", position: "sticky", top: 0, zIndex: 5 }}>
        <div><a href="/" style={{ color: "#667085", textDecoration: "none", fontSize: 13 }}>TekForge</a><span style={{ color: "#d0d5dd", margin: "0 10px" }}>/</span><strong>Pipeline Studio</strong></div>
        <div style={{ display: "flex", gap: 10 }}><button style={buttonStyle} onClick={() => setNodes(defaults)}>Reset</button><button style={primaryStyle} onClick={savePipeline}>{saved ? "Saved ✓" : "Save pipeline"}</button></div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr 300px", minHeight: "calc(100vh - 72px)" }}>
        <aside style={{ background: "white", borderRight: "1px solid #eaecf0", padding: 20 }}>
          <div style={labelStyle}>TASK LIBRARY</div>
          <p style={{ color: "#667085", fontSize: 13 }}>Drag a task into the canvas.</p>
          <div style={{ display: "grid", gap: 9 }}>{palette.map((item) => <div key={item.type} draggable onDragStart={() => setDragged(item.type)} onDragEnd={() => setDragged(null)} onClick={() => addNode(item.type)} style={{ border: "1px solid #eaecf0", borderRadius: 12, padding: 12, cursor: "grab", background: "#fff" }}><strong style={{ display: "block", fontSize: 13 }}>{item.label}</strong><span style={{ color: "#667085", fontSize: 11 }}>{item.detail}</span></div>)}</div>
          <div style={{ marginTop: 28, padding: 14, background: "#f2f4f7", borderRadius: 12, fontSize: 12, color: "#475467" }}><strong>How this works</strong><p style={{ marginBottom: 0 }}>TekForge stores this visual graph as its platform-neutral pipeline spec and compiles it into Tekton Pipeline + PipelineRun resources on the connected cluster.</p></div>
        </aside>

        <section style={{ padding: 24, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 20 }}><div><div style={labelStyle}>PIPELINE STUDIO</div><h1 style={{ margin: "6px 0", fontSize: 28 }}>Application delivery</h1><p style={{ color: "#667085", margin: 0 }}>Drag, drop and configure your delivery stages.</p></div><span style={{ background: "#ecfdf3", color: "#067647", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>TEKTON TARGET</span></div>
          <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} style={{ minHeight: 620, border: "1px dashed #98a2b3", borderRadius: 18, padding: 24, background: "radial-gradient(#e4e7ec 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", justifyItems: "center" }}>
              {nodes.map((node, index) => <div key={node.id} style={{ width: "100%", display: "grid", justifyItems: "center" }}><div onClick={() => setSelected(node.id)} style={{ width: "100%", maxWidth: 560, background: "white", border: selected === node.id ? "2px solid #101828" : "1px solid #d0d5dd", borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 6px 20px rgba(16,24,40,.06)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><span style={{ fontSize: 11, color: "#667085", fontWeight: 700 }}>{String(index + 1).padStart(2, "0")} · {node.type.toUpperCase()}</span><div style={{ fontSize: 16, fontWeight: 750, marginTop: 3 }}>{node.label}</div><div style={{ color: "#667085", fontSize: 12, marginTop: 4 }}>{node.detail}</div></div><div style={{ display: "flex", gap: 5 }}><button aria-label="move up" style={iconButton} onClick={(e) => { e.stopPropagation(); moveNode(index, -1); }}>↑</button><button aria-label="move down" style={iconButton} onClick={(e) => { e.stopPropagation(); moveNode(index, 1); }}>↓</button><button aria-label="delete" style={iconButton} onClick={(e) => { e.stopPropagation(); setNodes((current) => current.filter((item) => item.id !== node.id)); }}>×</button></div></div></div>{index < nodes.length - 1 && <div style={{ height: 30, borderLeft: "2px solid #98a2b3", position: "relative" }}><span style={{ position: "absolute", bottom: -7, left: -6, width: 10, height: 10, borderRight: "2px solid #98a2b3", borderBottom: "2px solid #98a2b3", transform: "rotate(45deg)", background: "#f5f7fa" }} /></div>}</div>)}
              {nodes.length === 0 && <div style={{ color: "#667085", padding: 100 }}>Drop a task here to start.</div>}
            </div>
          </div>
        </section>

        <aside style={{ background: "white", borderLeft: "1px solid #eaecf0", padding: 22 }}>
          <div style={labelStyle}>PIPELINE CONFIG</div>
          <label style={fieldLabel}>Runtime<select value={runtime} onChange={(e) => setRuntime(e.target.value)} style={inputStyle}><option>Node.js 22</option><option>Java 21</option><option>Python 3.12</option><option>Go 1.24</option></select></label>
          <label style={fieldLabel}>Target environment<select value={environment} onChange={(e) => setEnvironment(e.target.value)} style={inputStyle}><option>Development</option><option>QA</option><option>Staging</option><option>Production</option></select></label>
          {selectedNode && <div style={{ marginTop: 24 }}><div style={labelStyle}>SELECTED TASK</div><h3>{selectedNode.label}</h3><p style={{ color: "#667085", fontSize: 13 }}>{selectedNode.detail}</p><label style={fieldLabel}>Command<input defaultValue={selectedNode.type === "build" ? "npm run build" : selectedNode.type === "test" ? "npm test" : ""} style={inputStyle} /></label><label style={fieldLabel}>Failure policy<select style={inputStyle}><option>Fail pipeline</option><option>Continue</option><option>Manual decision</option></select></label></div>}
          <div style={{ marginTop: 28, borderTop: "1px solid #eaecf0", paddingTop: 18 }}><div style={labelStyle}>GENERATED PLAN</div><div style={{ fontSize: 12, color: "#475467", lineHeight: 1.7 }}>{nodes.length} Tekton tasks<br />{Math.max(nodes.length - 1, 0)} dependencies<br />Environment: {environment}<br />Runtime: {runtime}</div></div>
        </aside>
      </div>
    </main>
  );
}

const labelStyle = { fontSize: 11, letterSpacing: ".1em", fontWeight: 800, color: "#667085" };
const fieldLabel = { display: "grid", gap: 7, fontSize: 12, fontWeight: 700, marginTop: 16 };
const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "10px 11px", border: "1px solid #d0d5dd", borderRadius: 9, background: "white" };
const buttonStyle = { border: "1px solid #d0d5dd", borderRadius: 9, padding: "9px 13px", background: "white", cursor: "pointer", fontWeight: 600 };
const primaryStyle = { border: 0, borderRadius: 9, padding: "10px 15px", background: "#101828", color: "white", cursor: "pointer", fontWeight: 700 };
const iconButton = { border: "1px solid #eaecf0", background: "white", borderRadius: 7, width: 28, height: 28, cursor: "pointer" };
