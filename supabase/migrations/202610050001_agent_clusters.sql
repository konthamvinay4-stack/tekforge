create table if not exists public.agent_clusters (
  id uuid primary key,
  name text not null,
  provider text not null,
  status text not null default 'pending' check (status in ('pending','connected','offline')),
  kubernetes_version text,
  nodes integer not null default 0,
  pods integer not null default 0,
  namespaces integer not null default 0,
  tekton boolean not null default false,
  last_heartbeat timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_clusters_last_heartbeat_idx on public.agent_clusters(last_heartbeat);

alter table public.agent_clusters enable row level security;

-- The agent heartbeat/status API uses the server-only service role.
-- Add organization/user policies before exposing cluster rows directly to browser clients.
