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
  document.querySelector("#toggle-password").addEventListener("click", () => { password.type = password.type === "password" ? "text" : "password"; });
  document.querySelector("#lock-button").addEventListener("click", () => { sessionStorage.removeItem("market-strider-demo"); lock(); });
  document.querySelector("#menu-button").addEventListener("click", () => app.classList.toggle("nav-open"));
  document.querySelectorAll(".sidebar nav a").forEach(link => link.addEventListener("click", () => app.classList.remove("nav-open")));
  document.querySelector("#new-task").addEventListener("click", () => notify("Demo mode: task creation is ready to connect."));
  document.querySelector(".share-button").addEventListener("click", () => notify("Project update copied to your demo workspace."));
  if (sessionStorage.getItem("market-strider-demo") === "open") openApp(); else password.focus();
})();
