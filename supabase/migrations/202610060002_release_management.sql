create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  pipeline_id uuid references public.pipelines(id) on delete set null,
  version text not null,
  commit_sha text,
  status text not null default 'draft' check (status in ('draft','queued','running','succeeded','failed','rolled_back','cancelled')),
  current_environment text,
  target_environment text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, version)
);

create table if not exists public.release_promotions (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  from_environment text,
  to_environment text not null,
  status text not null default 'pending' check (status in ('pending','approved','running','succeeded','failed','rolled_back','rejected')),
  approval_required boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  pipeline_run_id uuid references public.pipeline_runs(id) on delete set null,
  verification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists releases_application_idx on public.releases(application_id, created_at desc);
create index if not exists releases_status_idx on public.releases(status, created_at desc);
create index if not exists release_promotions_release_idx on public.release_promotions(release_id, created_at desc);

alter table public.releases enable row level security;
alter table public.release_promotions enable row level security;

create policy "authenticated users can read releases" on public.releases for select to authenticated using (true);
create policy "authenticated users can create releases" on public.releases for insert to authenticated with check (true);
create policy "authenticated users can update releases" on public.releases for update to authenticated using (true) with check (true);

create policy "authenticated users can read release promotions" on public.release_promotions for select to authenticated using (true);
create policy "authenticated users can create release promotions" on public.release_promotions for insert to authenticated with check (true);
create policy "authenticated users can update release promotions" on public.release_promotions for update to authenticated using (true) with check (true);