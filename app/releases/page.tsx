"use client";

import { useEffect, useState } from "react";

export default function ReleasesPage() {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/release-catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setReleases(data.releases || []))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (status: string) => status.replace(/_/g, " ");

  return <main style={{ minHeight: "100vh", background: "#f7f9fc", color: "#243145", padding: "34px" }}>
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <a href="/" style={{ color: "#5278bd", fontSize: 12, textDecoration: "none" }}>← TekForge</a>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, margin: "24px 0" }}>
        <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: "#7890b0" }}>DELIVERY</div><h1 style={{ margin: "6px 0", fontSize: 30, letterSpacing: -1.1 }}>Releases</h1><p style={{ margin: 0, color: "#7d8998", fontSize: 13 }}>Track versions, environments and promotion history across your applications.</p></div>
        <a href="/pipeline-studio" style={{ padding: "10px 14px", borderRadius: 8, background: "#426fbe", color: "#fff", fontSize: 11, textDecoration: "none" }}>Open Pipeline Studio</a>
      </div>
      {loading ? <div style={{ padding: 50, textAlign: "center", color: "#8290a1" }}>Loading releases…</div> : <div style={{ display: "grid", gap: 10 }}>{releases.map((release) => {
        const promotions = release.release_promotions || [];
        return <div key={release.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 17, boxShadow: "0 5px 18px rgba(31,52,80,.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
            <div><div style={{ fontSize: 11, fontWeight: 800 }}>{release.version}</div><div style={{ marginTop: 4, fontSize: 13, fontWeight: 650 }}>{release.applications?.name || "Application"} · {release.pipelines?.name || "Pipeline"}</div><div style={{ marginTop: 6, fontSize: 10, color: "#8290a1" }}>{release.commit_sha ? release.commit_sha.slice(0, 12) : "No commit pinned"} · {release.current_environment || "unassigned"} → {release.target_environment || "unassigned"}</div></div>
            <span style={{ padding: "5px 8px", borderRadius: 999, background: release.status === "succeeded" ? "#ecfdf3" : release.status === "failed" ? "#fff1f2" : "#eef4ff", color: release.status === "succeeded" ? "#15803d" : release.status === "failed" ? "#be123c" : "#4674c9", fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>{statusLabel(release.status)}</span>
          </div>
          {promotions.length > 0 && <div style={{ display: "flex", gap: 7, marginTop: 14, flexWrap: "wrap" }}>{promotions.map((promotion: any) => <span key={promotion.id} style={{ padding: "6px 8px", border: "1px solid #e5eaf0", borderRadius: 6, fontSize: 8, color: "#6e7d90" }}>{promotion.from_environment || "start"} → {promotion.to_environment} · {statusLabel(promotion.status)}</span>)}</div>}
        </div>;
      })}{!releases.length && <div style={{ padding: 60, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#8290a1", fontSize: 12 }}>No releases yet. Create one from your delivery workflow.</div>}</div>}
    </div>
  </main>;
}
