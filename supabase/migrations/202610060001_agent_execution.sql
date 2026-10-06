alter table public.pipeline_runs
  add column if not exists cluster_id uuid references public.agent_clusters(id) on delete set null;

drop constraint if exists agent_commands_type_check;
alter table public.agent_commands
  drop constraint if exists agent_commands_type_check;

alter table public.agent_commands
  add constraint agent_commands_type_check
  check (type in ('apply-tekton','pipeline-run','cancel-run','apply-pipeline','create-pipelinerun','get-pipelinerun'));

create index if not exists pipeline_runs_cluster_idx on public.pipeline_runs(cluster_id, created_at desc);
