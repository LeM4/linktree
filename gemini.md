# Project guide for AI agents: Lightweight Linktree (Bun + Fastify)

## Purpose

A fast, server-rendered "link in bio" page for social media, with per-country geo-blocking,
a private admin dashboard and lightweight analytics.

## Core rules

- **Server-rendered HTML only.** Public pages never fetch link data from JSON APIs.
- **Geo-filter on the server.** Blocked links must not appear in HTML, JS or as placeholders.
  Country comes from the `country` cookie (popup) or the Cloudflare `CF-IPCountry` header (`lib/geo.js`).
- **Minimal JS.** htmx for server interactions, Alpine.js for small UI state. No React/Vue/Svelte.
- **Pages work without JS**, e.g. links are plain `<a href="/go/:id">`.
- **Boring tech > clever tech. Maintainability > abstraction.**

## Stack

- Runtime: **Bun**; web framework: **Fastify 5**; templates: **EJS**
- Styling: **Tailwind CSS v4** (precompiled via `@tailwindcss/cli`, components in `styles/input.css`)
- DB: **SQLite** via `bun:sqlite` (`db/database.sqlite`, `db/analytics.sqlite`), no ORM
- Frontend libs are copied from `node_modules` into `public/vendor` by `scripts/build-assets.js` (no CDNs).

## Layout

```
main.js / server.js / admin-server.js   entrypoints (public :3000, admin :3001)
cli.js                                  init | seed | export | import
lib/config.js                           env config (single source of truth)
lib/db.js, lib/analytics_db.js          schema, migrations (ensureColumn), queries
lib/http.js                             shared Fastify setup (view, static, headers, /healthz)
lib/auth.js                             Basic auth + same-origin (CSRF) check for admin
lib/validate.js                         URL/country/color validation, referrer normalization
lib/theme.js                            palette from base color, theme discovery/loading
routes/                                 public.js, admin.js, analytics.js
views/                                  linktree.ejs, admin.ejs, analytics.ejs, partials/
themes/<name>/                          index.html, style.css, script.js
tests/                                  bun test (unit + fastify.inject integration)
```

## Conventions

- Validate all input at the route boundary (`lib/validate.js`). Store only `http(s)` URLs.
- Escape output with `<%= %>`. Use `<%- %>` only for trusted markup (includes, validated SVG, theme files).
  Embed data in `<script>` via `json()` (escapes `<`).
- Admin forms are regular POST forms that redirect with `?ok=<key>` / `?error=<key>`. The body uses
  `hx-boost` so updates are smooth while still working without JS.
- Never commit databases, `.env` files, backups or secrets.
- Run `bun test` before committing. CI builds and pushes the Docker image to GHCR.
