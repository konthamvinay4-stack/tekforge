"use client";

import { FormEvent, useEffect, useState } from "react";

const nav = ["Dashboard", "Projects", "Applications", "Pipelines", "Deployments", "Environments"];
const steps = ["Checkout", "Build", "Test", "Security", "Image", "Deploy"];

type Project = { id: string; name: string; description?: string | null; created_at?: string };
type Application = { id: string; project_id: string; name: string; repository_url: string; default_branch: string; runtime: string; runtime_version: string; build_command: string; test_command: string; image_repository?: string | null; pipeline_status: string; projects?: { name: string } | null; pipelines?: Pipeline[] };
type Pipeline = { id: string; application_id: string; name: string; template: string; spec?: Record<string, unknown>; tekton_pipeline_name?: string | null; created_at?: string; applications?: { name: string } | null };
type Analysis = { runtime: string; runtimeVersion: string; framework: string | null; buildTool: string; buildCommand: string; testCommand: string; dockerfile: string | null; kubernetes: boolean; confidence: string; evidence: string[]; warnings: string[] };

function StatusDot({ status }: { status: string }) {
  return <span className={`status ${status === "success" || status === "ready" ? "green" : status === "running" ? "amber" : "red"}`} />;
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [projectId, setProjectId] = useState("");
  const [appName, setAppName] = useState("");
  const [imageRepository, setImageRepository] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProjects() {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load projects");
    const list = data.projects || [];
    setProjects(list);
    if (!projectId && list[0]) setProjectId(list[0].id);
  }

  async function loadApplications() {
    const url = projectId ? `/api/applications?projectId=${encodeURIComponent(projectId)}` : "/api/applications";
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load applications");
    setApplications(data.applications || []);
  }

  async function loadPipelines() {
    const response = await fetch("/api/pipelines", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load pipelines");
    setPipelines(data.pipelines || []);
  }

  useEffect(() => {
    loadProjects().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load projects"));
    loadApplications().catch(() => undefined);
    loadPipelines().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (projectId) loadApplications().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load applications"));
  }, [projectId]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return setMessage("Project name is required.");
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: projectDescription.trim() || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Project creation failed");
      setProjects((current) => [data.project, ...current]);
      setProjectId(data.project.id);
      setProjectName(""); setProjectDescription(""); setShowProjectForm(false);
      setMessage(`Project ${data.project.name} created successfully.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Project creation failed"); }
    finally { setBusy(false); }
  }

  async function analyzeRepository() {
    setBusy(true); setMessage(""); setAnalysis(null);
    try {
      const response = await fetch("/api/repository/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryUrl: repoUrl, branch }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data.analysis); setBranch(data.repository.branch);
      if (!appName) setAppName(data.repository.repo);
      setMessage(`Detected ${data.analysis.runtime}${data.analysis.framework ? ` · ${data.analysis.framework}` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Analysis failed"); }
    finally { setBusy(false); }
  }

  async function createApplication(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return setMessage("Create or select a project before creating the application.");
    if (!analysis) return setMessage("Analyze the repository before creating the application.");
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, name: appName, repositoryUrl: repoUrl, defaultBranch: branch, runtime: analysis.runtime, runtimeVersion: analysis.runtimeVersion, buildCommand: analysis.buildCommand, testCommand: analysis.testCommand, imageRepository }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Application creation failed");
      setApplications((current) => [data.application, ...current]);
      if (data.pipeline) setPipelines((current) => [data.pipeline, ...current]);
      setMessage(`Application ${data.application.name} created with pipeline ${data.pipeline?.name || ""}.`);
      setActive("Applications");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Application creation failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">TF</span><span>TekForge</span></div>
        <div className="runtime"><span className="runtime-dot" /> GKE runtime connected</div>
        <div className="nav-label">Workspace</div>
        {nav.map((item) => <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => { setActive(item); setMessage(""); }}><span className="nav-icon">{item === "Dashboard" ? "⌂" : item === "Projects" ? "▦" : item === "Applications" ? "◈" : item === "Pipelines" ? "⑂" : item === "Deployments" ? "↑" : "◇"}</span>{item}</button>)}
        <div className="nav-label">Platform</div>
        <div className="side-link">Tekton <span>Healthy</span></div>
        <div className="side-link">Artifact Registry <span>Ready</span></div>
        <div className="side-link">Supabase <span>Connected</span></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><p className="eyebrow">Developer platform / Control plane</p><h1>{active}</h1><p className="subtitle">Build, test, secure and deploy applications through one Kubernetes-native workflow.</p></div><div className="top-actions"><button className="secondary">Documentation</button><div className="avatar">VK</div></div></header>

        {active === "Dashboard" && <>
          <section className="hero card"><div><div className="eyebrow strong">SHIP WITH CONFIDENCE</div><h2>From Git push to GKE deployment.</h2><p>Connect a repository, let TekForge detect its runtime, then generate and execute the appropriate Tekton delivery plan.</p></div><button className="primary" onClick={() => setActive("Applications")}>Connect repository</button></section>
          <section className="section"><div className="section-head"><div><h2>Platform overview</h2><div className="metric-label">Live Supabase control-plane data</div></div><span className="live-badge"><span className="runtime-dot" /> LIVE</span></div><div className="grid"><div className="card metric-card"><div className="metric-label">Projects</div><div className="metric">{projects.length}</div><div className="delta">Supabase</div></div><div className="card metric-card"><div className="metric-label">Applications</div><div className="metric">{applications.length}</div><div className="delta">Connected to Git</div></div><div className="card metric-card"><div className="metric-label">Pipelines</div><div className="metric">{pipelines.length}</div><div className="delta">Tekton plans</div></div><div className="card metric-card"><div className="metric-label">Runtime</div><div className="metric">GKE</div><div className="delta">Connected</div></div></div></section>
          <section className="section pipeline-card card"><div className="section-head"><div><h2>Delivery pipeline</h2><div className="metric-label">Runtime-aware TekForge workflow</div></div><span className="badge success">READY</span></div><div className="flow">{steps.map((step, i) => <div className="flow-step" key={step}><div className="flow-node"><span className="step-number">{i + 1}</span><strong>{step}</strong><small>{step === "Security" ? "Trivy scan" : step === "Image" ? "Artifact Registry" : step === "Deploy" ? "GKE rollout" : "Tekton Task"}</small></div>{i < steps.length - 1 && <span className="flow-arrow">→</span>}</div>)}</div></section>
        </>}

        {active === "Projects" && <section className="section"><div className="card"><div className="section-head"><div><h2>Projects</h2><div className="metric-label">Group applications, pipelines and environments by project.</div></div><button className="primary" onClick={() => setShowProjectForm(true)}>+ Create Project</button></div>
          {showProjectForm && <div className="card" style={{ marginBottom: 18 }}><form onSubmit={createProject}><div className="form-grid"><label>Project name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="ecommerce-platform" required /></label><label className="wide">Description<input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Applications and services" /></label></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setShowProjectForm(false)}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? "Creating…" : "Create Project"}</button></div></form></div>}
          {message && <div className="helper" style={{ marginBottom: 16 }}>{message}</div>}
          {projects.length === 0 ? <div className="empty-state"><h2>No projects yet</h2><p className="subtitle">Create your first project.</p></div> : <div className="project-list">{projects.map((project) => <div className="run" key={project.id}><div className="project-icon">P</div><div className="run-main"><div className="run-title">{project.name}</div><div className="run-meta">{project.description || "No description"}</div></div><button className="secondary" onClick={() => { setProjectId(project.id); setActive("Applications"); }}>View applications</button></div>)}</div>}
        </div></section>}

        {active === "Applications" && <section className="section"><div className="card" style={{ maxWidth: 1100 }}><div className="section-head"><div><h2>Applications</h2><div className="metric-label">Live applications loaded from Supabase.</div></div><button className="primary" onClick={() => { setAnalysis(null); setMessage(""); }}>+ Connect application</button></div>
          {applications.length > 0 && <div className="project-list">{applications.map((app) => <div className="run" key={app.id}><StatusDot status={app.pipeline_status} /><div className="run-main"><div className="run-title">{app.name}</div><div className="run-meta">{app.projects?.name || projects.find((p) => p.id === app.project_id)?.name || "Project"} · {app.runtime} {app.runtime_version} · {app.repository_url}</div></div><span className="badge success">{app.pipeline_status}</span></div>)}</div>}
          <div className="card" style={{ marginTop: 18 }}><div className="section-head"><div><h2>Connect application</h2><div className="metric-label">Analyze the repository, then create the application and pipeline.</div></div></div><form onSubmit={createApplication}><div className="form-grid"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Application name<input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="orders-api" /></label><label className="wide">GitHub repository URL<input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repository" required /></label><label>Branch<input value={branch} onChange={(e) => setBranch(e.target.value)} /></label><label>Image repository<input value={imageRepository} onChange={(e) => setImageRepository(e.target.value)} placeholder="registry/repository" /></label></div><div className="form-actions"><button type="button" className="secondary" onClick={analyzeRepository} disabled={busy || !repoUrl}>{busy ? "Analyzing…" : "Analyze repository"}</button><button type="submit" className="primary" disabled={busy || !analysis || !projectId}>{busy ? "Saving…" : "Create application + pipeline"}</button></div></form>{message && <div className="helper" style={{ marginTop: 16 }}>{message}</div>}</div>
          {analysis && <div className="card" style={{ marginTop: 18 }}><div className="section-head"><div><h2>Repository analysis</h2><div className="metric-label">Evidence-based runtime selection</div></div><span className="badge success">{analysis.confidence.toUpperCase()} CONFIDENCE</span></div><div className="grid"><div className="card metric-card"><div className="metric-label">Runtime</div><div className="metric" style={{ fontSize: 25 }}>{analysis.runtime}</div><div className="delta">Version {analysis.runtimeVersion}</div></div><div className="card metric-card"><div className="metric-label">Framework</div><div className="metric" style={{ fontSize: 25 }}>{analysis.framework || "—"}</div><div className="delta">Build: {analysis.buildTool}</div></div><div className="card metric-card"><div className="metric-label">Dockerfile</div><div className="metric" style={{ fontSize: 25 }}>{analysis.dockerfile ? "Found" : "Missing"}</div><div className="delta">{analysis.kubernetes ? "Kubernetes manifests found" : "No K8s manifests detected"}</div></div></div><div className="analysis-lines"><div><strong>Build:</strong> <code>{analysis.buildCommand || "Not generated"}</code></div><div><strong>Test:</strong> <code>{analysis.testCommand || "No automated test command"}</code></div>{analysis.evidence.map((e) => <div key={e}>✓ {e}</div>)}{analysis.warnings.map((w) => <div key={w} className="warning-text">⚠ {w}</div>)}</div></div>}
        </div></section>}

        {active === "Pipelines" && <section className="section"><div className="card"><div className="section-head"><div><h2>Pipelines</h2><div className="metric-label">Live pipeline definitions generated for applications.</div></div><button className="secondary" onClick={() => loadPipelines().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to refresh pipelines"))}>Refresh</button></div>{message && <div className="helper" style={{ marginBottom: 16 }}>{message}</div>}{pipelines.length === 0 ? <div className="empty-state"><h2>No pipelines yet</h2><p className="subtitle">Create an application to automatically generate its pipeline.</p><button className="primary" onClick={() => setActive("Applications")}>Create application</button></div> : <div className="project-list">{pipelines.map((pipeline) => <div className="run" key={pipeline.id}><div className="project-icon">⑂</div><div className="run-main"><div className="run-title">{pipeline.name}</div><div className="run-meta">{pipeline.applications?.name || "Application"} · template: {pipeline.template} · Tekton: {pipeline.tekton_pipeline_name || "not linked"}</div></div><span className="badge success">READY</span></div>)}</div>}</div></section>}

        {active !== "Dashboard" && active !== "Applications" && active !== "Projects" && active !== "Pipelines" && <div className="card empty-state"><div className="empty-icon">{active.slice(0, 1)}</div><h2>{active}</h2><p className="subtitle">This workspace is ready for the live Supabase and Tekton integration.</p><button className="primary" onClick={() => setActive("Applications")}>Connect an application</button></div>}
      </main>
    </div>
  );
}
