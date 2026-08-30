# Market Strider Project Manager

A responsive, static GitHub Pages-ready example dashboard for the Market Strider Leaderboard project. It uses plain HTML, CSS, and JavaScript—no build step, dependencies, API calls, or external data sources.

## Local preview

Open `index.html` directly in a modern browser, or run a simple local static server from this folder, for example:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

The demo password is `stride-demo`. It is deliberately public and stored in the client-side JavaScript solely to demonstrate the app-password interaction. It is **not** authentication and must not be used to protect real content or secrets.

## GitHub Pages deployment

1. Push this branch to the repository that will host the site.
2. In GitHub, open **Settings → Pages**.
3. Select **Deploy from a branch**, then select the branch and the repository root (`/`).
4. Save. GitHub Pages will publish `index.html`.

`CNAME` sets the intended custom domain to `pm.w-software.net`. Before enabling it, configure the matching DNS record with the domain provider and ensure the repository is permitted to use that domain.

## Files

- `index.html` — dashboard markup and accessible structure
- `styles.css` — responsive visual design
- `app.js` — local demo gate and small UI interactions
- `CNAME` — GitHub Pages custom-domain declaration
