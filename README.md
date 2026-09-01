# Cayde-6 Project Manager

A static GitHub Pages-ready project workspace backed by Supabase Auth and the included RLS schema. Each signed-in user can only access projects they own.

## Configure Supabase

1. Apply `supabase/migrations/20260830121000_project_manager.sql` to Supabase project `zhgwhsrhrfsjdupikobo`.
2. `config.js` contains this project's browser-safe publishable key and is ready for the static deployment.
3. In Supabase Auth URL configuration, add the GitHub Pages/custom-domain URL as an allowed redirect URL and enable Email authentication. Public sign-ups are disabled by `supabase/config.toml`.

The key in `config.js` is intentionally browser-visible. It must be an anon or publishable key only; do not place a service-role key, database password, or other secret in this repository.

## Local preview

Run a local static server from this folder:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`. Sign in with the private `Cayde-pm` username and password, then create projects, tasks, milestones, and task notes, and see the activity log. Sessions persist through browser refreshes; logging out returns to the sign-in screen.

## Private account provisioning

Create one confirmed Supabase Auth user with the internal email `cayde-pm@pm.w-software.net`. The public UI never exposes that email; users sign in with the fixed username `Cayde-pm`. Set the password privately in Supabase and keep public sign-ups disabled.

Public registration is disabled. To create the initial owner account, an owner should use the Supabase project dashboard's **Authentication → Users → Add user** control (or the trusted server-side Admin API with a service-role key kept outside this repository), set the email and password, and complete/confirm the account as required by the project's email-confirmation policy. The account can then sign in through the dashboard.

## Deployment

Push the branch and configure GitHub Pages to deploy from the repository root. `CNAME` preserves the configured custom domain (`pm.w-software.net`).

## OpenClaw sync API

The optional `pm-sync` Edge Function accepts authenticated, idempotent task snapshots from the local OpenClaw Project Manager store. It requires the Supabase secrets `PM_SYNC_TOKEN` and `PM_OWNER_USER_ID`; the service-role key is supplied by Supabase to the function runtime and is never committed here.

Each emitted work-update now triggers a dashboard snapshot sync from the local progress monitor. The browser refreshes the signed-in board every 30 seconds as a fallback, and cards use the same work-update fields: Task, Status, Lead, Stage, and Task est completion. Discord work-updates use bold field labels and colored status markers; approval buttons use native green Approve and red Reject styles. Description, blockers, waiting state, specialists, completed stages, references, and timestamps are available from the card's `...` menu. The date view filters tasks and activity by the latest source work-update timestamp.

Work-updates use the same Discord presentation box as approval requests. The main body contains Task, Lead, Stage, and Task est completion; the colored Status is rendered as a non-interactive context line at the bottom of the box.

Dashboard sections map statuses as follows:

- Up next: `TODO`, `QUEUED`
- In progress: `IN PROGRESS`
- In review: `WAITING FOR HUMAN`, `STALLED`, `BLOCKED`
- Done: `DONE`

Work-update status markers are: `TODO` 🔵, `QUEUED` 🟦, `IN PROGRESS` 🟡, `WAITING FOR HUMAN` 🟠, `STALLED` 🟣, `BLOCKED` 🔴, and `DONE` 🟢.

After authenticating the Supabase CLI, from this directory run:

```powershell
supabase link --project-ref zhgwhsrhrfsjdupikobo
supabase db push
supabase secrets set PM_SYNC_TOKEN=<random-sync-token> PM_OWNER_USER_ID=<owner-user-uuid>
supabase functions deploy pm-sync --no-verify-jwt
```

Set `PROJECT_MANAGER_SYNC_ENDPOINT` to `https://zhgwhsrhrfsjdupikobo.supabase.co/functions/v1/pm-sync` and `PROJECT_MANAGER_SYNC_TOKEN` in the private environment that runs `scripts/sync-local-project-manager.ps1`.

## Files

- `index.html` — accessible dashboard and editor markup
- `app.js` — Supabase browser authentication and RLS-backed persistence
- `config.js` — public browser Supabase configuration
- `supabase/migrations/` — schema and RLS policies
