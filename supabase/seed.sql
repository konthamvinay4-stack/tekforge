insert into projects (name, description)
values ('Demo Commerce', 'Example project for the TekForge onboarding flow')
on conflict do nothing;

insert into environments (project_id, name, namespace, protected)
select id, 'DEV', 'demo-dev', false from projects where name = 'Demo Commerce'
on conflict do nothing;

insert into environments (project_id, name, namespace, protected)
select id, 'QA', 'demo-qa', false from projects where name = 'Demo Commerce'
on conflict do nothing;

insert into environments (project_id, name, namespace, protected)
select id, 'PROD', 'demo-prod', true from projects where name = 'Demo Commerce'
on conflict do nothing;
