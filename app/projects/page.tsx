"use client";

import { FormEvent, useEffect, useState } from "react";

type Project = { id: string; name: string; description: string | null; created_at: string };

type Application = {
  id: string;
  project_id: string;
  name: string;
  repository_url: string;
  default_branch: string;
  runtime: string;
  runtime_version: string;
  pipeline_status: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [name, setName] = useState("");
  const [appName, setAppName] = useState("");
  const [repo, setRepo] = useState("");
  const [message, setMessage] = useState("");

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const json = await response.json();
    setProjects(json.projects ?? []);
    if (!selected && json.projects?.[0]) setSelected(json.projects[0]);
  }

  async function loadApplications(projectId: string) {
    const response = await fetch(`/api/applications?projectId=${projectId}`);
    const json = await response.json();
    setApplications(json.applications ?? []);
  }

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (selected) loadApplications(selected.id); }, [selected]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setMessage("Creating project...");
    const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error ?? "Could not create project");
    setName("");
    setMessage("Project created. Next, connect an application repository.");
    await loadProjects();
    setSelected(json.project);
  }

  async function createApplication(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setMessage("Saving application...");
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selected.id, name: appName, repositoryUrl: repo, runtime: "nodejs", runtimeVersion: "22" }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error ?? "Could not create application");
    setAppName("");
    setRepo("");
    setMessage("Application connected. The next step is to generate its CI/CD pipeline.");
    await loadApplications(selected.id);
  }

  return (
    <main className="main" style={{ marginLeft: 0, width: "100%", maxWidth: 1180, margin: "0 auto" }}>
      <header className="topbar"><div><p className="eyebrow">Workspace / Projects</p><h1>Projects</h1><p className="subtitle">A project groups applications, pipelines and deployment environments.</p></div></header>
      <div className="helper"><strong>Start here:</strong> create a project → connect your Git repository → TekForge will generate a readable pipeline plan → later, a Git push will start the Tekton PipelineRun.</div>
      <section className="pipeline section">
        <div className="card">
          <div className="section-head"><h2>Your projects</h2></div>
          {projects.length === 0 && <p className="subtitle">No projects yet. Create your first project below.</p>}
          {projects.map((project) => <button key={project.id} className={`nav-item ${selected?.id === project.id ? "active" : ""}`} style={{ color: selected?.id === project.id ? "white" : "#334155", background: selected?.id === project.id ? "#1f2937" : "#f8fafc" }} onClick={() => setSelected(project)}>{project.name}</button>)}
          <form onSubmit={createProject} style={{ display: "flex", gap: 8, marginTop: 14 }}><input required placeholder="e.g. Commerce Platform" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, padding: 10, border: "1px solid #d6dde7", borderRadius: 8 }} /><button className="primary">Create project</button></form>
        </div>
        <div className="card">
          <div className="section-head"><div><h2>{selected ? `${selected.name} applications` : "Applications"}</h2><div className="metric-label">Connect source code without writing Tekton YAML.</div></div></div>
          {selected ? <form onSubmit={createApplication}>
            <label className="metric-label">Application name</label><input required placeholder="orders-api" value={appName} onChange={(e) => setAppName(e.target.value)} style={{ width: "100%", padding: 10, margin: "6px 0 12px", border: "1px solid #d6dde7", borderRadius: 8 }} />
            <label className="metric-label">Git repository URL</label><input required placeholder="https://github.com/org/orders-api" value={repo} onChange={(e) => setRepo(e.target.value)} style={{ width: "100%", padding: 10, margin: "6px 0 12px", border: "1px solid #d6dde7", borderRadius: 8 }} />
            <button className="primary">Connect application</button>
          </form> : <p className="subtitle">Select or create a project to continue.</p>}
          {applications.length > 0 && <div style={{ marginTop: 18 }}>{applications.map((app) => <div className="run" key={app.id}><span className="status green" /><div className="run-main"><div className="run-title">{app.name}</div><div className="run-meta">{app.repository_url} · {app.runtime} {app.runtime_version}</div></div><span className="badge success">connected</span></div>)}</div>}
        </div>
      </section>
      {message && <div className="helper" style={{ marginTop: 16 }}>{message}</div>}
    </main>
  );
}
