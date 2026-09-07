"use client";

import { useState } from "react";

const nav = ["Dashboard", "Projects", "Applications", "Pipelines", "Deployments", "Environments"];
const runs = [
  { app: "orders-api", id: "run-1842", commit: "a84f21c", status: "success", text: "Production deploy completed", ago: "4 min ago" },
  { app: "web-portal", id: "run-1841", commit: "c92be10", status: "running", text: "Security scan in progress", ago: "9 min ago" },
  { app: "payments-worker", id: "run-1840", commit: "1d4a77e", status: "failed", text: "Unit tests failed", ago: "18 min ago" },
];
const steps = ["Checkout", "Build", "Test", "Security", "Image", "Deploy"];

function StatusDot({ status }: { status: string }) {
  return <span className={`status ${status === "success" ? "green" : status === "running" ? "amber" : "red"}`} />;
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [started, setStarted] = useState(false);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">TF</span><span>TekForge</span></div>
        <div className="runtime"><span className="runtime-dot" /> GKE runtime connected</div>
        <div className="nav-label">Workspace</div>
        {nav.map((item) => (
          <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}>
            <span className="nav-icon">{item === "Dashboard" ? "⌂" : item === "Projects" ? "▦" : item === "Applications" ? "◈" : item === "Pipelines" ? "⑂" : item === "Deployments" ? "↑" : "◇"}</span>
            {item}
          </button>
        ))}
        <div className="nav-label">Platform</div>
        <div className="side-link">Tekton <span>Healthy</span></div>
        <div className="side-link">Artifact Registry <span>Ready</span></div>
        <div className="side-link">Supabase <span>Connected</span></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Developer platform / Control plane</p>
            <h1>{active}</h1>
            <p className="subtitle">Build, test, secure and deploy applications through one Kubernetes-native workflow.</p>
          </div>
          <div className="top-actions"><button className="secondary">Documentation</button><div className="avatar">VK</div></div>
        </header>

        {active === "Dashboard" ? (
          <>
            <section className="hero card">
              <div><div className="eyebrow strong">SHIP WITH CONFIDENCE</div><h2>From Git push to GKE deployment.</h2><p>TekForge turns repository changes into observable Tekton PipelineRuns and promotes the resulting image through your environments.</p></div>
              <button className="primary" onClick={() => setStarted(true)}>{started ? "Pipeline queued ✓" : "Run a pipeline"}</button>
            </section>

            <section className="section">
              <div className="section-head"><div><h2>Platform overview</h2><div className="metric-label">Live control-plane snapshot</div></div><span className="live-badge"><span className="runtime-dot" /> LIVE</span></div>
              <div className="grid">
                <div className="card metric-card"><div className="metric-label">Applications</div><div className="metric">12</div><div className="delta">8 connected to Git</div></div>
                <div className="card metric-card"><div className="metric-label">Runs today</div><div className="metric">48</div><div className="delta">92% successful</div></div>
                <div className="card metric-card"><div className="metric-label">Deployments</div><div className="metric">16</div><div className="delta">DEV · QA · PROD</div></div>
                <div className="card metric-card"><div className="metric-label">Security findings</div><div className="metric">3</div><div className="delta warning">2 low · 1 medium</div></div>
              </div>
            </section>

            <section className="section pipeline-card card">
              <div className="section-head"><div><h2>Delivery pipeline</h2><div className="metric-label">Standard TekForge Node.js workflow</div></div><span className="badge success">READY</span></div>
              <div className="flow">
                {steps.map((step, i) => <div className="flow-step" key={step}><div className="flow-node"><span className="step-number">{i + 1}</span><strong>{step}</strong><small>{step === "Security" ? "Trivy scan" : step === "Image" ? "Artifact Registry" : step === "Deploy" ? "GKE rollout" : "Tekton Task"}</small></div>{i < steps.length - 1 && <span className="flow-arrow">→</span>}</div>)}
              </div>
              {started && <div className="helper success-helper"><strong>Pipeline queued.</strong> The production control plane will create a Tekton PipelineRun and track each TaskRun.</div>}
            </section>

            <section className="section dashboard-columns">
              <div className="card"><div className="section-head"><div><h2>Recent runs</h2><div className="metric-label">Latest pipeline activity</div></div><button className="link-button">View all</button></div>
                {runs.map((r) => <div className="run" key={r.id}><StatusDot status={r.status} /><div className="run-main"><div className="run-title">{r.app} <span>· {r.id}</span></div><div className="run-meta">{r.text} · {r.commit} · {r.ago}</div></div><span className={`badge ${r.status === "success" ? "success" : r.status === "running" ? "running" : "failed"}`}>{r.status}</span></div>)}
              </div>
              <div className="card"><div className="section-head"><div><h2>Runtime health</h2><div className="metric-label">Connected execution services</div></div></div>
                <div className="health-row"><span><i className="health-dot" /> GKE cluster</span><strong>Healthy</strong></div>
                <div className="health-row"><span><i className="health-dot" /> Tekton Pipelines</span><strong>Healthy</strong></div>
                <div className="health-row"><span><i className="health-dot" /> Artifact Registry</span><strong>Ready</strong></div>
                <div className="health-row"><span><i className="health-dot" /> Control plane</span><strong>Online</strong></div>
              </div>
            </section>
          </>
        ) : (
          <div className="card empty-state"><div className="empty-icon">{active.slice(0, 1)}</div><h2>{active}</h2><p className="subtitle">This workspace is ready for the live Supabase and Tekton integration. Use the dashboard to launch and observe the end-to-end delivery flow.</p><button className="primary" onClick={() => setActive("Dashboard")}>Back to dashboard</button></div>
        )}
      </main>
    </div>
  );
}
