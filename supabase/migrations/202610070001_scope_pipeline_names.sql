-- Keep persisted Tekton names aligned with their application-owned pipeline names.
-- This prevents legacy applications from sharing the generic "node-ci" name.
update public.pipelines
set tekton_pipeline_name = lower(
  trim(both '-' from regexp_replace(
    regexp_replace(coalesce(name, 'pipeline'), '[^a-zA-Z0-9-]+', '-', 'g'),
    '-+',
    '-',
    'g'
  ))
)
where tekton_pipeline_name = 'node-ci'
  and coalesce(name, '') <> 'node-ci';

-- Application + pipeline name is the logical uniqueness boundary in the control plane.
create unique index if not exists pipelines_application_name_uidx
  on public.pipelines(application_id, name);
