(() => {
  const demoPasswords = new Set(["cayde-demo", "stride-demo"]); // Public demo values only; this is not an authentication system.
  const gate = document.querySelector("#gate");
  const app = document.querySelector("#app");
  const error = document.querySelector("#gate-error");
  const password = document.querySelector("#password");
  const toast = document.querySelector("#toast");
  let toastTimer;

  const saveSession = value => {
    try { sessionStorage.setItem("cayde-project-manager-demo", value); } catch { /* Storage is optional. */ }
  };
  const clearSession = () => {
    try { sessionStorage.removeItem("cayde-project-manager-demo"); } catch { /* Storage is optional. */ }
  };
  const hasSession = () => {
    try { return sessionStorage.getItem("cayde-project-manager-demo") === "open"; } catch { return false; }
  };

  const openApp = () => { gate.hidden = true; app.hidden = false; password.value = ""; };
  const lock = () => { app.hidden = true; gate.hidden = false; password.focus(); };
  const notify = message => { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600); };

  document.querySelector("#gate-form").addEventListener("submit", event => {
    event.preventDefault();
    if (demoPasswords.has(password.value.trim())) { error.textContent = ""; openApp(); saveSession("open"); }
    else { error.textContent = "That demo password did not match."; password.select(); }
  });
  const togglePassword = document.querySelector("#toggle-password");
  togglePassword.addEventListener("click", () => {
    const isVisible = password.type === "password";
    password.type = isVisible ? "text" : "password";
    togglePassword.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
    togglePassword.setAttribute("aria-pressed", String(isVisible));
  });
  document.querySelector("#lock-button").addEventListener("click", () => { clearSession(); lock(); });
  document.querySelector("#menu-button").addEventListener("click", () => app.classList.toggle("nav-open"));
  document.querySelectorAll(".sidebar nav a").forEach(link => link.addEventListener("click", () => app.classList.remove("nav-open")));
  document.querySelector("#new-task").addEventListener("click", () => notify("Demo mode: task creation is ready to connect."));
  document.querySelector(".share-button").addEventListener("click", async () => {
    const shareText = "Website refresh is 68% complete — the launch is on track.";
    try {
      await navigator.clipboard.writeText(shareText);
      notify("Project update copied to your clipboard.");
    } catch {
      notify("Copy is unavailable in this browser. Run the site over HTTPS to enable it.");
    }
  });
  if (hasSession()) openApp(); else password.focus();
})();
