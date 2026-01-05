# Linktree Website

## Project Description
This project implements a lightweight, fast Linktree-style website suitable for Instagram/social media bios. It is server-rendered, extremely fast on mobile/in-app browsers, and features geo-blocking for links. It also includes an analytics dashboard for tracking user visits and link clicks.

## Features
*   **Server-rendered:** Ensures fast initial load times and no client-side API fetching for public pages.
*   **Geo-blocking:** Links are hidden based on the user's country using Cloudflare-provided headers.
*   **Lightweight Admin Dashboard:** A simple private dashboard for managing links, built with htmx and Alpine.js.
*   **Background Themes:** Dynamic background themes for the public page, configurable from the admin dashboard. Themes are composed of HTML, CSS, and JavaScript, and are loaded only when active for performance.
*   **No Heavy Frameworks:** Avoids complex frontend frameworks for maximum performance.
*   **Analytics Dashboard:** Tracks total visits, unique visitors, visitations over time, top links, top countries, and top referrers with interactive charts (line, pie, polar area).
*   **Interactive Analytics Filtering:** Clickable elements in the analytics dashboard allow users to filter data by excluding specific links, countries, or referrers.
*   **User-Agent Referrer Inference:** Infers referrers from User-Agent strings for social media platforms (e.g., TikTok) to improve analytics accuracy when a direct referrer is unavailable.
*   **Import/Export Database:** A utility to export and import database content as a JSON string, providing a way to manage data across schema changes.

## Technologies Used
*   **Backend:** Bun (runtime), Fastify (web framework)
*   **Templating:** EJS (server-side rendering)
*   **Styling:** Tailwind CSS v4
*   **Frontend Interactivity:** htmx (server interactions), Alpine.js (minimal UI state)
*   **Analytics:** FingerprintJS (for anonymous user fingerprinting), Chart.js (for data visualization)
*   **Database:** SQLite (main and analytics databases)
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

4.  **Initialize the databases:** This will create the `database.sqlite` and `analytics.sqlite` files and their respective tables.
    ```bash
    bun run init-db.js
    bun run init-analytics-db.js
    ```

5.  **Seed the database (optional):** This will add some sample links to your main database.
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
*   **Analytics Dashboard:** `http://localhost:3001/analytics`

## Theme Management

Background themes can be managed from the Admin Dashboard (`http://localhost:3001/admin`).

### Adding New Themes

1.  Create a new folder inside the `themes/` directory (e.g., `themes/my-custom-theme`).
2.  Inside this folder, place your theme files:
    *   `index.html`: Contains the HTML structure for your background theme.
    *   `style.css`: Contains the CSS for your background theme. Ensure all your CSS rules are scoped to `#theme-YOUR_THEME_FOLDER_NAME` to avoid conflicts with the main application styles.
    *   `script.js`: Contains any JavaScript for your background theme. Wrap your script in an IIFE to prevent global scope pollution.
3.  Go to the Admin Dashboard and click "Scan for New Themes". Your new theme should appear in the list.

### Activating/Deactivating Themes

*   From the "Background Themes" section in the Admin Dashboard, click "Activate" next to your desired theme.
*   To deactivate the current theme, click "Deactivate" next to the active theme.

## Analytics Filtering

The Analytics Dashboard (`http://localhost:3001/analytics`) now supports interactive filtering:

*   **Click to Filter:** Click on any "Top Link", "Top Country", or "Top Referrer" to add it as an exclusion filter. The page will reload, and the data will update to exclude the selected item.
*   **Remove Filters:** Active filters are displayed at the top of the page. Click on a crossed-out filter to remove it.

## Building CSS

The CSS is automatically built in development mode. If you need to build the CSS manually (e.g., for deployment), use the following command:
```bash
bun run build:css
```

## Docker

This application includes a simple `Dockerfile` that copies your local project files into an image.

### Prerequisites

Before building the Docker image, you **must** ensure you have:
1. Installed the project dependencies locally:
    ```bash
    bun install
    ```
2. Built the production CSS file locally:
    ```bash
    bun run build:css
    ```
    This will generate `public/styles.css`, which is then copied into the Docker image.
3. Placed static assets in the `public` folder:
    *   `public/styles.css`
    *   `public/fp.umd.min.js` (FingerprintJS UMD build)
    *   `public/favicon.png`
4. Created your custom themes in the `themes/` directory.

### Building the Image

To build the Docker image, run the following command in the project root:
```bash
docker build -t linktree-app .
```

### Running the Container Locally

To run the application as a Docker container, you need to mount a volume for the database to ensure data persistence.

1.  **Create a directory on your host machine to store the database:**
    ```bash
    mkdir -p /path/to/your/db
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -d \
      -p 3000:3000 \
      -p 3001:3001 \
      -v /path/to/your/db:/usr/src/app/db \
      --name my-linktree-app \
      linktree-app
    ```

*   The public Linktree page will be available at `http://localhost:3000`.
*   The admin dashboard will be available at `http://localhost:3001/admin`.

On the first run, the entrypoint script will automatically initialize the database and seed it with data in the volume you mounted. On subsequent runs, it will use the existing database.

### Deployment to GitHub Container Registry (GHCR)

1.  **Log in to GHCR:**
    ```bash
    echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
    ```
    (Replace `YOUR_GITHUB_TOKEN` with a GitHub Personal Access Token that has `package:write` permissions, and `YOUR_GITHUB_USERNAME` with your GitHub username.)

2.  **Tag the Docker image:**
    ```bash
    docker tag linktree-app ghcr.io/YOUR_GITHUB_USERNAME/linktree-app:v1
    ```
    (Replace `YOUR_GITHUB_USERNAME` with your GitHub username or organization name, and `v1` with your desired tag.)

3.  **Push the image to GHCR:**
    ```bash
    docker push ghcr.io/YOUR_GITHUB_USERNAME/linktree-app:v1
    ```

4.  **Running the image on a server:**
    Once you have SSH'd into your server, you can pull and run the image:
    ```bash
    # Pull the image from GHCR
    # You might need to log in to GHCR on your server as well if it's a private repo
    # echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
    docker pull ghcr.io/YOUR_GITHUB_USERNAME/linktree-app:v1

    # Run the container
    docker run -d \
      -p 80:3000 \
      -p 3001:3001 \
      -v /path/to/your/db:/usr/src/app/db \
      --name my-linktree-app \
      ghcr.io/YOUR_GITHUB_USERNAME/linktree-app:v1
    ```
    (Note: This example maps port 80 to the public-facing app on port 3000. You may need to adjust the ports based on your server's configuration.)
