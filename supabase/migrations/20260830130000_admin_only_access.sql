create or replace function public.is_project_manager_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') = 'cayde-pm@pm.w-software.net', false);
$$;

drop policy if exists "owners manage projects" on public.projects;
create policy "admin manages projects" on public.projects
  for all using (public.is_project_manager_admin() and owner_id = (select auth.uid()))
  with check (public.is_project_manager_admin() and owner_id = (select auth.uid()));

drop policy if exists "owners manage milestones" on public.milestones;
create policy "admin manages milestones" on public.milestones
  for all using (public.is_project_manager_admin() and public.owns_project(project_id))
  with check (public.is_project_manager_admin() and public.owns_project(project_id));

drop policy if exists "owners manage tasks" on public.tasks;
create policy "admin manages tasks" on public.tasks
  for all using (public.is_project_manager_admin() and public.owns_project(project_id))
  with check (public.is_project_manager_admin() and public.owns_project(project_id));

drop policy if exists "owners manage notes" on public.task_notes;
create policy "admin manages notes" on public.task_notes
  for all using (public.is_project_manager_admin() and (author_id = (select auth.uid()) or exists (
    select 1 from public.tasks where tasks.id = task_notes.task_id and public.owns_project(tasks.project_id)
  )))
  with check (public.is_project_manager_admin() and author_id = (select auth.uid()) and exists (
    select 1 from public.tasks where tasks.id = task_notes.task_id and public.owns_project(tasks.project_id)
  ));

drop policy if exists "owners manage activity" on public.activity_events;
create policy "admin manages activity" on public.activity_events
  for all using (public.is_project_manager_admin() and public.owns_project(project_id))
  with check (public.is_project_manager_admin() and public.owns_project(project_id));

drop policy if exists "authenticated users read own project files" on storage.objects;
create policy "admin reads project files" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-notes' and public.is_project_manager_admin() and owner_id = (select auth.uid())::text);

drop policy if exists "authenticated users upload own project files" on storage.objects;
create policy "admin uploads project files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-notes' and public.is_project_manager_admin() and owner_id = (select auth.uid())::text);

drop policy if exists "authenticated users update own project files" on storage.objects;
create policy "admin updates project files" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-notes' and public.is_project_manager_admin() and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'project-notes' and public.is_project_manager_admin() and owner_id = (select auth.uid())::text);

drop policy if exists "authenticated users delete own project files" on storage.objects;
create policy "admin deletes project files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-notes' and public.is_project_manager_admin() and owner_id = (select auth.uid())::text);
