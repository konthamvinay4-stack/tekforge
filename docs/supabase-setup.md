# Supabase setup

TekForge uses Supabase Postgres as the control-plane database. The application uses the Supabase JS/SSR clients; Kubernetes and Tekton remain the execution layer.

## 1. Create a Supabase project

Create a project in Supabase and copy its Project URL and publishable/anon key.

## 2. Configure local environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not commit `.env.local` or service-role keys.

## 3. Apply the schema

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor or through the Supabase CLI migration workflow.

Optionally run `supabase/seed.sql` for a demo project and DEV/QA/PROD environments.

## 4. Security model

The initial schema enables Row Level Security and allows authenticated users to work with the MVP records. Before production multi-tenancy, replace these broad policies with organization/member-scoped policies.

## 5. Data flow

Browser → Next.js Route Handler → Supabase → persisted project/application/pipeline/run state.

For live execution, the next layer will be:

Next.js API → Kubernetes API → Tekton PipelineRun → TaskRuns → Supabase status synchronization → UI.
