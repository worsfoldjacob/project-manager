alter table public.projects add column if not exists source_key text;
alter table public.tasks add column if not exists source_task_id text;

create unique index if not exists projects_owner_source_key_idx
  on public.projects(owner_id, source_key)
  where source_key is not null;

create unique index if not exists tasks_project_source_task_id_idx
  on public.tasks(project_id, source_task_id)
  where source_task_id is not null;
