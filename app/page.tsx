"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const nav = [
  { label: "Overview", icon: "grid" },
  { label: "Projects", icon: "folder" },
  { label: "Applications", icon: "box" },
  { label: "Pipelines", icon: "git" },
  { label: "Pipeline Studio", icon: "wand" },
  { label: "Releases", icon: "release" },
  { label: "Deployments", icon: "rocket" },
  { label: "Agents", icon: "server" },
];
const platform = [
  { label: "Tekton", status: "Healthy" },
  { label: "Artifact Registry", status: "Ready" },
  { label: "Control plane", status: "Connected" },
];

type Project = { id: string; name: string; description?: string | null; created_at?: string };
type Application = { id: string; project_id: string; name: string; repository_url: string; default_branch: string; runtime: string; runtime_version: string; build_command: string; test_command: string; image_repository?: string | null; pipeline_status: string; projects?: { name: string } | null; pipelines?: Pipeline[] };
type Pipeline = { id: string; application_id: string; name: string; template: string; spec?: Record<string, unknown>; tekton_pipeline_name?: string | null; created_at?: string };
type Analysis = { runtime: string; runtimeVersion: string; framework: string | null; buildTool: string; buildCommand: string; testCommand: string; dockerfile: string | null; kubernetes: boolean; confidence: string; evidence: string[]; warnings: string[] };

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    folder: <><path d="M3 7.5h6l2-2h10v12.5A2 2 0 0 1 19 20H5a2 2 0 0 1-2-2.5z" /><path d="M3 9h18" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4.5 7.7 7.5 4.1 7.5-4.1M12 12v9" /></>,
    git: <><circle cx="7" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="M9.5 8.5 14.5 13.5M7 10v7a4 4 0 0 0 4 4h3" /></>,
    wand: <><path d="m15 4 5 5M13 6l5 5M4 20l10-10" /><path d="m5 5 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /></>,
    rocket: <><path d="M14 4c3-2 6-2 7-1 1 1 1 4-1 7l-7 7-5-5z" /><path d="m8 16-4 1 1-4M6 21l-2-2M9 12l-2-2" /><circle cx="16.5" cy="7.5" r="1.3" /></>,
    release: <><path d="M5 5h14v14H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
    server: <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01M11 6.5h7M11 17.5h7" /></>,
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 4.5v15A2.5 2.5 0 0 1 6.5 17H20" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

