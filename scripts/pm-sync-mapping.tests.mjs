import assert from "node:assert/strict";
import { normalizeSourceTask } from "../supabase/functions/pm-sync/task-mapping.ts";

const current = normalizeSourceTask({
  taskId: "task-current", title: "Current PM task", project: "Cayde", owner: "developer", scope: "personal",
  primary: "DONE", secondary: "ABANDONED", stage: "Stopped by operator", progress: 42,
  blockers: [{ code: "OPERATOR_STOP" }], activeSubagent: "reviewer",
  milestones: [{ id: "design", name: "Design", completed: true }],
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z",
});
assert.equal(current.sourceTaskId, "task-current");
assert.equal(current.row.status, "done");
assert.equal(current.row.source_status, "DONE - ABANDONED");
assert.equal(current.row.source_lead, "Development Lead");
assert.equal(current.row.source_stage, "Stopped by operator");
assert.equal(current.row.source_completion_percent, 42);
assert.deepEqual(current.row.source_active_specialists, ["reviewer"]);
assert.deepEqual(current.row.source_completed_stages, ["Design"]);
assert.equal(current.row.source_blocker, "OPERATOR_STOP");

const legacy = normalizeSourceTask({ id: "legacy", title: "Legacy", project: "Legacy", status: "COMPLETE", ownerAgent: "main", currentStage: "Done", completionPercent: 100 });
assert.equal(legacy.row.source_status, "DONE");
assert.equal(legacy.row.status, "done");
assert.equal(normalizeSourceTask({ taskId: "missing-title" }), null);
console.log("pm-sync-mapping.tests.mjs passed");
