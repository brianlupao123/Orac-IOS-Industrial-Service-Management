# Orac IOS: Industrial Service Management

Manage industrial service requests, quotations, purchase orders, field jobs and invoices in one place.

This repository is a reviewed frontend deployment snapshot. The main application
is developed separately. A successful static deployment does not establish that
backend workflows are available or production-ready.

## Render Static Site

- Branch: main
- Root directory: blank
- Build: npm ci && npm run build
- Publish directory: dist
- Rewrite: /* to /index.html
- Environment: VITE_API_BASE_URL set to the real HTTPS backend URL ending /api

The backend must allow the deployed frontend origin through CORS. No public backend
URL has been established yet. Without it, this deployment is a frontend preview;
login and operational requests are unavailable. Never use localhost as the API
address for a shared deployment. VITE_ variables are public; do not add credentials.

Install with npm ci, build with npm run build, and run locally with npm run dev.
Preserve package-lock.json. Change environment values before rebuilding.
