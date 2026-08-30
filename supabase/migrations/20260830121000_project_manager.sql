create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('planning', 'active', 'paused', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'backlog' check (status in ('backlog', 'up_next', 'in_progress', 'in_review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee text,
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists milestones_project_position_idx on public.milestones(project_id, position);
create index if not exists tasks_project_status_position_idx on public.tasks(project_id, status, position);
create index if not exists task_notes_task_created_idx on public.task_notes(task_id, created_at desc);
create index if not exists activity_project_created_idx on public.activity_events(project_id, created_at desc);

alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_notes enable row level security;
alter table public.activity_events enable row level security;

create or replace function public.owns_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = project_uuid and owner_id = (select auth.uid())
  );
$$;

create policy "owners manage projects" on public.projects
  for all using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owners manage milestones" on public.milestones
  for all using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy "owners manage tasks" on public.tasks
  for all using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy "owners manage notes" on public.task_notes
  for all using (author_id = (select auth.uid()) or exists (
    select 1 from public.tasks where tasks.id = task_notes.task_id and public.owns_project(tasks.project_id)
  ))
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.tasks where tasks.id = task_notes.task_id and public.owns_project(tasks.project_id)
  ));

create policy "owners manage activity" on public.activity_events
  for all using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

insert into storage.buckets (id, name, public)
values ('project-notes', 'project-notes', false)
on conflict (id) do update set public = excluded.public;

create policy "authenticated users read own project files" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-notes' and owner_id = (select auth.uid())::text);

create policy "authenticated users upload own project files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-notes' and owner_id = (select auth.uid())::text);

create policy "authenticated users update own project files" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-notes' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'project-notes' and owner_id = (select auth.uid())::text);

create policy "authenticated users delete own project files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-notes' and owner_id = (select auth.uid())::text);
