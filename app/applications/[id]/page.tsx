"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Application = {
  id: string;
  name: string;
  repository_url: string;
  default_branch: string;
  runtime: string;
  runtime_version: string;
  pipeline_status: string;
  projects?: { id: string; name: string } | null;
};

type Pipeline = {
  id: string;
  name: string;
  template: string | null;
  tekton_pipeline_name: string | null;
  spec: any;
  created_at: string;
  updated_at: string;
};

export default function ApplicationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/applications/" + encodeURIComponent(params.id), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load application");
      setApplication(data.application);
      setPipelines(data.pipelines || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load application");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) load();
  }, [params.id]);

  const primaryPipeline = useMemo(() => pipelines[0] || null, [pipelines]);

  function editPipeline(pipeline?: Pipeline | null) {
    const query = new URLSearchParams({ applicationId: params.id });
    if (pipeline?.id) query.set("pipelineId", pipeline.id); else query.set("new", "1");
    router.push("/pipeline-studio?" + query.toString());
  }

  if (loading) return <main className="main" style={{ marginLeft: 0, width: "100%", maxWidth: 1180, margin: "0 auto" }}><div className="helper">Loading application…</div></main>;

  if (!application) return <main className="main" style={{ marginLeft: 0, width: "100%", maxWidth: 1180, margin: "0 auto" }}><div className="helper">{message || "Application not found."}</div></main>;

  return (
    <main className="main" style={{ marginLeft: 0, width: "100%", maxWidth: 1180, margin: "0 auto" }}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Workspace / {application.projects?.name || "Project"} / Application</p>
          <h1>{application.name}</h1>
          <p className="subtitle">Application-specific CI/CD configuration and deployment controls.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={() => router.push("/projects")}>Back to project</button>
          <button className="primary" onClick={() => editPipeline(primaryPipeline)}>Edit pipeline</button>
        </div>
      </header>

      <section className="pipeline section" style={{ gridTemplateColumns: "1.15fr .85fr" }}>
        <div className="card">
          <div className="section-head"><div><h2>Application</h2><div className="metric-label">This application is the source of truth for repository-specific pipeline execution.</div></div><span className="badge success">{application.pipeline_status || "ready"}</span></div>
          <div className="run" style={{ marginTop: 12 }}>
            <div className="run-main">
              <div className="run-title">{application.repository_url}</div>
              <div className="run-meta">Branch: {application.default_branch || "main"} · Runtime: {application.runtime} {application.runtime_version}</div>
            </div>
          </div>
          <div className="helper" style={{ marginTop: 16 }}>
            Every pipeline opened from this application receives this repository as its execution source. That keeps different applications and repositories isolated even when they use the same central Pipeline Studio.
          </div>
        </div>

        <div className="card">
          <div className="section-head"><div><h2>Pipeline</h2><div className="metric-label">Edit the visual graph, validate it, deploy it to an agent, then run it.</div></div></div>
          {primaryPipeline ? (
            <div className="run" style={{ marginTop: 12 }}>
              <div className="run-main">
                <div className="run-title">{primaryPipeline.name}</div>
                <div className="run-meta">{primaryPipeline.template || "visual"} · {primaryPipeline.tekton_pipeline_name || "not deployed"}</div>
              </div>
              <button className="primary" onClick={() => editPipeline(primaryPipeline)}>Update pipeline</button>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <p className="subtitle">No pipeline exists for this application yet.</p>
              <button className="primary" onClick={() => editPipeline(null)}>Create pipeline</button>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-head"><div><h2>Pipeline history</h2><div className="metric-label">All pipeline definitions attached to this application.</div></div><button className="secondary" onClick={() => editPipeline(null)}>New pipeline</button></div>
        {pipelines.length === 0 ? <p className="subtitle" style={{ marginTop: 14 }}>No pipeline definitions yet.</p> : (
          <div style={{ marginTop: 12 }}>
            {pipelines.map((pipeline) => (
              <div className="run" key={pipeline.id} style={{ marginBottom: 8 }}>
                <span className="status green" />
                <div className="run-main">
                  <div className="run-title">{pipeline.name}</div>
                  <div className="run-meta">{pipeline.template || "visual"} · Updated {new Date(pipeline.updated_at || pipeline.created_at).toLocaleString()}</div>
                </div>
                <button className="secondary" onClick={() => editPipeline(pipeline)}>Open editor</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {message && <div className="helper" style={{ marginTop: 16 }}>{message}</div>}
    </main>
  );
}
