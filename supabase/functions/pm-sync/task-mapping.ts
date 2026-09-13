const statusMap: Record<string, string> = {
  TODO: "up_next",
  QUEUED: "up_next",
  "IN PROGRESS": "in_progress",
  "WAITING FOR HUMAN": "in_review",
  STALLED: "in_review",
  BLOCKED: "in_review",
  DONE: "done",
  "DONE - ABANDONED": "done",
  COMPLETE: "done",
};

const priorityMap: Record<string, string> = {
  low: "low", normal: "medium", medium: "medium", high: "high", urgent: "urgent",
};

const text = (value: unknown) => String(value ?? "").trim();
const arrayOrEmpty = (value: unknown) => Array.isArray(value) ? value : [];
const isoOrNull = (value: unknown) => {
  const candidate = text(value);
  if (!candidate) return null;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const completion = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
};
const slugify = (value: string) => value.toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "project";
const sourceStatusFor = (task: Record<string, unknown>) => {
  const explicit = text(task.status).toUpperCase();
  if (explicit) return explicit === "COMPLETE" ? "DONE" : explicit;
  const primary = text(task.primary).toUpperCase();
  const secondary = text(task.secondary).toUpperCase();
  return primary === "DONE" && secondary === "ABANDONED" ? "DONE - ABANDONED" : (primary || "TODO");
};
const leadFor = (task: Record<string, unknown>) => {
  const explicit = text(task.lead);
  if (explicit) return explicit;
  const team = text(task.executingTeam || task.team || task.ownerAgent || task.owner);
  const key = team.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const known: Record<string, string> = {
    cayde: "Cayde / PA Lead", main: "Cayde / PA Lead", pa: "PA Lead",
    development: "Development Lead", developer: "Development Lead",
    business: "Business Lead", businesslead: "Business Lead",
    marketing: "Marketing Lead", marketinglead: "Marketing Lead",
    markets: "Markets Lead", marketslead: "Markets Lead",
    sports: "Sports Lead", sportsmanager: "Sports Lead",
    game: "Game Lead", gaming: "Game Lead", areamonitor: "Area Monitor", helpdesk: "Help Desk",
  };
  return known[key] ?? (team ? `${team} Lead` : "Unassigned");
};
const labels = (value: unknown) => arrayOrEmpty(value).map((item) => {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  return text(record.name || record.id || record.code || record.message || record.reason);
}).filter(Boolean);

export function normalizeSourceTask(task: Record<string, unknown>) {
  const sourceTaskId = text(task.id || task.taskId);
  const title = text(task.title);
  if (!sourceTaskId || !title) return null;
  const projectName = text(task.project) || "Unassigned";
  const sourceStatus = sourceStatusFor(task);
  const sourceUpdatedAt = isoOrNull(task.lastUpdate || task.updatedAt || task.lastActivityAt || task.createdAt);
  const sourceCreatedAt = isoOrNull(task.createdAt);
  const stage = text(task.currentStage || task.stage);
  const blockers = text(task.blocker) || labels(task.blockers).join("; ");
  const waitingFor = text(task.waitingFor);
  const sourceDescription = text(task.description);
  const contextDescription = [stage ? `Stage: ${stage}` : "", blockers ? `Blocker: ${blockers}` : "", waitingFor ? `Waiting for: ${waitingFor}` : ""].filter(Boolean).join("\n");
  const explicitCompleted = labels(task.completedStages);
  const completedStages = explicitCompleted.length ? explicitCompleted : arrayOrEmpty(task.milestones).filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).completed === true).map((item) => text((item as Record<string, unknown>).name || (item as Record<string, unknown>).id)).filter(Boolean);
  const explicitSpecialists = labels(task.activeSpecialists);
  const activeSpecialists = explicitSpecialists.length ? explicitSpecialists : (text(task.activeSubagent) ? [text(task.activeSubagent)] : []);
  return {
    sourceTaskId,
    projectName,
    sourceKey: slugify(projectName),
    row: {
      title,
      description: sourceDescription || contextDescription || null,
      status: statusMap[sourceStatus] ?? "backlog",
      priority: priorityMap[text(task.priority).toLowerCase() || "normal"] ?? "medium",
      assignee: text(task.ownerAgent || task.owner) || null,
      due_date: text(task.dueAt) ? text(task.dueAt).slice(0, 10) : null,
      updated_at: sourceUpdatedAt || undefined,
      source_status: sourceStatus,
      source_scope: text(task.scope) || null,
      source_team: text(task.executingTeam || task.team || task.owner) || null,
      source_lead: leadFor(task),
      source_stage: stage || null,
      source_completion_percent: completion(task.estimatedCompletionPercent ?? task.completionPercent ?? task.taskEstCompletion ?? task.progress),
      source_active_specialists: activeSpecialists,
      source_completed_stages: completedStages,
      source_blocker: blockers || null,
      source_waiting_for: waitingFor || null,
      source_reference: text(task.reference) || null,
      source_created_at: sourceCreatedAt,
      source_updated_at: sourceUpdatedAt,
    },
  };
}
