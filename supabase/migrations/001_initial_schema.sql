create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  repository_url text not null,
  default_branch text not null default 'main',
  runtime text not null default 'nodejs',
  runtime_version text not null default '22',
  build_command text not null default 'npm ci',
  test_command text not null default 'npm test',
  image_repository text,
  pipeline_status text not null default 'not_configured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create table if not exists environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  cluster_name text,
  namespace text not null,
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

create table if not exists pipelines (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  name text not null,
  template text not null default 'node-ci',
  spec jsonb not null default '{}'::jsonb,
  tekton_pipeline_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  environment_id uuid references environments(id) on delete set null,
  commit_sha text,
  branch text,
  status text not null default 'queued',
  tekton_pipeline_run_name text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists pipeline_tasks (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references pipeline_runs(id) on delete cascade,
  task_name text not null,
  display_name text not null,
  status text not null default 'queued',
  message text,
  started_at timestamptz,
  finished_at timestamptz,
  log_excerpt text,
  created_at timestamptz not null default now()
);

create index if not exists idx_applications_project on applications(project_id);
create index if not exists idx_pipelines_application on pipelines(application_id);
create index if not exists idx_pipeline_runs_pipeline on pipeline_runs(pipeline_id);
create index if not exists idx_pipeline_tasks_run on pipeline_tasks(pipeline_run_id);

alter table projects enable row level security;
alter table applications enable row level security;
alter table environments enable row level security;
alter table pipelines enable row level security;
alter table pipeline_runs enable row level security;
alter table pipeline_tasks enable row level security;

-- MVP development policies. Replace with organization/member-scoped policies before production multi-tenancy.
create policy "authenticated users can read projects" on projects for select to authenticated using (true);
create policy "authenticated users can create projects" on projects for insert to authenticated with check (true);
create policy "authenticated users can update projects" on projects for update to authenticated using (true) with check (true);

create policy "authenticated users can read applications" on applications for select to authenticated using (true);
create policy "authenticated users can create applications" on applications for insert to authenticated with check (true);
create policy "authenticated users can update applications" on applications for update to authenticated using (true) with check (true);

create policy "authenticated users can read environments" on environments for select to authenticated using (true);
create policy "authenticated users can create environments" on environments for insert to authenticated with check (true);

create policy "authenticated users can read pipelines" on pipelines for select to authenticated using (true);
create policy "authenticated users can create pipelines" on pipelines for insert to authenticated with check (true);
create policy "authenticated users can update pipelines" on pipelines for update to authenticated using (true) with check (true);

create policy "authenticated users can read pipeline runs" on pipeline_runs for select to authenticated using (true);
create policy "authenticated users can create pipeline runs" on pipeline_runs for insert to authenticated with check (true);
create policy "authenticated users can update pipeline runs" on pipeline_runs for update to authenticated using (true) with check (true);

create policy "authenticated users can read pipeline tasks" on pipeline_tasks for select to authenticated using (true);
create policy "authenticated users can create pipeline tasks" on pipeline_tasks for insert to authenticated with check (true);
create policy "authenticated users can update pipeline tasks" on pipeline_tasks for update to authenticated using (true) with check (true);
