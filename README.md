# Linktree

A lightweight, self-hosted, server-rendered "link in bio" page with per-country geo-blocking, a clean admin dashboard and privacy-friendly analytics. Built for speed in Instagram/TikTok in-app browsers.

[![CI](https://github.com/LeM4/linktree/actions/workflows/ci.yml/badge.svg)](https://github.com/LeM4/linktree/actions/workflows/ci.yml)

## Features

- **Server-rendered & fast**: no SPA, no client-side data fetching. Pages work without JavaScript.
- **Geo-blocking**: links are filtered on the server using Cloudflare's `CF-IPCountry` header. Blocked links never reach the browser. Visitors without a detectable country pick it once from a popup.
- **18+ links**: show a content warning before the visitor continues.
- **Admin dashboard**: manage links (reorder, hide, edit, geo-block), social icons, profile and colors. Includes a live preview and smooth htmx updates.
- **Background themes**: drop-in HTML/CSS/JS themes (e.g. `snowfall`) that only load while active.
- **Analytics**: visits, unique visitors, clicks, countries, referrers and hourly/daily charts, with click-to-exclude filters.
- **No third-party requests**: htmx, Alpine.js, Chart.js, FingerprintJS and the Arvo font are self-hosted. There are no CDNs or Google Fonts.
- **Backup**: JSON export/import from the dashboard or the CLI.
- **Ready to deploy**: multi-arch Docker image on GHCR, plus a Docker Swarm stack for Portainer.

## Tech stack

Bun, Fastify, EJS, Tailwind CSS v4, htmx, Alpine.js, SQLite (`bun:sqlite`), Chart.js.

## Quick start (local)

Requires [Bun](https://bun.sh) ≥ 1.1.

```bash
git clone https://github.com/LeM4/linktree.git
cd linktree
bun install
cp .env.example .env      # then set ADMIN_PASSWORD
bun run dev
```

| URL | What |
| --- | --- |
| <http://localhost:3000> | Public page |
| <http://localhost:3001/admin> | Admin dashboard (HTTP Basic auth) |
| <http://localhost:3001/analytics> | Analytics |

The databases are created in `db/` on first start, along with some sample links. To start empty, set `SEED_SAMPLE_LINKS=false`.

### Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Copy vendor assets, then run both servers with watch mode and the Tailwind watcher |
| `bun run build` | Copy vendor assets + fonts to `public/` and build minified CSS |
| `bun start` | Run the public site **and** the admin in one process (production) |
| `bun run start:public` / `bun run start:admin` | Run only one of the two servers |
| `bun test` | Unit and integration tests |
| `bun cli.js <command>` | Maintenance CLI (see below) |

### CLI

```bash
bun cli.js init                 # create / migrate databases
bun cli.js seed                 # add sample links
bun cli.js export backup.json   # export links, settings, icons (stdout if no file)
bun cli.js import backup.json   # replace links, settings, icons from an export
```

In Docker, run it as the app user: `docker exec -u bun <container> bun cli.js export > backup.json`.

## Configuration

All settings are environment variables. See [.env.example](.env.example).

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin` | Admin login user |
| `ADMIN_PASSWORD` | – | Admin login password (**required**) |
| `ADMIN_PASSWORD_FILE` | – | Read the password from a file instead (Docker secrets) |
| `ADMIN_AUTH_DISABLED` | `false` | Disable admin auth. Only use this if the admin port is protected another way |
| `PORT` / `ADMIN_PORT` | `3000` / `3001` | Ports of the public site / admin |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `db` | Folder for `database.sqlite` and `analytics.sqlite` |
| `PUBLIC_URL` | – | Your public page URL. Shows a "View site" button in the admin |
| `TZ` | `UTC` | Timezone for analytics timestamps |
| `TRUST_PROXY` | `true` | Trust `X-Forwarded-*` headers (Cloudflare Tunnel / reverse proxy) |
| `SEED_SAMPLE_LINKS` | `true` | Insert sample links when the database is created |
| `LOG_LEVEL` | `info` | Fastify/pino log level |

## Docker

The image is built in multiple stages. Dependencies, CSS and vendor assets are all built inside the image, so you don't need to prepare anything locally. It runs as an unprivileged user and includes a health check.

```bash
docker build -t linktree .
docker run -d --name linktree \
  -p 3000:3000 -p 127.0.0.1:3001:3001 \
  -e ADMIN_PASSWORD='a-long-random-password' \
  -v linktree-data:/usr/src/app/db \
  linktree
```

Prebuilt images are published by CI to `ghcr.io/lem4/linktree` with these tags:

- `latest`: the default branch
- `1.2.3` and `1.2`: `v*` git tags
- `sha-<short>`: individual commits

> Upgrading from the old image: the data path (`/usr/src/app/db`) is unchanged. The new entrypoint fixes ownership of the root-owned files the old image created. You now **must** set `ADMIN_PASSWORD` or `ADMIN_PASSWORD_FILE`.

## Deploy on Docker Swarm with Portainer

[docker-stack.yml](docker-stack.yml) is a ready-made Swarm stack.

1. **Create the secret.** In Portainer, go to *Secrets → Add secret* and add `linktree_admin_password`. Or use the CLI:

   ```bash
   printf '%s' 'a-long-random-password' | docker secret create linktree_admin_password -
   ```

2. **Create the stack.** Go to *Stacks → Add stack*. Either point it at this Git repository with the compose path `docker-stack.yml`, or paste the file into the web editor.
3. **Optionally set environment variables** in the stack's *Environment variables* section:

   | Variable | Default | Purpose |
   | --- | --- | --- |
   | `LINKTREE_IMAGE` | `ghcr.io/lem4/linktree:latest` | Image to deploy |
   | `PUBLIC_URL` | – | Shown as "View site" in the admin |
   | `TZ` | `UTC` | Analytics timezone |
   | `PUBLIC_PUBLISHED_PORT` | `3000` | Published public port (ingress) |
   | `ADMIN_PUBLISHED_PORT` | `3001` | Published admin port (host mode, keep it firewalled) |
   | `LINKTREE_PLACEMENT` | `node.role == manager` | Placement constraint, e.g. `node.hostname == my-node` |
   | `CLOUDFLARED_TOKEN` | – | Only if you enable the optional `cloudflared` service |

4. **Deploy.**

Notes:

- SQLite has a single writer, so the stack runs **one replica**, uses `stop-first` updates, and pins the task to one node so the local volume stays put.
- For geo-blocking, traffic has to arrive through Cloudflare. The easiest way is the commented-out `cloudflared` service in the stack file. Point the tunnel's public hostname at `http://linktree:3000`. Then you can remove the published public port.
- Don't expose the admin port to the internet. Reach it via VPN, SSH tunnel, or a separate Cloudflare Access-protected hostname.

## CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push and pull request:

1. **Build & test**: `bun install --frozen-lockfile`, `bun run build`, an entrypoint bundle check and `bun test`.
2. **Image**: a multi-arch (`linux/amd64`, `linux/arm64`) Docker build with layer caching. The image is pushed to GHCR on `main` and `v*` tags. Pull requests build the image without pushing.

Publishing only uses the built-in `GITHUB_TOKEN`; no extra secrets are needed. Dependabot keeps Bun packages, Actions and the base image up to date.

To release a version, run `git tag v2.0.0 && git push --tags`.

## Background themes

1. Create `themes/<name>/` (letters, digits, `-`, `_`) containing any of these files:
   - `index.html`: markup, injected behind the page
   - `style.css`: scope every rule to `#theme-<name>`
   - `script.js`: wrap it in an IIFE so it doesn't leak globals
2. The theme shows up automatically under *Admin → Appearance*. Click it to activate.

Theme files are injected unescaped. Only add themes you trust.

## Security notes

- The admin is protected by HTTP Basic auth: a constant-time comparison, plus a same-origin check against CSRF. Always serve it over HTTPS or keep it on a private network.
- Link and icon URLs must be `http(s)`. Public clicks go through `/go/:id`, which only redirects to links that are stored and visible to the visitor, so it can't be used as an open redirect.
- SVG icons are rejected if they contain scripts, `foreignObject` or event handlers.
- Analytics only store the referrer's origin (no paths or query strings), the country and an anonymous visitor ID. Check your local privacy laws (e.g. GDPR) before enabling fingerprinting on a public site, and mention it in your privacy notice.

## Project structure

```
main.js              starts public + admin (production entrypoint)
server.js            public Fastify app (port 3000)
admin-server.js      admin Fastify app (port 3001, auth)
cli.js               maintenance CLI
lib/                 config, db, analytics, auth, validation, theme helpers
routes/              public, admin and analytics routes
views/               EJS templates and partials
styles/input.css     Tailwind v4 entry + UI components
scripts/             build helpers (vendor asset copy)
themes/              background themes
tests/               bun test suites
```

## License

ISC
