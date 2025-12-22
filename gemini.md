# Project: Lightweight Linktree with Geo-Blocking (Fastify)

## Purpose
Build a lightweight, fast Linktree-style website suitable for Instagram/social media bios.

The site must:
- Be server-rendered
- Be extremely fast on mobile / in-app browsers
- Hide links completely based on user country (geo-blocking)
- Have a simple private admin dashboard
- Avoid heavy frontend frameworks (NO React/Vue/Svelte)
- Use common, boring, well-supported technology
- Be easy to manage from a backend dashboard
- Run behind Cloudflare Tunnel (geo headers available)

This project intentionally avoids client-side API fetching and SPA architecture.

---

## FINAL TECH DECISIONS (NO ALTERNATIVES)

### Backend
- **Node.js**
- **Fastify** (mandatory)

### Templates
- **EJS** (server-side rendering)

### Styling
- **Tailwind CSS**
- Precompiled CSS (no runtime Tailwind)

### Frontend Interactivity
- **htmx** → server interactions, partial HTML updates
- **Alpine.js** → minimal UI state (toggles, dropdowns, animations)

### Database
- **SQLite**
- Accessed directly from Node (no ORM required unless trivial)

### Geo-blocking
- **Cloudflare-provided country header**
- Header name: `CF-IPCountry`
- No client-side geo logic

---

## Hosting & Networking

- App runs behind **Cloudflare Tunnel**
- DNS is managed by Cloudflare
- Cloudflare injects geo headers before traffic reaches Fastify
- Geo-blocking MUST work behind the tunnel

Example:
```js
const country = req.headers['cf-ipcountry'] || 'US'
```

---

## Core Architectural Rule
### HTML is rendered only after geo-filtering on the server.
The client:
- Never fetches link data
- Never receives blocked links
- Never runs geo logic
No JSON APIs for public pages.

---

## Application Structure (MANDATORY)
Gemini should scaffold the project using the following structure:
```bash
/app
  /routes
    public.js          # Public Linktree page
    admin.js           # Admin dashboard routes
  /views
    /partials
      link-card.ejs    # Single link component
    linktree.ejs       # Public page template
    admin.ejs          # Admin dashboard
  /public
    styles.css         # Compiled Tailwind output
  /db
    database.sqlite
  /lib
    db.js              # SQLite access helpers
    geo.js             # Country detection helper
  server.js            # Fastify bootstrap
  tailwind.config.js
  package.json
  gemini.md
```

---

## Database Schema
SQLite database with a single primary table.
Table: `links`
Fields:
- `id` INTEGER PRIMARY KEY
- `title` TEXT
- `url` TEXT  
- `blocked_countries` TEXT (JSON array of ISO country codes)
- `enabled` BOOLEAN
- `order_index` INTEGER
Example `blocked_countries` value:
```json       
["DE", "FR", "CN"]     
```  

---  
     
## Public Linktree Page
### Route     
     
GET /
     
### Behavior  
1. Read user country from CF-IPCountry   
2. Load all enabled links from SQLite    
3. Filter out links blocked for that country      
4. Render HTML with visible links only   
     
Blocked links:
- Must not appear in HTML  
- Must not appear in JS
- Must not appear as placeholders   
     
---  
     
## Admin Dashboard     
### Route     
     
GET /admin    
     
### Requirements       
- Server-rendered HTML 
- No SPA framework     
- Uses htmx for:       
  - Enable/disable links   
  - Edit blocked countries 
  - Reorder links      
- Uses Alpine.js only for UI state  
     
### Example htmx interaction        
     
```html       
<button       
  hx-post="/admin/links/3/toggle"   
  hx-target="#link-3"  
  hx-swap="outerHTML"> 
  Toggle      
</button>     
```  
     
Server returns updated HTML partial.
     
---  
     
## Styling Rules       
     
- Use Tailwind utility classes only 
- Prefer simple, clean, mobile-first design       
- Use rounded cards, spacing, subtle hover effects
- Dark/light theme optional but simple   
     
## Performance Constraints 
     
No client-side hydration   
     
Minimal JavaScript payload 
     
HTML should be usable with JS disabled   
     
Fast initial render for Instagram in-app browsers 
     
## Explicit Non-Goals  
     
- No user accounts     
- No OAuth    
- No analytics
- No client-side routing   
- No REST/GraphQL public APIs       
- No Redis    
- No React or SPA frameworks        
     
## Development Philosophy  
     
- Server-rendered > client-rendered 
- HTML over JSON       
- Minimal JS  
- Boring tech > clever tech
- Maintainability > abstraction