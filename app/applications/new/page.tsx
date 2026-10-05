"use client";

import { useState } from "react";

export default function NewApplication() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/repository/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setLoading(false); }
  }

  return <main style={{ minHeight: "100vh", background: "#f7f8fa", color: "#101828", fontFamily: "Inter,system-ui,sans-serif" }}>
    <header style={{ height: 68, background: "white", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
      <div><a href="/" style={{ color: "#667085", textDecoration: "none" }}>TekForge</a><span style={{ margin: "0 10px", color: "#d0d5dd" }}>/</span><strong>Add application</strong></div>
      <a href="/pipeline-studio" style={secondary}>Pipeline Studio</a>
    </header>
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ maxWidth: 760 }}><div style={eyebrow}>APPLICATION INTELLIGENCE</div><h1 style={{ fontSize: 38, margin: "10px 0" }}>Connect your code. Let TekForge design the delivery path.</h1><p style={muted}>TekForge inspects the repository structure, detects the runtime and build system, and recommends a production pipeline before you deploy anything.</p></div>
      <section style={card}>
        <label style={field}>GitHub repository<input value={repositoryUrl} onChange={e => setRepositoryUrl(e.target.value)} placeholder="https://github.com/company/application" style={input} /></label>
        <button onClick={analyze} disabled={loading || !repositoryUrl} style={primary}>{loading ? "Analyzing repository…" : "Analyze repository"}</button>
        {error && <div style={errorBox}>{error}</div>}
      </section>
      {result && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <section style={card}><div style={eyebrow}>DETECTED STACK</div><h2 style={{ margin: "8px 0 18px" }}>{result.repository.owner}/{result.repository.repo}</h2><div style={grid}>{Object.entries(result.analysis).filter(([key]) => ["runtime","runtimeVersion","framework","buildTool","buildCommand","testCommand","dockerfile","kubernetes","confidence"].includes(key)).map(([key, value]) => <div key={key} style={stat}><span style={label}>{key.replace(/[A-Z]/g, m => ` ${m}`).toUpperCase()}</span><strong>{String(value ?? "—")}</strong></div>)}</div></section>
        <section style={card}><div style={eyebrow}>RECOMMENDED PIPELINE</div><div style={{ marginTop: 14, display: "grid", gap: 10 }}>{["Git Checkout", "Build", "Test", "Security", "Build Image", "Deploy"].map((stage, i) => <div key={stage} style={stageRow}><span style={number}>{i + 1}</span><strong>{stage}</strong><span style={{ color: "#98a2b3", marginLeft: "auto" }}>›</span></div>)}</div><a href="/pipeline-studio" style={{ ...primary, display: "inline-block", marginTop: 18, textDecoration: "none" }}>Open in Pipeline Studio</a></section>
        {result.analysis.warnings?.length > 0 && <section style={{ ...card, gridColumn: "1 / -1" }}><div style={eyebrow}>PRE-FLIGHT WARNINGS</div>{result.analysis.warnings.map((warning: string) => <div key={warning} style={warningBox}>⚠ {warning}</div>)}</section>}
      </div>}
    </div>
  </main>;
}

const eyebrow = { fontSize: 10, letterSpacing: ".12em", fontWeight: 800, color: "#667085" };
const muted = { color: "#667085", lineHeight: 1.65 };
const card = { background: "white", border: "1px solid #eaecf0", borderRadius: 16, padding: 24, boxShadow: "0 8px 30px rgba(16,24,40,.05)" };
const field = { display: "grid", gap: 8, fontWeight: 700, fontSize: 13 };
const input = { width: "100%", boxSizing: "border-box" as const, marginTop: 2, padding: "13px 14px", border: "1px solid #d0d5dd", borderRadius: 10, fontSize: 14 };
const primary = { border: 0, borderRadius: 10, padding: "12px 16px", background: "#101828", color: "white", fontWeight: 700, cursor: "pointer" };
const secondary = { border: "1px solid #d0d5dd", borderRadius: 9, padding: "9px 12px", background: "white", color: "#344054", textDecoration: "none", fontWeight: 600 };
const errorBox = { marginTop: 14, padding: 12, borderRadius: 10, background: "#fef3f2", color: "#b42318", fontSize: 13 };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const stat = { padding: 12, background: "#f9fafb", borderRadius: 10, display: "grid", gap: 5, minWidth: 0, overflow: "hidden" };
const label = { color: "#667085", fontSize: 9, letterSpacing: ".08em" };
const stageRow = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid #eaecf0", borderRadius: 10 };
const number = { width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: "#f2f4f7", fontSize: 11, fontWeight: 800 };
const warningBox = { marginTop: 10, padding: 12, borderRadius: 10, background: "#fffaeb", color: "#93370d", fontSize: 13 };
