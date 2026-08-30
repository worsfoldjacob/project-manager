# Cayde-6 Project Manager

A static GitHub Pages-ready project workspace backed by Supabase Auth and the included RLS schema. Each signed-in user can only access projects they own.

## Configure Supabase

1. Apply `supabase/migrations/20260830121000_project_manager.sql` to Supabase project `zhgwhsrhrfsjdupikobo`.
2. `config.js` contains this project's browser-safe publishable key and is ready for the static deployment.
3. In Supabase Auth URL configuration, add the GitHub Pages/custom-domain URL as an allowed redirect URL and enable Email authentication.

The key in `config.js` is intentionally browser-visible. It must be an anon or publishable key only; do not place a service-role key, database password, or other secret in this repository.

## Local preview

Run a local static server from this folder:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`. You can sign up with email and password, sign in, create projects, tasks, milestones, and task notes, and see the activity log. Sessions persist through browser refreshes; logging out returns to the sign-in screen.

## Deployment

Push the branch and configure GitHub Pages to deploy from the repository root. `CNAME` preserves the configured custom domain (`pm.w-software.net`).

## Files

- `index.html` — accessible dashboard and editor markup
- `app.js` — Supabase browser authentication and RLS-backed persistence
- `config.js` — public browser Supabase configuration
- `supabase/migrations/` — schema and RLS policies
