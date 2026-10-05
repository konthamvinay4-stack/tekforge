create table if not exists public.agent_commands (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.agent_clusters(id) on delete cascade,
  type text not null check (type in ('apply-tekton','pipeline-run','cancel-run')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','leased','completed','failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  leased_at timestamptz,
  completed_at timestamptz
);

create index if not exists agent_commands_cluster_status_idx on public.agent_commands(cluster_id, status, created_at);
create index if not exists agent_commands_created_idx on public.agent_commands(created_at desc);

alter table public.agent_commands enable row level security;
