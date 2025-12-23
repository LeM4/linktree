# Linktree Website

## Project Description
This project implements a lightweight, fast Linktree-style website suitable for Instagram/social media bios. It is server-rendered, extremely fast on mobile/in-app browsers, and features geo-blocking for links.

## Features
*   **Server-rendered:** Ensures fast initial load times and no client-side API fetching for public pages.
*   **Geo-blocking:** Links are hidden based on the user's country using Cloudflare-provided headers.
*   **Lightweight Admin Dashboard:** A simple private dashboard for managing links, built with htmx and Alpine.js.
*   **No Heavy Frameworks:** Avoids complex frontend frameworks for maximum performance.
*   **Modern Tech Stack:** Utilizes Bun, Fastify, EJS, and Tailwind CSS v4.

## Technologies Used
*   **Backend:** Bun (runtime), Fastify (web framework)
*   **Templating:** EJS (server-side rendering)
*   **Styling:** Tailwind CSS v4
*   **Frontend Interactivity:** htmx (server interactions), Alpine.js (minimal UI state)
*   **Database:** SQLite
*   **Geo-blocking:** Cloudflare-provided `CF-IPCountry` header

## Installation

1.  **Install Bun:** If you don't have Bun installed, follow the instructions on the [Bun website](https://bun.sh/docs/installation).

2.  **Clone the repository:**
    ```bash
    # (If this were a git repository)
    # git clone <repository_url>
    # cd <repository_name>
    ```
    (In this case, the files are already in your current directory.)

3.  **Install dependencies:**
    ```bash
    bun install
    ```

4.  **Initialize the database:** This will create the `database.sqlite` file and the `links` table.
    ```bash
    bun run init-db.js
    ```

5.  **Seed the database (optional):** This will add some sample links to your database.
    ```bash
    bun run seed.js
    ```

## Running the Application

### Development Mode

To run the application in development mode with live reloading for both the public and admin servers, and automatic CSS rebuilding:
```bash
bun run dev
```
This command concurrently runs:
*   The public-facing Fastify server (on port 3000)
*   The admin server (on port 3001)
*   The Tailwind CSS watcher

### Production Mode

To run the application in production mode, you need to run two separate commands (in separate terminal windows):
```bash
# Start the public server
bun run start

# Start the admin server
bun run start:admin
```

## Accessing the Application

*   **Public Linktree Page:** `http://localhost:3000/`
*   **Admin Dashboard:** `http://localhost:3001/admin`

## Building CSS

The CSS is automatically built in development mode. If you need to build the CSS manually (e.g., for deployment), there is no specific build command in the `package.json`, but you can use the Tailwind CSS CLI directly:
```bash
bunx @tailwindcss/cli -i ./styles/input.css -o ./public/styles.css --minify
```
