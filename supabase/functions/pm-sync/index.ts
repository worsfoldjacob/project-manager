import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSourceTask } from "./task-mapping.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://pm.w-software.net",
  "Access-Control-Allow-Headers": "authorization, content-type, x-pm-sync-token",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("PM_SYNC_TOKEN");
  const supplied = request.headers.get("x-pm-sync-token");
  if (!expected || !supplied || supplied !== expected) return json({ error: "unauthorized" }, 401);

  const ownerId = Deno.env.get("PM_OWNER_USER_ID");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!ownerId || !url || !serviceKey) return json({ error: "server_not_configured" }, 500);

  let body: { tasks?: Array<Record<string, unknown>> };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!Array.isArray(body.tasks)) return json({ error: "tasks_array_required" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const projects = new Map<string, string>();
  let synced = 0;

  for (const task of body.tasks) {
    const normalized = normalizeSourceTask(task);
    if (!normalized) continue;
    const { sourceTaskId, projectName, sourceKey, row } = normalized;
    let projectId = projects.get(sourceKey);
    if (!projectId) {
      const { data: existing, error: findError } = await db.from("projects")
        .select("id").eq("owner_id", ownerId).eq("source_key", sourceKey).maybeSingle();
      if (findError) return json({ error: "project_lookup_failed" }, 500);
      if (existing?.id) projectId = existing.id;
      else {
        const { data: created, error } = await db.from("projects").insert({
          owner_id: ownerId, name: projectName, slug: sourceKey,
          description: "Synced from OpenClaw Project Manager", source_key: sourceKey,
        }).select("id").single();
        if (error) return json({ error: "project_create_failed" }, 500);
        projectId = created.id;
      }
      projects.set(sourceKey, projectId);
    }

    const { error } = await db.from("tasks").upsert({
      project_id: projectId,
      source_task_id: sourceTaskId,
      ...row,
    }, { onConflict: "project_id,source_task_id" });
    if (error) return json({ error: "task_upsert_failed" }, 500);
    synced++;
  }
  return json({ synced, projects: projects.size });
});
