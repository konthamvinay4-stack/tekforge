"use client";

import { useEffect, useMemo, useState } from "react";

type Cluster = {
  id: string;
  name: string;
  provider: string;
  status: "connected" | "pending" | "offline";
  kubernetesVersion?: string;
  nodes?: number;
  pods?: number;
  namespaces?: number;
  tekton?: boolean;
  lastHeartbeat?: string;
};

const providers = ["AWS EKS", "GCP GKE", "Azure AKS", "Local Kubernetes", "Other"];

export default function ClustersPage() {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("AWS EKS");
  const [token, setToken] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);

  const installCommand = useMemo(() => {
    if (!token || !clusterId) return "Generate an install command to continue.";
    const base = typeof window !== "undefined" ? window.location.origin : "https://your-tekforge-domain";
    return `kubectl apply -f \"${base}/api/agent/manifest?token=${encodeURIComponent(token)}\"`;
  }, [token, clusterId]);

  useEffect(() => {
    const saved = window.localStorage.getItem("tekforge-clusters");
    if (saved) setClusters(JSON.parse(saved));
  }, []);

  function persist(next: Cluster[]) {
    setClusters(next);
    window.localStorage.setItem("tekforge-clusters", JSON.stringify(next));
  }

  async function createInstallToken() {
    if (!name.trim()) {
      setMessage("Enter a cluster name first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/agent/install-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), provider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create installation token");
      setClusterId(data.clusterId);
      setToken(data.token);
      persist([
        ...clusters.filter((cluster) => cluster.id !== data.clusterId),
        { id: data.clusterId, name: name.trim(), provider, status: "pending" },
      ]);
      setMessage("Installation command generated. Run it against the target cluster.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create installation token");
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    if (!clusterId) return;
    const response = await fetch(`/api/agent/status?clusterId=${encodeURIComponent(clusterId)}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.cluster) {
      persist(clusters.map((cluster) => cluster.id === clusterId ? { ...cluster, ...data.cluster } : cluster));
      setMessage(data.cluster.status === "connected" ? "Agent heartbeat received." : "Agent has not connected yet.");
    } else {
      setMessage(data.error || "Status unavailable. Configure Supabase service-role persistence first.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", color: "#101828", padding: "40px 5vw", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <a href="/" style={{ color: "#475467", textDecoration: "none" }}>← Back to TekForge</a>
        <header style={{ margin: "28px 0 32px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", color: "#667085" }}>INFRASTRUCTURE</div>
          <h1 style={{ fontSize: 42, margin: "8px 0" }}>Clusters</h1>
          <p style={{ color: "#667085", fontSize: 17, maxWidth: 760 }}>Connect AWS, GCP, Azure, on-prem or local Kubernetes with a lightweight outbound TekForge Agent. The control plane never needs direct access to the Kubernetes API.</p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 20, alignItems: "start" }}>
          <div style={{ background: "white", border: "1px solid #eaecf0", borderRadius: 18, padding: 26, boxShadow: "0 4px 18px rgba(16,24,40,.04)" }}>
            <h2 style={{ marginTop: 0 }}>Connect a cluster</h2>
            <p style={{ color: "#667085" }}>Generate a one-time bootstrap token and install the agent inside the cluster.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>Cluster name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="production-eks" style={inputStyle} /></label>
              <label>Provider<select value={provider} onChange={(e) => setProvider(e.target.value)} style={inputStyle}>{providers.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <button onClick={createInstallToken} disabled={busy} style={primaryStyle}>{busy ? "Generating…" : "Generate install command"}</button>
            {token && <div style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Install the TekForge Agent</div>
              <pre style={codeStyle}>{installCommand}</pre>
              <div style={{ display: "flex", gap: 10 }}><button style={secondaryStyle} onClick={() => navigator.clipboard.writeText(installCommand)}>Copy command</button><button style={secondaryStyle} onClick={refreshStatus}>Check connection</button></div>
            </div>}
            {message && <p style={{ color: "#475467", marginTop: 16 }}>{message}</p>}
          </div>

          <div style={{ background: "#101828", color: "white", borderRadius: 18, padding: 26 }}>
            <div style={{ color: "#98a2b3", fontSize: 12, fontWeight: 700, letterSpacing: ".1em" }}>AGENT MODEL</div>
            <h2>Outbound only</h2>
            <p style={{ color: "#d0d5dd", lineHeight: 1.6 }}>The agent uses its Kubernetes ServiceAccount to inspect and operate the cluster, then sends telemetry and execution results outbound to TekForge.</p>
            <div style={{ display: "grid", gap: 10, marginTop: 20 }}>{["Cluster inventory", "Tekton status", "PipelineRuns", "Events and logs", "Deployment health"].map((item) => <div key={item} style={{ padding: "11px 13px", background: "#1d2939", borderRadius: 10 }}>✓ {item}</div>)}</div>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>Connected clusters</h2>
          <div style={{ display: "grid", gap: 12 }}>{clusters.length === 0 ? <div style={{ background: "white", border: "1px solid #eaecf0", borderRadius: 16, padding: 28, color: "#667085" }}>No clusters registered yet. Generate an install command above.</div> : clusters.map((cluster) => <div key={cluster.id} style={{ background: "white", border: "1px solid #eaecf0", borderRadius: 16, padding: 20, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}><div><strong style={{ fontSize: 18 }}>{cluster.name}</strong><div style={{ color: "#667085", marginTop: 5 }}>{cluster.provider} · {cluster.kubernetesVersion || "Waiting for agent"}</div></div><div style={{ display: "flex", gap: 18, alignItems: "center", color: "#667085" }}><span>{cluster.nodes ?? "—"} nodes</span><span>{cluster.pods ?? "—"} pods</span><span>{cluster.tekton ? "Tekton ✓" : "Tekton —"}</span><span style={{ color: cluster.status === "connected" ? "#067647" : "#b54708", fontWeight: 700 }}>● {cluster.status}</span></div></div>)}</div>
        </section>
      </div>
    </main>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box" as const, marginTop: 7, padding: "12px 13px", border: "1px solid #d0d5dd", borderRadius: 10, fontSize: 14, background: "white" };
const primaryStyle = { marginTop: 18, border: 0, borderRadius: 10, padding: "12px 16px", background: "#101828", color: "white", fontWeight: 700, cursor: "pointer" };
const secondaryStyle = { border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 14px", background: "white", color: "#344054", fontWeight: 600, cursor: "pointer" };
const codeStyle = { whiteSpace: "pre-wrap" as const, background: "#0b1220", color: "#d1fadf", borderRadius: 12, padding: 16, fontSize: 12, lineHeight: 1.6, overflowX: "auto" as const };
