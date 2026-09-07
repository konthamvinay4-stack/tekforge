"use client";

import { useState } from "react";

const nav = ["Dashboard", "Projects", "Applications", "Pipelines", "Deployments", "Environments", "Task Catalog", "Pipeline Studio"];

const runs = [
  { app: "orders-api", id: "run-1842", commit: "a84f21c", status: "success", text: "Production deploy completed", ago: "4 min ago" },
  { app: "web-portal", id: "run-1841", commit: "c92be10", status: "running", text: "Security scan in progress", ago: "9 min ago" },
  { app: "payments-worker", id: "run-1840", commit: "1d4a77e", status: "failed", text: "Unit tests failed", ago: "18 min ago" },
  { app: "catalog-api", id: "run-1839", commit: "e31f909", status: "success", text: "QA deployment completed", ago: "31 min ago" },
];

const steps = ["Checkout", "Build", "Test", "Security", "Image", "Deploy"];

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [started, setStarted] = useState(false);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Tek<span>Forge</span></div>
        <div className="nav-label">Workspace</div>
        {nav.slice(0, 6).map((item) => (
          <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}>
            {item}
          </button>
        ))}
        <div className="nav-label">Build system</div>
        {nav.slice(6).map((item) => (
          <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}>
            {item}
          </button>
        ))}
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{active === "Dashboard" ? "Developer self-service CI/CD" : `Workspace / ${active}`}</p>
            <h1>{active}</h1>
            <p className="subtitle">Build, test, scan and deploy applications without managing Tekton YAML by hand.</p>
          </div>
          <div className="avatar">VK</div>
        </header>

        {active === "Dashboard" ? (
          <>
            <div className="helper">
              <strong>How TekForge works:</strong> connect a repository → choose your application type → TekForge creates the pipeline → a Git push triggers Tekton → follow every stage here → promote the build to an environment.
            </div>

            <section className="section">
              <div className="section-head"><h2>Platform overview</h2><a className="link" href="#runs">View all runs</a></div>
              <div className="grid">
                <div className="card"><div className="metric-label">Applications</div><div className="metric">12</div><div className="delta">8 connected to Git</div></div>
                <div className="card"><div className="metric-label">Pipeline runs today</div><div className="metric">48</div><div className="delta">92% completed successfully</div></div>
                <div className="card"><div className="metric-label">Deployments</div><div className="metric">16</div><div className="delta">DEV → QA → PROD</div></div>
                <div className="card"><div className="metric-label">Security findings</div><div className="metric">3</div><div className="delta">2 low · 1 medium</div></div>
              </div>
            </section>

            <section className="section card">
              <div className="section-head">
                <div><h2>Example pipeline</h2><div className="metric-label">What happens after a developer pushes code</div></div>
                <div className="actions"><button className="secondary" onClick={() => setStarted(false)}>Reset</button><button className="primary" onClick={() => setStarted(true)}>{started ? "Pipeline started ✓" : "Run example"}</button></div>
              </div>
              <div className="flow">
                {steps.map((step, i) => <div key={step} style={{display:"flex",alignItems:"center"}}><div className="flow-node"><strong>{i + 1}. {step}</strong><small>{step === "Security" ? "Trivy + SAST" : step === "Image" ? "Build & push" : step === "Deploy" ? "Kubernetes" : "Tekton Task"}</small></div>{i < steps.length - 1 && <span className="flow-arrow">→</span>}</div>)}
              </div>
              {started && <div className="helper" style={{marginTop:14}}>Demo run created. In the live cluster, this action will create a Tekton <strong>PipelineRun</strong>, whose Tasks become individual <strong>TaskRuns</strong>. The UI will stream their status and logs.</div>}
            </section>

            <section className="section pipeline" id="runs">
              <div className="card"><div className="section-head"><h2>Recent pipeline runs</h2><a className="link" href="#">Open history</a></div>
                {runs.map((r) => <div className="run" key={r.id}><span className={`status ${r.status === "success" ? "green" : r.status === "running" ? "amber" : "red"}`}/><div className="run-main"><div className="run-title">{r.app} · {r.id}</div><div className="run-meta">{r.text} · {r.commit} · {r.ago}</div></div><span className={`badge ${r.status === "success" ? "success" : r.status === "running" ? "running" : "failed"}`}>{r.status}</span></div>)}
              </div>
              <div className="card"><div className="section-head"><h2>What the user sees</h2></div>
                <div className="run"><span className="status green"/><div className="run-main"><div className="run-title">1. Checkout</div><div className="run-meta">Fetch commit a84f21c</div></div><span className="badge success">done</span></div>
                <div className="run"><span className="status green"/><div className="run-main"><div className="run-title">2. Build & test</div><div className="run-meta">npm ci · npm test</div></div><span className="badge success">done</span></div>
                <div className="run"><span className="status amber"/><div className="run-main"><div className="run-title">3. Security</div><div className="run-meta">Dependency + container scan</div></div><span className="badge running">running</span></div>
                <div className="run"><span className="status" style={{background:'#cbd5e1'}}/><div className="run-main"><div className="run-title">4. Deploy</div><div className="run-meta">Waiting for security gate</div></div><span className="badge" style={{background:'#f1f5f9',color:'#64748b'}}>queued</span></div>
              </div>
            </section>
          </>
        ) : (
          <div className="card"><h2>{active}</h2><p className="subtitle">This workspace is scaffolded for the MVP. The next implementation step connects this screen to PostgreSQL and Tekton APIs while keeping the same plain-language workflow.</p></div>
        )}
      </main>
    </div>
  );
}
