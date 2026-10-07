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

  if (loading) return (
    <main className="page application-page">
      <div className="helper">Loading application…</div>
    </main>
  );

  if (!application) return (
    <main className="page application-page">
      <div className="empty-state"><h2>Application not found</h2><p>{message || "Unable to load this application."}</p></div>
    </main>
  );

  return (
    <main className="page application-page">
      <header className="page-heading">
        <div>
          <div className="kicker">APPLICATION</div>
          <h1>{application.name}</h1>
          <p>Application-specific CI/CD configuration and deployment controls.</p>
        </div>
        <div className="welcome-actions">
          <button className="secondary" onClick={() => router.push("/projects")}>Back to project</button>
          <button className="primary" onClick={() => editPipeline(primaryPipeline)}>
            {primaryPipeline ? "Edit pipeline" : "Create pipeline"}
          </button>
        </div>
      </header>

      <section className="content-grid application-overview">
        <div className="card application-card">
          <div className="section-head">
            <div>
              <h2>Application</h2>
              <p>Repository and runtime used by this application's pipelines.</p>
            </div>
            <span className="live-pill"><span /> {application.pipeline_status || "READY"}</span>
          </div>
          <div className="application-repository">
            <strong>{application.repository_url}</strong>
            <span>Branch: {application.default_branch || "main"} · Runtime: {application.runtime} {application.runtime_version}</span>
          </div>
          <div className="health-footer">
            Every pipeline opened from this application is scoped to this application ID and repository. Pipelines from other applications cannot be edited through this page.
          </div>
        </div>

        <div className="card application-card">
          <div className="section-head">
            <div>
              <h2>Primary pipeline</h2>
              <p>The most recently updated pipeline for this application.</p>
            </div>
          </div>
          {primaryPipeline ? (
            <div className="resource-row application-primary-pipeline">
              <div className="resource-icon"><span>⌘</span></div>
              <div className="resource-main">
                <strong>{primaryPipeline.name}</strong>
                <small>{primaryPipeline.template || "visual"} · Tekton: {primaryPipeline.tekton_pipeline_name || "not deployed"}</small>
              </div>
              <button className="secondary" onClick={() => editPipeline(primaryPipeline)}>Edit</button>
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h2>No pipeline yet</h2>
              <p>Create the first pipeline for this application.</p>
              <button className="primary" onClick={() => editPipeline(null)}>Create pipeline</button>
            </div>
          )}
        </div>
      </section>

      <section className="card application-card application-history">
        <div className="section-head">
          <div>
            <h2>Pipeline history</h2>
            <p>{pipelines.length} pipeline definition{pipelines.length === 1 ? "" : "s"} attached to {application.name}.</p>
          </div>
          <button className="secondary" onClick={() => editPipeline(null)}>New pipeline</button>
        </div>

        {pipelines.length === 0 ? (
          <div className="empty-state compact-empty">
            <h2>No pipeline definitions</h2>
            <p>Create a pipeline to start designing the Tekton delivery workflow.</p>
          </div>
        ) : (
          <div className="resource-list">
            {pipelines.map((pipeline) => (
              <div className="resource-row" key={pipeline.id}>
                <span className="status-dot success" />
                <div className="resource-main">
                  <strong>{pipeline.name}</strong>
                  <small>{pipeline.template || "visual"} · Tekton: {pipeline.tekton_pipeline_name || "not deployed"} · Updated {new Date(pipeline.updated_at || pipeline.created_at).toLocaleString()}</small>
                </div>
                <button className="secondary" onClick={() => editPipeline(pipeline)}>Open editor</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {message && <div className="toast-inline">{message}</div>}
    </main>
  );
}
