(() => {
  "use strict";

  const config = window.PROJECT_MANAGER_SUPABASE || {};
  const gate = document.querySelector("#gate");
  const app = document.querySelector("#app");
  const authForm = document.querySelector("#auth-form");
  const authUsername = document.querySelector("#username");
  const authPassword = document.querySelector("#password");
  const authSubmit = document.querySelector("#auth-submit");
  const authError = document.querySelector("#gate-error");
  const toast = document.querySelector("#toast");
  const projectSelect = document.querySelector("#project-select");
  const taskColumns = document.querySelector("#task-columns");
  const milestones = document.querySelector("#milestone-list");
  const activity = document.querySelector("#activity-list");
  const notes = document.querySelector("#notes-list");
  const taskCount = document.querySelector("#task-count");
  const projectName = document.querySelector("#project-name");
  const projectDescription = document.querySelector("#project-description");
  const userAvatar = document.querySelector("#user-avatar");
  const dateFilter = document.querySelector("#date-filter");
  const syncStatus = document.querySelector("#sync-status");
  const detailsDialog = document.querySelector("#task-details-dialog");
  const detailsTitle = document.querySelector("#task-details-title");
  const detailsContent = document.querySelector("#task-details-content");
  const detailsAddNote = document.querySelector("#task-details-add-note");
  const dialog = document.querySelector("#editor-dialog");
  const dialogTitle = document.querySelector("#editor-title");
  const dialogFields = document.querySelector("#editor-fields");
  let client;
  let session;
  let currentProject;
  let currentTasks = [];
  let currentActivity = [];
  let refreshTimer;
  let toastTimer;
  const ALL_PROJECTS_ID = "__all__";

  const columns = [
    ["up_next", "Up next"], ["in_progress", "In progress"], ["in_review", "In review"], ["done", "Done"]
  ];
  const statusSectionMap = {
    TODO: "up_next", QUEUED: "up_next", "IN PROGRESS": "in_progress",
    "WAITING FOR HUMAN": "in_review", STALLED: "in_review", BLOCKED: "in_review", DONE: "done",
    backlog: "up_next", up_next: "up_next", in_progress: "in_progress", in_review: "in_review", done: "done"
  };
  const statusLabels = { TODO: "TODO", QUEUED: "QUEUED", "IN PROGRESS": "IN PROGRESS", "WAITING FOR HUMAN": "WAITING FOR HUMAN", STALLED: "STALLED", BLOCKED: "BLOCKED", DONE: "DONE" };
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const notify = message => { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3000); };
  const showAuthError = message => { authError.textContent = message || ""; };
  const openApp = () => { gate.hidden = true; app.hidden = false; app.style.display = "flex"; };
  const lock = () => { app.hidden = true; app.style.display = "none"; gate.hidden = false; authUsername.focus(); };
  const initials = value => (value || "PM").split(/[.@\s_-]+/).filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "PM";
  const dateText = value => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)) : "No date";
  const timeText = value => value ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round((new Date(value) - new Date()) / 3600000), "hour") : "Just now";
  const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `project-${Date.now()}`;
  const taskStatus = task => {
    if (task.source_status) return String(task.source_status).toUpperCase();
    return ({ backlog: "TODO", up_next: "TODO", in_progress: "IN PROGRESS", in_review: "WAITING FOR HUMAN", done: "DONE" })[task.status] || String(task.status || "TODO").toUpperCase();
  };
  const taskTimestamp = task => task.source_updated_at || task.updated_at || task.created_at;
  const statusSection = task => statusSectionMap[taskStatus(task)] || statusSectionMap[task.status] || "up_next";
  const statusClass = status => `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const dateFilterStart = filter => {
    if (filter === "all") return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (filter === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    } else if (filter === "month") start.setDate(1);
    else if (filter === "year") { start.setMonth(0); start.setDate(1); }
    return start;
  };
  const matchesDateFilter = (item, filter = dateFilter?.value || "all") => {
    const start = dateFilterStart(filter);
    return !start || (item && taskTimestamp(item) && new Date(taskTimestamp(item)) >= start);
  };

  function setupClient() {
    if (!config.url || !config.anonKey || /replace-with|your-/i.test(config.anonKey)) {
      showAuthError("This workspace is not configured for sign-in. Contact the workspace owner.");
      authSubmit.disabled = true;
      return false;
    }
    if (!window.supabase?.createClient) {
      showAuthError("The authentication library could not be loaded. Check your connection and try again.");
      return false;
    }
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    client.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession;
      if (nextSession) {
        openApp();
        loadProjects();
        clearInterval(refreshTimer);
        refreshTimer = setInterval(() => loadProjectData(true), 30000);
      } else if (event === "SIGNED_OUT") {
        clearInterval(refreshTimer);
        lock();
      }
    });
    return true;
  }

  async function restoreSession() {
    if (!client) return;
    const { data, error } = await client.auth.getSession();
    if (error) showAuthError(error.message);
    session = data.session;
    if (session) { openApp(); await loadProjects(); } else authUsername.focus();
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!client) {
      showAuthError("Authentication is still loading. Refresh the page and try again.");
      return;
    }
    const username = authUsername.value.trim();
    const password = authPassword.value;
    authSubmit.disabled = true;
    authSubmit.dataset.label = authSubmit.innerHTML;
    authSubmit.innerHTML = "Signing in…";
    showAuthError("");
    if (username.toLowerCase() !== "cayde-pm") {
      authSubmit.disabled = false;
      authSubmit.innerHTML = authSubmit.dataset.label;
      showAuthError("Invalid username or password.");
      return;
    }
    try {
      const result = await Promise.race([
        client.auth.signInWithPassword({ email: "cayde-pm@pm.w-software.net", password }),
        new Promise(resolve => setTimeout(() => resolve({ error: new Error("Authentication request timed out. Check your connection and try again.") }), 10000))
      ]);
      if (result.error) { showAuthError(result.error.message); return; }
      session = result.data.session;
      openApp();
      await loadProjects();
    } catch (error) {
      showAuthError(`Could not reach the authentication service. ${error?.message || "Please try again."}`);
    } finally {
      authSubmit.disabled = false;
      authSubmit.innerHTML = authSubmit.dataset.label;
    }
  }

  async function loadProjects() {
    const { data, error } = await client.from("projects").select("*").order("updated_at", { ascending: false });
    if (error) { notify(`Could not load projects: ${error.message}`); return; }
    projectSelect.innerHTML = "";
    if (!data.length) {
      currentProject = null;
      renderEmpty();
      projectSelect.innerHTML = '<option value="">No projects yet</option>';
      return;
    }
    projectSelect.insertAdjacentHTML("beforeend", `<option value="${ALL_PROJECTS_ID}">ALL</option>`);
    data.forEach(project => projectSelect.insertAdjacentHTML("beforeend", `<option value="${project.id}">${escapeHtml(project.name)}</option>`));
    currentProject = { id: ALL_PROJECTS_ID, name: "ALL", description: "All projects and work in one view." };
    projectSelect.value = currentProject.id;
    await loadProjectData();
  }

  async function loadProjectData(silent = false) {
    if (!currentProject) return renderEmpty();
    const allProjects = currentProject.id === ALL_PROJECTS_ID;
    projectName.textContent = currentProject.name;
    projectDescription.textContent = allProjects ? "All projects and work in one view." : currentProject.description || "Keep your work clear, organized, and moving forward.";
    userAvatar.textContent = initials(session?.user?.email);
    const [tasksResult, milestonesResult, activityResult] = await Promise.all([
      allProjects ? client.from("tasks").select("*").order("position").order("created_at") : client.from("tasks").select("*").eq("project_id", currentProject.id).order("position").order("created_at"),
      allProjects ? client.from("milestones").select("*").order("position").order("due_date") : client.from("milestones").select("*").eq("project_id", currentProject.id).order("position").order("due_date"),
      allProjects ? client.from("activity_events").select("*").order("created_at", { ascending: false }).limit(12) : client.from("activity_events").select("*").eq("project_id", currentProject.id).order("created_at", { ascending: false }).limit(12)
    ]);
    const failure = [tasksResult, milestonesResult, activityResult].find(result => result.error);
    if (failure) { if (!silent) notify(`Could not load workspace: ${failure.error.message}`); return; }
    currentTasks = tasksResult.data || [];
    currentActivity = activityResult.data || [];
    if (syncStatus) syncStatus.textContent = `Last synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    renderTasksV2(currentTasks);
    renderMilestones(milestonesResult.data);
    renderActivityV2(currentActivity);
    await loadNotes(currentTasks.filter(task => matchesDateFilter(task)));
  }

  function renderEmpty() {
    projectName.textContent = "Your projects";
    projectDescription.textContent = "Create a project to start organizing work.";
    taskColumns.innerHTML = '<p class="empty-state">No tasks yet.</p>';
    milestones.innerHTML = '<li class="empty-state">No milestones yet.</li>';
    activity.innerHTML = '<p class="empty-state">No activity yet.</p>';
    notes.innerHTML = "";
    taskCount.textContent = "0";
    if (syncStatus) syncStatus.textContent = "Waiting for data";
  }

  function renderTasks(tasks) {
    taskCount.textContent = String(tasks.length);
    taskColumns.innerHTML = columns.map(([status, label]) => {
      const items = tasks.filter(task => task.status === status);
      return `<div class="board-column"><div class="column-title"><h3>${label} <span>${items.length}</span></h3><button type="button" class="add-task" data-status="${status}" aria-label="Add ${label} task">+</button></div>${items.map(task => `<article class="task-card" data-task-id="${task.id}"><div><span class="tag ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span><button class="dots task-note" type="button" data-task-id="${task.id}" aria-label="Add note">•••</button></div><h4>${escapeHtml(task.title)}</h4>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}<footer><span class="mini-avatar a1">${escapeHtml(initials(task.assignee || session?.user?.email))}</span><span>${dateText(task.due_date)}</span><b>${escapeHtml(task.assignee || "Unassigned")}</b></footer></article>`).join("") || '<p class="empty-state">Nothing here.</p>'}</div>`;
    }).join("");
  }

  function renderMilestones(items) {
    milestones.innerHTML = items.map((item, index) => `<li class="${item.due_date && new Date(`${item.due_date}T23:59:59`) < new Date() ? "completed" : index === 0 ? "current" : ""}"><span>${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || dateText(item.due_date))}</small></div><b>${dateText(item.due_date)}</b></li>`).join("") || '<li class="empty-state">No milestones yet.</li>';
  }

  function renderTasksV2(tasks) {
    const visibleTasks = tasks.filter(task => matchesDateFilter(task));
    taskCount.textContent = String(visibleTasks.length);
    taskColumns.innerHTML = columns.map(([section, label]) => {
      const items = visibleTasks.filter(task => statusSection(task) === section);
      return `<div class="board-column"><div class="column-title"><h3>${label} <span>${items.length}</span></h3><button type="button" class="add-task" data-status="${section}" aria-label="Add ${label} task">+</button></div>${items.map(task => {
        const rawStatus = taskStatus(task);
        const lead = task.source_lead || task.assignee || "Unassigned";
        const completionPercent = task.source_completion_percent ?? (rawStatus === "DONE" ? 100 : null);
        return `<article class="task-card" data-task-id="${escapeHtml(task.id)}"><div class="task-card-top"><span class="status-pill ${statusClass(rawStatus)}">${escapeHtml(statusLabels[rawStatus] || rawStatus)}</span><button class="dots task-details" type="button" data-task-id="${escapeHtml(task.id)}" aria-label="Show task details">...</button></div><h4>${escapeHtml(task.title)}</h4><dl class="work-update-fields"><div><dt>Lead</dt><dd>${escapeHtml(lead)}</dd></div><div><dt>Stage</dt><dd>${escapeHtml(task.source_stage || "Not set")}</dd></div>${completionPercent !== null ? `<div><dt>Task est completion</dt><dd>${escapeHtml(completionPercent)}%</dd></div>` : ""}</dl>${completionPercent !== null ? `<div class="task-progress" aria-label="${escapeHtml(completionPercent)} percent complete"><span style="width:${Math.max(0, Math.min(100, Number(completionPercent) || 0))}%"></span></div>` : ""}<footer><span class="mini-avatar a1">${escapeHtml(initials(lead))}</span><span>${dateText(task.due_date)}</span><b>${escapeHtml(task.assignee || "Unassigned")}</b></footer></article>`;
      }).join("") || '<p class="empty-state">Nothing here.</p>'}</div>`;
    }).join("");
  }

  function renderActivity(items) {
    activity.innerHTML = items.map(item => `<div class="activity-item"><span class="mini-avatar a2">${escapeHtml(initials(session?.user?.email))}</span><p>${escapeHtml(item.message)}<small>${timeText(item.created_at)}</small></p></div>`).join("") || '<p class="empty-state">No activity yet.</p>';
  }

  function renderActivityV2(items) {
    const visibleItems = items.filter(item => matchesDateFilter({ source_updated_at: item.created_at }));
    activity.innerHTML = visibleItems.map(item => `<div class="activity-item"><span class="mini-avatar a2">${escapeHtml(initials(session?.user?.email))}</span><p>${escapeHtml(item.message)}<small>${timeText(item.created_at)}</small></p></div>`).join("") || '<p class="empty-state">No activity yet.</p>';
  }

  const listText = value => Array.isArray(value) && value.length ? value.join(", ") : "Not recorded";
  function openTaskDetails(taskId) {
    const task = currentTasks.find(item => item.id === taskId);
    if (!task || !detailsDialog) return;
    const rawStatus = taskStatus(task);
    detailsTitle.textContent = task.title;
    detailsContent.innerHTML = `<div class="details-status"><span class="status-pill ${statusClass(rawStatus)}">${escapeHtml(statusLabels[rawStatus] || rawStatus)}</span><span>${escapeHtml(columns.find(([key]) => key === statusSection(task))?.[1] || "Up next")}</span></div><dl class="details-grid"><div><dt>Lead</dt><dd>${escapeHtml(task.source_lead || task.assignee || "Unassigned")}</dd></div><div><dt>Stage</dt><dd>${escapeHtml(task.source_stage || "Not set")}</dd></div><div><dt>Task est completion</dt><dd>${escapeHtml(task.source_completion_percent ?? (rawStatus === "DONE" ? 100 : "Not set"))}${task.source_completion_percent !== null && task.source_completion_percent !== undefined || rawStatus === "DONE" ? "%" : ""}</dd></div><div><dt>Priority</dt><dd>${escapeHtml(task.priority || "Not set")}</dd></div><div><dt>Scope / team</dt><dd>${escapeHtml([task.source_scope, task.source_team].filter(Boolean).join(" / ") || "Not recorded")}</dd></div><div><dt>Due</dt><dd>${escapeHtml(dateText(task.due_date))}</dd></div></dl><div class="details-copy"><h3>Description</h3><p>${escapeHtml(task.description || "No description recorded.")}</p></div><dl class="details-list"><div><dt>Blocker</dt><dd>${escapeHtml(task.source_blocker || "None")}</dd></div><div><dt>Waiting for</dt><dd>${escapeHtml(task.source_waiting_for || "None")}</dd></div><div><dt>Active specialists</dt><dd>${escapeHtml(listText(task.source_active_specialists))}</dd></div><div><dt>Completed stages</dt><dd>${escapeHtml(listText(task.source_completed_stages))}</dd></div><div><dt>Reference</dt><dd>${escapeHtml(task.source_reference || "None")}</dd></div><div><dt>Last work update</dt><dd>${escapeHtml(taskTimestamp(task) ? new Date(taskTimestamp(task)).toLocaleString() : "Not recorded")}</dd></div></dl>`;
    detailsAddNote.dataset.taskId = taskId;
    detailsDialog.showModal();
  }

  async function loadNotes(tasks) {
    if (!tasks.length) { notes.innerHTML = ""; return; }
    const ids = tasks.map(task => task.id);
    const { data, error } = await client.from("task_notes").select("*, tasks!inner(title, project_id)").in("task_id", ids).order("created_at", { ascending: false }).limit(5);
    if (error) { notes.innerHTML = ""; return; }
    notes.innerHTML = data.map(note => `<blockquote>${escapeHtml(note.body)}<cite>— ${escapeHtml(note.tasks.title)}</cite></blockquote>`).join("");
  }

  function openEditor(kind, defaults = {}) {
    const forms = {
      project: `<label>Name<input name="name" required value="${escapeHtml(defaults.name || "")}"></label><label>Description<textarea name="description">${escapeHtml(defaults.description || "")}</textarea></label>`,
      task: `<input type="hidden" name="status" value="${escapeHtml(defaults.status || "up_next")}"><label>Title<input name="title" required></label><label>Description<textarea name="description"></textarea></label><label>Priority<select name="priority"><option>medium</option><option>low</option><option>high</option><option>urgent</option></select></label><label>Due date<input name="due_date" type="date"></label><label>Assignee<input name="assignee" placeholder="Name or initials"></label>`,
      milestone: `<label>Name<input name="name" required></label><label>Description<input name="description"></label><label>Due date<input name="due_date" type="date"></label>`,
      note: `<input type="hidden" name="task_id" value="${escapeHtml(defaults.taskId)}"><label>Note<textarea name="body" required></textarea></label>`
    };
    dialogTitle.textContent = `New ${kind}`;
    dialogFields.innerHTML = forms[kind];
    dialog.dataset.kind = kind;
    dialog.showModal();
    dialog.querySelector("input:not([type=hidden]), textarea, select")?.focus();
  }

  async function saveEditor(event) {
    event.preventDefault();
    const kind = dialog.dataset.kind;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    let error;
    if (kind === "project") {
      const { error: requestError } = await client.from("projects").insert({ owner_id: session.user.id, name: values.name, slug: slugify(values.name), description: values.description || null });
      error = requestError;
    } else if (!currentProject) { error = new Error("Create a project first."); }
    else if (kind === "task") {
      const { count } = await client.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", currentProject.id);
      const { error: requestError } = await client.from("tasks").insert({ ...values, project_id: currentProject.id, due_date: values.due_date || null, position: count || 0 }); error = requestError;
    } else if (kind === "milestone") {
      const { count } = await client.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", currentProject.id);
      const { error: requestError } = await client.from("milestones").insert({ ...values, project_id: currentProject.id, due_date: values.due_date || null, position: count || 0 }); error = requestError;
    } else if (kind === "note") {
      const { error: requestError } = await client.from("task_notes").insert({ task_id: values.task_id, author_id: session.user.id, body: values.body }); error = requestError;
    }
    if (error) { notify(`Could not save: ${error.message}`); return; }
    if (currentProject && currentProject.id !== ALL_PROJECTS_ID && kind !== "note") await client.from("activity_events").insert({ project_id: currentProject.id, actor_id: session.user.id, event_type: `${kind}_created`, message: `Created ${kind}: ${values.name || "note"}.` });
    dialog.close();
    notify(`${kind[0].toUpperCase()}${kind.slice(1)} saved.`);
    await loadProjects();
  }

  authForm.addEventListener("submit", submitAuth);
  document.querySelector("#toggle-password").addEventListener("click", () => { const visible = authPassword.type === "text"; authPassword.type = visible ? "password" : "text"; });
  document.querySelector("#logout-button").addEventListener("click", async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) { notify(`Could not log out: ${error.message}`); return; }
    session = null;
    authPassword.value = "";
    showAuthError("");
    lock();
  });
  document.querySelector("#menu-button").addEventListener("click", () => app.classList.toggle("nav-open"));
  document.querySelectorAll(".sidebar nav a").forEach(link => link.addEventListener("click", () => app.classList.remove("nav-open")));
  document.querySelector("#new-task").addEventListener("click", () => currentProject && currentProject.id !== ALL_PROJECTS_ID ? openEditor("task") : notify("Select a project before creating a task."));
  document.querySelector("#new-project").addEventListener("click", () => openEditor("project"));
  document.querySelector("#new-milestone").addEventListener("click", () => currentProject && currentProject.id !== ALL_PROJECTS_ID ? openEditor("milestone") : notify("Select a project before creating a milestone."));
  dateFilter?.addEventListener("change", () => { renderTasksV2(currentTasks); renderActivityV2(currentActivity); loadNotes(currentTasks.filter(task => matchesDateFilter(task))); });
  projectSelect.addEventListener("change", event => {
    if (event.target.value === ALL_PROJECTS_ID) currentProject = { id: ALL_PROJECTS_ID, name: "ALL", description: "All projects and work in one view." };
    else currentProject = { id: event.target.value, name: event.target.selectedOptions[0].textContent };
    loadProjectData();
  });
  taskColumns.addEventListener("click", event => { const add = event.target.closest(".add-task"); const details = event.target.closest(".task-details"); if (add) openEditor("task", { status: add.dataset.status }); if (details) openTaskDetails(details.dataset.taskId); });
  dialog.querySelector("form").addEventListener("submit", saveEditor);
  dialog.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
  detailsDialog?.querySelector("[data-close-details]")?.addEventListener("click", () => detailsDialog.close());
  detailsAddNote?.addEventListener("click", () => { const taskId = detailsAddNote.dataset.taskId; detailsDialog.close(); openEditor("note", { taskId }); });
  if (setupClient()) restoreSession();
})();
