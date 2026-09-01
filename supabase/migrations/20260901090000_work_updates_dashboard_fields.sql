alter table public.tasks
  add column if not exists source_status text,
  add column if not exists source_scope text,
  add column if not exists source_team text,
  add column if not exists source_lead text,
  add column if not exists source_stage text,
  add column if not exists source_completion_percent integer,
  add column if not exists source_active_specialists jsonb not null default '[]'::jsonb,
  add column if not exists source_completed_stages jsonb not null default '[]'::jsonb,
  add column if not exists source_blocker text,
  add column if not exists source_waiting_for text,
  add column if not exists source_reference text,
  add column if not exists source_created_at timestamptz,
  add column if not exists source_updated_at timestamptz;

create index if not exists tasks_project_source_updated_idx
  on public.tasks(project_id, source_updated_at desc);
