(() => {
  const demoPassword = "stride-demo"; // Public demo value only; this is not an authentication system.
  const gate = document.querySelector("#gate");
  const app = document.querySelector("#app");
  const error = document.querySelector("#gate-error");
  const password = document.querySelector("#password");
  const toast = document.querySelector("#toast");
  let toastTimer;

  const openApp = () => { gate.hidden = true; app.hidden = false; password.value = ""; };
  const lock = () => { app.hidden = true; gate.hidden = false; password.focus(); };
  const notify = message => { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600); };

  document.querySelector("#gate-form").addEventListener("submit", event => {
    event.preventDefault();
    if (password.value === demoPassword) { error.textContent = ""; sessionStorage.setItem("market-strider-demo", "open"); openApp(); }
    else { error.textContent = "That demo password did not match. Try stride-demo."; password.select(); }
  });
  const togglePassword = document.querySelector("#toggle-password");
  togglePassword.addEventListener("click", () => {
    const isVisible = password.type === "password";
    password.type = isVisible ? "text" : "password";
    togglePassword.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
    togglePassword.setAttribute("aria-pressed", String(isVisible));
  });
  document.querySelector("#lock-button").addEventListener("click", () => { sessionStorage.removeItem("market-strider-demo"); lock(); });
  document.querySelector("#menu-button").addEventListener("click", () => app.classList.toggle("nav-open"));
  document.querySelectorAll(".sidebar nav a").forEach(link => link.addEventListener("click", () => app.classList.remove("nav-open")));
  document.querySelector("#new-task").addEventListener("click", () => notify("Demo mode: task creation is ready to connect."));
  document.querySelector(".share-button").addEventListener("click", async () => {
    const shareText = "Market Strider Leaderboard is 68% complete — momentum is building.";
    try {
      await navigator.clipboard.writeText(shareText);
      notify("Project update copied to your clipboard.");
    } catch {
      notify("Copy is unavailable in this browser. Run the site over HTTPS to enable it.");
    }
  });
  if (sessionStorage.getItem("market-strider-demo") === "open") openApp(); else password.focus();
})();
