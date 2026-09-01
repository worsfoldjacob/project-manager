drop index if exists public.projects_owner_source_key_idx;
drop index if exists public.tasks_project_source_task_id_idx;

create unique index projects_owner_source_key_idx
  on public.projects(owner_id, source_key);

create unique index tasks_project_source_task_id_idx
  on public.tasks(project_id, source_task_id);