function StatusDot({ status }: { status: string }) {
  const tone = status === "success" || status === "ready" || status === "connected" ? "success" : status === "running" ? "warning" : "danger";
  return <span className={`status-dot ${tone}`} />;
}

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [projectId, setProjectId] = useState("");
  const [appName, setAppName] = useState("");
  const [imageRepository, setImageRepository] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

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
  async function loadAgents() {
    const response = await fetch("/api/agent/clusters", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load agents");
    setAgents(data.clusters || []);
  }
  async function loadPipelines() {
    const response = await fetch("/api/pipelines", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load pipelines");
    setPipelines(data.pipelines || []);
  }

  async function loadReleases() {
    const response = await fetch("/api/releases", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load releases");
    setReleases(data.releases || []);
  }

  useEffect(() => {
    loadProjects().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load projects"));
    loadApplications().catch(() => undefined);
    loadPipelines().catch(() => undefined);
    loadReleases().catch(() => undefined);
    loadAgents().catch(() => undefined);
    if (window.localStorage.getItem("tekforge-onboarding-complete") !== "true") setShowGuide(true);
  }, []);
  useEffect(() => {
    if (projectId) loadApplications().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load applications"));
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
      setProjectId(data.project.id); setProjectName(""); setProjectDescription(""); setShowProjectForm(false);
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

  const connectedAgents = agents.filter((a) => a.status === "connected").length;
  const readiness = [
    { label: "Agent connected", done: connectedAgents > 0 },
    { label: "Repository connected", done: applications.length > 0 },
    { label: "Pipeline ready", done: pipelines.length > 0 },
    { label: "Ready to deploy", done: connectedAgents > 0 && pipelines.length > 0 },
  ];
  const completed = readiness.filter((x) => x.done).length;

  function openPipelineStudio() {
    const app = applications[0];
    window.location.href = app ? `/pipeline-studio?applicationId=${app.id}` : "/pipeline-studio";
  }

  function finishGuide() {
    window.localStorage.setItem("tekforge-onboarding-complete", "true");
    setShowGuide(false);
    setGuideStep(0);
  }

  function guideAction(step: number) {
    if (step === 0) window.location.href = "/agents";
    if (step === 1) { setActive("Applications"); setShowGuide(false); }
    if (step === 2) openPipelineStudio();
    if (step === 3) { setActive("Deployments"); setShowGuide(false); }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">TF</span><div><strong>TekForge</strong><small>Platform Engineering</small></div></div>
        <div className="workspace-switch"><span className="workspace-avatar">P</span><div><strong>Personal workspace</strong><span>Control plane</span></div><Icon name="chevron" size={15} /></div>
        <nav>
          <div className="nav-section">Workspace</div>
          {nav.slice(0, 5).map((item) => <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => item.label === "Pipeline Studio" ? openPipelineStudio() : setActive(item.label)}><span className="nav-icon"><Icon name={item.icon} size={17} /></span><span>{item.label}</span>{item.label === "Applications" && applications.length > 0 && <em>{applications.length}</em>}</button>)}
          <div className="nav-section">Delivery</div>
          {nav.slice(5).map((item) => <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => item.label === "Agents" ? window.location.href = "/agents" : setActive(item.label)}><span className="nav-icon"><Icon name={item.icon} size={17} /></span><span>{item.label}</span>{item.label === "Agents" && connectedAgents > 0 && <i className="nav-live" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="nav-section">System</div>
          {platform.map((item) => <div className="system-row" key={item.label}><span><span className="system-dot" />{item.label}</span><strong>{item.status}</strong></div>)}
          <button className="help-link" onClick={() => { setGuideStep(0); setShowGuide(true); }}><span className="help-icon">?</span> Open getting started guide</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{active}</strong></div>
          <div className="topbar-actions"><button className="docs-button"><Icon name="book" size={16} /> Documentation</button><button className="icon-button" aria-label="Open guide" onClick={() => setShowGuide(true)}>?</button><div className="profile"><span>VK</span></div></div>
        </header>

        {active === "Overview" && <div className="page">
          <section className="welcome-row">
            <div><div className="kicker">TEKFORGE CONTROL PLANE</div><h1>Good to ship?</h1><p>Build, secure and deploy your applications through one Kubernetes-native workflow.</p></div>
            <div className="welcome-actions"><button className="secondary" onClick={() => setShowGuide(true)}>How it works</button><button className="primary" onClick={() => setActive("Applications")}><Icon name="plus" size={16} /> Connect repository</button></div>
          </section>

          <section className="getting-started card">
            <div className="getting-copy"><div className="section-kicker">GETTING STARTED</div><h2>Your path from code to production</h2><p>TekForge keeps the control plane simple: connect your cluster, connect your repository, design the delivery pipeline, then deploy.</p></div>
            <div className="progress-wrap"><div className="progress-label"><span>{completed}/4 steps complete</span><span>{Math.round((completed / 4) * 100)}%</span></div><div className="progress"><span style={{ width: `${completed * 25}%` }} /></div></div>
            <div className="onboarding-steps">
              {[
                { title: "Install Agent", text: "Connect your Kubernetes cluster", action: () => window.location.href = "/agents", done: connectedAgents > 0, icon: "server" },
                { title: "Connect Repository", text: "Analyze Git and create an app", action: () => setActive("Applications"), done: applications.length > 0, icon: "git" },
                { title: "Design Pipeline", text: "Build the visual Tekton workflow", action: openPipelineStudio, done: pipelines.length > 0, icon: "wand" },
                { title: "Deploy & observe", text: "Run and inspect TaskRuns", action: () => setActive("Deployments"), done: false, icon: "rocket" },
              ].map((item, i) => <button className={`onboarding-step ${item.done ? "done" : ""}`} key={item.title} onClick={item.action}><span className="step-icon"><Icon name={item.done ? "check" : item.icon} size={17} /></span><span><strong>{item.title}</strong><small>{item.text}</small></span><Icon name="arrow" size={15} /></button>)}
            </div>
          </section>

          <section className="metrics-grid">
            <div className="metric-card card"><span>Projects</span><strong>{projects.length}</strong><small>Workspace projects</small></div>
            <div className="metric-card card"><span>Applications</span><strong>{applications.length}</strong><small>Connected repositories</small></div>
            <div className="metric-card card"><span>Pipelines</span><strong>{pipelines.length}</strong><small>Tekton delivery plans</small></div>
            <div className="metric-card card"><span>Agents</span><strong>{connectedAgents}</strong><small>{agents.length ? "Connected clusters" : "No cluster connected"}</small></div>
          </section>

          <section className="content-grid">
            <div className="card delivery-card"><div className="section-head"><div><h2>Delivery workflow</h2><p>Reference path generated by TekForge</p></div><span className="live-pill"><span /> READY</span></div><div className="delivery-flow">{["Checkout","Build","Test","Security","Image","Deploy"].map((step, i) => <div className="delivery-item" key={step}><div className="delivery-node"><span>{i + 1}</span><strong>{step}</strong><small>{step === "Security" ? "Trivy scan" : step === "Image" ? "Artifact Registry" : step === "Deploy" ? "Kubernetes rollout" : "Tekton Task"}</small></div>{i < 5 && <div className="delivery-arrow"><Icon name="arrow" size={15} /></div>}</div>)}</div></div>
            <div className="card health-card"><div className="section-head"><div><h2>Platform health</h2><p>Control-plane services</p></div><span className="live-pill"><span /> LIVE</span></div>{platform.map((item) => <div className="health-item" key={item.label}><div><span className="health-check"><Icon name="check" size={12} /></span><strong>{item.label}</strong></div><span>{item.status}</span></div>)}<div className="health-footer"><Icon name="activity" size={15} /> Agent-backed execution is enabled for connected clusters.</div></div>
          </section>

          {message && <div className="toast-inline">{message}</div>}
        </div>}

        {active === "Projects" && <section className="page"><div className="page-heading"><div><div className="kicker">WORKSPACE</div><h1>Projects</h1><p>Group applications, pipelines and environments by project.</p></div><button className="primary" onClick={() => setShowProjectForm(true)}><Icon name="plus" size={16} /> Create project</button></div><div className="card">{showProjectForm && <div className="inline-form"><form onSubmit={createProject}><div className="form-grid"><label>Project name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="ecommerce-platform" required /></label><label>Description<input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Applications and services" /></label></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setShowProjectForm(false)}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button></div></form></div>}{projects.length === 0 ? <div className="empty-state"><h2>No projects yet</h2><p>Create your first project to organize applications and pipelines.</p></div> : <div className="resource-list">{projects.map((project) => <div className="resource-row" key={project.id}><div className="resource-icon"><Icon name="folder" size={18} /></div><div className="resource-main"><strong>{project.name}</strong><small>{project.description || "No description"}</small></div><button className="secondary" onClick={() => { setProjectId(project.id); setActive("Applications"); }}>View applications <Icon name="arrow" size={14} /></button></div>)}</div>}</div></section>}

        {active === "Applications" && <section className="page"><div className="page-heading"><div><div className="kicker">SOURCE & RUNTIME</div><h1>Applications</h1><p>Connect Git, analyze the codebase and create a delivery-ready application.</p></div><button className="primary" onClick={() => { setAnalysis(null); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="plus" size={16} /> New application</button></div><div className="content-grid applications-layout"><div className="card"><div className="section-head"><div><h2>Connected applications</h2><p>Live application records from the control plane.</p></div></div>{applications.length === 0 ? <div className="empty-state"><h2>No applications</h2><p>Connect a repository to get started.</p></div> : <div className="resource-list">{applications.map((app) => <div className="resource-row" key={app.id}><StatusDot status={app.pipeline_status} /><div className="resource-main"><strong>{app.name}</strong><small>{app.runtime} {app.runtime_version} · {app.repository_url}</small></div><span className="status-label">{app.pipeline_status}</span></div>)}</div>}</div><div className="card connect-card"><div className="section-head"><div><h2>Connect repository</h2><p>We analyze the repo before generating the pipeline.</p></div></div><form onSubmit={createApplication}><div className="form-grid one"><label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Git repository<input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repository" required /></label><label>Branch<input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" /></label><label>Application name<input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="orders-api" /></label><label>Image repository<input value={imageRepository} onChange={(e) => setImageRepository(e.target.value)} placeholder="registry/orders-api" /></label></div><div className="form-actions"><button type="button" className="secondary" onClick={analyzeRepository} disabled={busy || !repoUrl}>{busy ? "Analyzing…" : "Analyze repository"}</button><button type="submit" className="primary" disabled={busy || !analysis || !projectId}>{busy ? "Creating…" : "Create application"}</button></div></form>{message && <div className="toast-inline">{message}</div>}{analysis && <div className="analysis-card"><div className="section-head"><div><h3>Repository detected</h3><p>Evidence-based runtime selection</p></div><span className="confidence">{analysis.confidence.toUpperCase()} confidence</span></div><div className="analysis-grid"><div><span>Runtime</span><strong>{analysis.runtime}</strong></div><div><span>Framework</span><strong>{analysis.framework || "—"}</strong></div><div><span>Build tool</span><strong>{analysis.buildTool}</strong></div></div><div className="analysis-command"><span>Build</span><code>{analysis.buildCommand || "Not generated"}</code></div><div className="analysis-command"><span>Test</span><code>{analysis.testCommand || "No test command"}</code></div></div>}</div></div></section>}

        {active === "Pipelines" && <section className="page"><div className="page-heading"><div><div className="kicker">DELIVERY</div><h1>Pipelines</h1><p>Visual delivery definitions compiled into deployable Tekton resources.</p></div><button className="primary" onClick={openPipelineStudio}>Open Pipeline Studio <Icon name="arrow" size={15} /></button></div><div className="card">{pipelines.length === 0 ? <div className="empty-state"><h2>No pipelines yet</h2><p>Create an application or design a pipeline from scratch.</p></div> : <div className="resource-list">{pipelines.map((pipeline) => <div className="resource-row" key={pipeline.id}><div className="resource-icon"><Icon name="git" size={18} /></div><div className="resource-main"><strong>{pipeline.name}</strong><small>{pipeline.tekton_pipeline_name || "Not linked"} · {pipeline.template}</small></div><span className="status-label success-text">READY</span></div>)}</div>}</div></section>}

        {active === "Agents" && <section className="page"><div className="page-heading"><div><div className="kicker">DATA PLANE</div><h1>Kubernetes Agents</h1><p>Connect GKE, EKS, AKS or on-prem clusters using an outbound-only agent.</p></div><button className="primary" onClick={() => window.location.href = "/agents"}>Install agent <Icon name="arrow" size={15} /></button></div><div className="card">{agents.length === 0 ? <div className="empty-state"><div className="empty-icon"><Icon name="server" size={22} /></div><h2>No agents connected</h2><p>Install the TekForge agent into your Kubernetes cluster to enable execution.</p><button className="primary" onClick={() => window.location.href = "/agents"}>Install first agent</button></div> : <div className="resource-list">{agents.map((agent) => <div className="resource-row" key={agent.id}><StatusDot status={agent.status} /><div className="resource-main"><strong>{agent.name}</strong><small>{agent.provider} · Kubernetes {agent.kubernetes_version || "unknown"} · {agent.nodes} nodes · {agent.pods} pods</small></div><span className={`status-label ${agent.status === "connected" ? "success-text" : ""}`}>{agent.status}</span></div>)}</div>}</div></section>}

        {active === "Releases" && <section className="page">
          <div className="page-heading"><div><div className="kicker">RELEASE ORCHESTRATION</div><h1>Releases</h1><p>Track every PipelineRun as a release candidate across environments.</p></div><button className="secondary" onClick={() => loadReleases().catch((e) => setMessage(e instanceof Error ? e.message : "Unable to refresh releases"))}>Refresh</button></div>
          <div className="metrics-grid">
            <div className="metric-card card"><span>Total releases</span><strong>{releases.length}</strong><small>Recent execution history</small></div>
            <div className="metric-card card"><span>Running</span><strong>{releases.filter((r) => r.status === "running").length}</strong><small>Active PipelineRuns</small></div>
            <div className="metric-card card"><span>Successful</span><strong>{releases.filter((r) => r.status === "success").length}</strong><small>Completed releases</small></div>
            <div className="metric-card card"><span>Failed</span><strong>{releases.filter((r) => r.status === "failed").length}</strong><small>Releases requiring attention</small></div>
          </div>
          <div className="card">
            <div className="section-head"><div><h2>Release history</h2><p>Revision, environment and execution state from the control plane.</p></div><span className="live-pill"><span /> LIVE</span></div>
            {releases.length === 0 ? <div className="empty-state"><h2>No releases yet</h2><p>Run a saved pipeline from Pipeline Studio and its PipelineRun will appear here.</p><button className="primary" onClick={openPipelineStudio}>Open Pipeline Studio <Icon name="arrow" size={15} /></button></div> :
              <div className="resource-list">{releases.map((release) => <div className="resource-row" key={release.id}>
                <StatusDot status={release.status} />
                <div className="resource-main"><strong>{release.release} · {release.application}</strong><small>{release.pipeline} · {release.environment} · {String(release.revision).slice(0, 12)}</small></div>
                <span className={`status-label ${release.status === "success" ? "success-text" : release.status === "running" ? "" : ""}`}>{release.status}</span>
              </div>)}</div>}
          </div>
        </section>}

        {(active === "Deployments" || active === "Pipeline Studio") && <section className="page"><div className="page-heading"><div><div className="kicker">DELIVERY</div><h1>{active}</h1><p>{active === "Deployments" ? "Observe rollout status, execution history and cluster-backed delivery." : "Design, validate and compile your delivery graph."}</p></div><button className="primary" onClick={active === "Pipeline Studio" ? openPipelineStudio : openPipelineStudio}>{active === "Deployments" ? "Open Pipeline Studio" : "Launch Studio"} <Icon name="arrow" size={15} /></button></div><div className="card empty-state"><div className="empty-icon"><Icon name={active === "Deployments" ? "rocket" : "wand"} size={22} /></div><h2>{active === "Deployments" ? "Deployment center" : "Pipeline Studio"}</h2><p>{active === "Deployments" ? "Use the Studio to deploy through a connected agent, then observe PipelineRuns and TaskRuns." : "The visual graph is the source of truth for generated Tekton resources."}</p></div></section>}

        {showGuide && <div className="guide-overlay" role="dialog" aria-modal="true"><div className="guide-backdrop" onClick={finishGuide} /><div className="guide-modal"><div className="guide-header"><div><span className="guide-brand">TF</span><span>TekForge onboarding</span></div><button className="icon-button" onClick={finishGuide}><Icon name="close" size={17} /></button></div><div className="guide-progress">{[0,1,2,3].map((i) => <span key={i} className={i <= guideStep ? "active" : ""} />)}</div><div className="guide-body"><div className="guide-art"><div className="guide-art-icon"><Icon name={["server","git","wand","rocket"][guideStep]} size={28} /></div><span>0{guideStep + 1}</span></div><div className="guide-content"><div className="kicker">STEP {guideStep + 1} OF 4</div><h2>{["Connect your Kubernetes cluster","Connect your source repository","Design the delivery pipeline","Deploy and observe"][guideStep]}</h2><p>{["Install the TekForge Agent in your GKE, EKS, AKS or on-prem cluster. It opens the outbound connection and keeps your Kubernetes API private.","Add a Git repository. TekForge inspects the codebase to detect runtime, framework, build system, tests, Docker and Kubernetes configuration.","Use Pipeline Studio to arrange Checkout, Build, Test, Security, Image and Deploy stages. The graph becomes deployable Tekton resources.","Deploy through the connected agent, start a PipelineRun and watch TaskRuns and logs from the same workspace."][guideStep]}</p><div className="guide-note"><Icon name="check" size={15} /><span>Recommended order: Agent → Repository → Pipeline → Deploy</span></div></div></div><div className="guide-footer"><button className="link-button" onClick={finishGuide}>Skip for now</button><div><button className="secondary" disabled={guideStep === 0} onClick={() => setGuideStep((s) => s - 1)}>Back</button>{guideStep < 3 ? <button className="primary" onClick={() => setGuideStep((s) => s + 1)}>Next <Icon name="arrow" size={15} /></button> : <button className="primary" onClick={finishGuide}>Start building <Icon name="arrow" size={15} /></button>}</div></div></div></div>}
      </main>
    </div>
  );
}
