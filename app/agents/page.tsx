"use client";

import { useEffect, useMemo, useState } from "react";

type Cluster = { id: string; name: string; provider: string; status: string; kubernetes_version?: string | null; nodes: number; pods: number; namespaces: number; tekton: boolean; last_heartbeat?: string | null };

const providers = ["GKE", "EKS", "AKS", "On-prem / Other"];

export default function AgentsPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("GKE");
  const [token, setToken] = useState("");
  const [manifest, setManifest] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/agent/clusters", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load clusters");
    setClusters(data.clusters || []);
  }

  useEffect(() => {
    load().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load clusters"));
    const timer = window.setInterval(() => load().catch(() => undefined), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const connected = useMemo(() => clusters.filter((c) => c.status === "connected").length, [clusters]);

  async function generate() {
    if (!name.trim()) return setMessage("Cluster name is required.");
    setBusy(true); setMessage(""); setManifest(""); setToken("");
    try {
      const response = await fetch("/api/agent/install-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), provider }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create installation");
      setToken(data.token);
      const manifestResponse = await fetch("/api/agent/manifest?token=" + encodeURIComponent(data.token), { cache: "no-store" });
      if (!manifestResponse.ok) throw new Error(await manifestResponse.text());
      setManifest(await manifestResponse.text());
      setMessage("Installation bundle generated. Apply it to the target Kubernetes cluster.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to generate installation"); }
    finally { setBusy(false); }
  }

  const command = token ? `curl -fsSL "${window.location.origin}/api/agent/manifest?token=${token}" | kubectl apply -f -` : "";

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", color: "#101828", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ height: 68, background: "white", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div><a href="/" style={{ color: "#667085", textDecoration: "none" }}>TekForge</a><span style={{ margin: "0 10px", color: "#d0d5dd" }}>/</span><strong>Kubernetes Agents</strong></div>
        <a href="/" style={{ color: "#2563eb", fontSize: 13, textDecoration: "none" }}>Dashboard</a>
      </header>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 22px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", marginBottom: 22 }}>
          <div><div style={eyebrow}>DATA PLANE</div><h1 style={{ margin: 0, fontSize: 30 }}>Kubernetes Agents</h1><p style={muted}>TekForge uses an outbound-only agent connection; the control plane does not need inbound access to your cluster.</p></div>
          <div style={pill}>{connected} connected</div>
        </div>
        <section style={card}>
          <div style={sectionHead}><div><h2 style={h2}>Install a cluster agent</h2><p style={muted}>Generate an installation credential and least-privilege agent manifest.</p></div></div>
          <div style={grid}>
            <label style={field}>Cluster name<input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="production-gke" /></label>
            <label style={field}>Provider<select style={input} value={provider} onChange={(e) => setProvider(e.target.value)}>{providers.map((p) => <option key={p}>{p}</option>)}</select></label>
          </div>
          <button style={primary} disabled={busy} onClick={generate}>{busy ? "Generating…" : "Generate installation"}</button>
          {message && <div style={helper}>{message}</div>}
          {command && <div style={{ marginTop: 18 }}><div style={eyebrow}>INSTALL COMMAND</div><pre style={code}>{command}</pre><p style={muted}>Run this from a workstation with kubectl already authenticated to the target cluster.</p></div>}
          {manifest && <details style={{ marginTop: 14 }}><summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>View generated manifest</summary><pre style={code}>{manifest}</pre></details>}
        </section>
        <section style={{ ...card, marginTop: 18 }}>
          <div style={sectionHead}><div><h2 style={h2}>Connected clusters</h2><p style={muted}>Live heartbeat and Kubernetes/Tekton capability data.</p></div><button style={secondary} onClick={() => load().catch((e) => setMessage(e instanceof Error ? e.message : "Refresh failed"))}>Refresh</button></div>
          {clusters.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#667085" }}>No agents installed yet.</div> : <div style={{ display: "grid", gap: 10 }}>{clusters.map((cluster) => <div key={cluster.id} style={row}><span style={{ ...dot, background: cluster.status === "connected" ? "#22c55e" : "#f59e0b" }} /><div style={{ flex: 1 }}><strong>{cluster.name}</strong><div style={small}>{cluster.provider} · Kubernetes {cluster.kubernetes_version || "unknown"} · {cluster.nodes} nodes · {cluster.pods} pods · {cluster.namespaces} namespaces</div></div><div style={{ textAlign: "right" }}><div style={{ fontWeight: 750, fontSize: 11 }}>{cluster.status.toUpperCase()}</div><div style={small}>{cluster.tekton ? "Tekton ready" : "Tekton not detected"}</div></div></div>)}</div>}
        </section>
        <section style={{ ...card, marginTop: 18, background: "#101828", color: "white" }}>
          <div style={eyebrowLight}>SECURITY MODEL</div><h2 style={{ margin: "5px 0", fontSize: 18 }}>Outbound-only control plane</h2><p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>The agent polls TekForge for signed commands, executes only allowed Tekton operations in the execution namespace, and reports heartbeat, PipelineRun status and TaskRun logs.</p>
        </section>
      </div>
    </main>
  );
}

const eyebrow = { color: "#667085", fontSize: 10, letterSpacing: ".12em", fontWeight: 800 };
const eyebrowLight = { color: "#93c5fd", fontSize: 10, letterSpacing: ".12em", fontWeight: 800 };
const muted = { color: "#667085", fontSize: 13, lineHeight: 1.55 };
const card = { background: "white", border: "1px solid #e3e9f1", borderRadius: 14, padding: 20, boxShadow: "0 3px 12px rgba(15,23,42,.035)" };
const sectionHead = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 };
const h2 = { margin: 0, fontSize: 17 };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 };
const field = { display: "grid", gap: 7, fontSize: 12, fontWeight: 700, color: "#475467" };
const input = { width: "100%", boxSizing: "border-box" as const, padding: "10px 11px", border: "1px solid #d0d5dd", borderRadius: 9, background: "white" };
const primary = { border: 0, borderRadius: 9, padding: "10px 15px", background: "#2563eb", color: "white", fontWeight: 700 };
const secondary = { border: "1px solid #d0d5dd", borderRadius: 9, padding: "9px 13px", background: "white", fontWeight: 650 };
const helper = { marginTop: 14, padding: 12, background: "#f8fafc", border: "1px solid #e5eaf1", borderRadius: 9, color: "#475467", fontSize: 12 };
const code = { marginTop: 8, background: "#0b1220", color: "#d1fadf", borderRadius: 10, padding: 13, fontSize: 11, lineHeight: 1.5, overflow: "auto" as const, whiteSpace: "pre-wrap" as const };
const pill = { padding: "7px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 750 };
const row = { display: "flex", alignItems: "center", gap: 12, padding: 14, border: "1px solid #eaecf0", borderRadius: 10, background: "#fbfdff" };
const dot = { width: 9, height: 9, borderRadius: "50%", flex: "0 0 auto" as const };
const small = { marginTop: 4, color: "#667085", fontSize: 11 };
