import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://pm.w-software.net",
  "Access-Control-Allow-Headers": "authorization, content-type, x-pm-sync-token",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const slugify = (value: string) => value.toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "project";

const statusMap: Record<string, string> = {
  TODO: "up_next",
  QUEUED: "up_next",
  "IN PROGRESS": "in_progress",
  "WAITING FOR HUMAN": "in_review",
  STALLED: "in_review",
  BLOCKED: "in_review",
  DONE: "done",
};

const priorityMap: Record<string, string> = {
  low: "low", normal: "medium", medium: "medium", high: "high", urgent: "urgent",
};

const text = (value: unknown) => String(value ?? "").trim();
const isoOrNull = (value: unknown) => {
  const candidate = text(value);
  if (!candidate) return null;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const arrayOrEmpty = (value: unknown) => Array.isArray(value) ? value : [];
const completion = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
};
const leadFor = (task: Record<string, unknown>) => {
  const explicit = text(task.lead);
  if (explicit) return explicit;
  const team = text(task.executingTeam || task.team || task.ownerAgent);
  const key = team.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const known: Record<string, string> = {
    cayde: "Cayde / PA Lead", pa: "PA Lead", development: "Development Lead",
    business: "Business Lead", marketing: "Marketing Lead", markets: "Markets Lead",
    sports: "Sports Lead", game: "Game Lead",
  };
  return known[key] ?? (team ? `${team} Lead` : "Unassigned");
};

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
    const sourceTaskId = String(task.id ?? "").trim();
    const projectName = String(task.project ?? "Unassigned").trim() || "Unassigned";
    if (!sourceTaskId || !String(task.title ?? "").trim()) continue;
    const sourceStatus = text(task.status).toUpperCase() || "TODO";
    const sourceUpdatedAt = isoOrNull(task.lastUpdate || task.updatedAt || task.lastActivityAt || task.createdAt);
    const sourceCreatedAt = isoOrNull(task.createdAt);
    const sourceDescription = text(task.description);
    const contextDescription = [
      text(task.currentStage) ? `Stage: ${text(task.currentStage)}` : "",
      text(task.blocker) ? `Blocker: ${text(task.blocker)}` : "",
      text(task.waitingFor) ? `Waiting for: ${text(task.waitingFor)}` : "",
    ].filter(Boolean).join("\n");
    const sourceKey = slugify(projectName);
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
      title: String(task.title),
      description: sourceDescription || contextDescription || null,
      status: statusMap[sourceStatus] ?? "backlog",
      priority: priorityMap[text(task.priority).toLowerCase() || "normal"] ?? "medium",
      assignee: text(task.ownerAgent) || null,
      due_date: text(task.dueAt) ? text(task.dueAt).slice(0, 10) : null,
      updated_at: sourceUpdatedAt || undefined,
      source_status: sourceStatus,
      source_scope: text(task.scope) || null,
      source_team: text(task.executingTeam || task.team) || null,
      source_lead: leadFor(task),
      source_stage: text(task.currentStage) || null,
      source_completion_percent: completion(task.estimatedCompletionPercent ?? task.completionPercent ?? task.taskEstCompletion),
      source_active_specialists: arrayOrEmpty(task.activeSpecialists),
      source_completed_stages: arrayOrEmpty(task.completedStages),
      source_blocker: text(task.blocker) || null,
      source_waiting_for: text(task.waitingFor) || null,
      source_reference: text(task.reference) || null,
      source_created_at: sourceCreatedAt,
      source_updated_at: sourceUpdatedAt,
    }, { onConflict: "project_id,source_task_id" });
    if (error) return json({ error: "task_upsert_failed" }, 500);
    synced++;
  }
  return json({ synced, projects: projects.size });
});
