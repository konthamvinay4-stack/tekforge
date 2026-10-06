-- Allow the agent to validate external integrations using credentials that remain in the customer cluster.
alter table public.agent_commands
  drop constraint if exists agent_commands_type_check;

alter table public.agent_commands
  add constraint agent_commands_type_check
  check (type in (
    'apply-tekton',
    'pipeline-run',
    'cancel-run',
    'apply-pipeline',
    'create-pipelinerun',
    'get-pipelinerun',
    'test-integration'
  ));
