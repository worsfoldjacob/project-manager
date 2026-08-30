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
  const dialog = document.querySelector("#editor-dialog");
  const dialogTitle = document.querySelector("#editor-title");
  const dialogFields = document.querySelector("#editor-fields");
  let client;
  let session;
  let currentProject;
  let toastTimer;

  const columns = [
    ["up_next", "Up next"], ["in_progress", "In progress"], ["in_review", "In review"], ["done", "Done"]
  ];
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const notify = message => { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3000); };
  const showAuthError = message => { authError.textContent = message || ""; };
  const openApp = () => { gate.hidden = true; app.hidden = false; app.style.display = "flex"; };
  const lock = () => { app.hidden = true; app.style.display = "none"; gate.hidden = false; authUsername.focus(); };
  const initials = value => (value || "PM").split(/[.@\s_-]+/).filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "PM";
  const dateText = value => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)) : "No date";
  const timeText = value => value ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round((new Date(value) - new Date()) / 3600000), "hour") : "Just now";
  const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `project-${Date.now()}`;

  function setupClient() {
    if (!config.url || !config.anonKey || /replace-with|your-/i.test(config.anonKey)) {
      showAuthError("This site needs a Supabase publishable key in config.js before it can sign in.");
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
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      if (nextSession) { openApp(); loadProjects(); }
      else lock();
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
    if (!client) return;
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
    data.forEach(project => projectSelect.insertAdjacentHTML("beforeend", `<option value="${project.id}">${escapeHtml(project.name)}</option>`));
    currentProject = data.find(project => project.id === currentProject?.id) || data[0];
    projectSelect.value = currentProject.id;
    await loadProjectData();
  }

  async function loadProjectData() {
    if (!currentProject) return renderEmpty();
    projectName.textContent = currentProject.name;
    projectDescription.textContent = currentProject.description || "Keep your work clear, organized, and moving forward.";
    userAvatar.textContent = initials(session?.user?.email);
    const [tasksResult, milestonesResult, activityResult] = await Promise.all([
      client.from("tasks").select("*").eq("project_id", currentProject.id).order("position").order("created_at"),
      client.from("milestones").select("*").eq("project_id", currentProject.id).order("position").order("due_date"),
      client.from("activity_events").select("*").eq("project_id", currentProject.id).order("created_at", { ascending: false }).limit(12)
    ]);
    const failure = [tasksResult, milestonesResult, activityResult].find(result => result.error);
    if (failure) { notify(`Could not load workspace: ${failure.error.message}`); return; }
    renderTasks(tasksResult.data);
    renderMilestones(milestonesResult.data);
    renderActivity(activityResult.data);
    await loadNotes(tasksResult.data);
  }

  function renderEmpty() {
    projectName.textContent = "Your projects";
    projectDescription.textContent = "Create a project to start organizing work.";
    taskColumns.innerHTML = '<p class="empty-state">No tasks yet.</p>';
    milestones.innerHTML = '<li class="empty-state">No milestones yet.</li>';
    activity.innerHTML = '<p class="empty-state">No activity yet.</p>';
    notes.innerHTML = "";
    taskCount.textContent = "0";
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

  function renderActivity(items) {
    activity.innerHTML = items.map(item => `<div class="activity-item"><span class="mini-avatar a2">${escapeHtml(initials(session?.user?.email))}</span><p>${escapeHtml(item.message)}<small>${timeText(item.created_at)}</small></p></div>`).join("") || '<p class="empty-state">No activity yet.</p>';
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
    if (currentProject && kind !== "note") await client.from("activity_events").insert({ project_id: currentProject.id, actor_id: session.user.id, event_type: `${kind}_created`, message: `Created ${kind}: ${values.name || "note"}.` });
    dialog.close();
    notify(`${kind[0].toUpperCase()}${kind.slice(1)} saved.`);
    await loadProjects();
  }

  authForm.addEventListener("submit", submitAuth);
  document.querySelector("#toggle-password").addEventListener("click", () => { const visible = authPassword.type === "text"; authPassword.type = visible ? "password" : "text"; });
  document.querySelector("#logout-button").addEventListener("click", async () => { if (client) await client.auth.signOut(); });
  document.querySelector("#menu-button").addEventListener("click", () => app.classList.toggle("nav-open"));
  document.querySelectorAll(".sidebar nav a").forEach(link => link.addEventListener("click", () => app.classList.remove("nav-open")));
  document.querySelector("#new-task").addEventListener("click", () => currentProject ? openEditor("task") : openEditor("project"));
  document.querySelector("#new-project").addEventListener("click", () => openEditor("project"));
  document.querySelector("#new-milestone").addEventListener("click", () => currentProject ? openEditor("milestone") : openEditor("project"));
  projectSelect.addEventListener("change", event => { currentProject = { id: event.target.value, name: event.target.selectedOptions[0].textContent }; loadProjectData(); });
  taskColumns.addEventListener("click", event => { const add = event.target.closest(".add-task"); const note = event.target.closest(".task-note"); if (add) openEditor("task", { status: add.dataset.status }); if (note) openEditor("note", { taskId: note.dataset.taskId }); });
  dialog.querySelector("form").addEventListener("submit", saveEditor);
  dialog.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
  if (setupClient()) restoreSession();
})();
