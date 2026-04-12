# K8s Maintenance Manager — PRD

## Problem Statement
Manage websites hosted in a Kubernetes cluster by managing Traefik `ip-allowlist` Middlewares per application (name, ip-allowlist, namespace). Supports Keycloak + local Super Admin authentication. Roles: admin (full access), user (update only), readonly (read only). Includes reusable IP/CIDR templates linked to application allowlists — updating a template auto-propagates to all linked apps.

## Architecture
- **Backend**: FastAPI (Python) on port 8001, MongoDB via Motor AsyncIO
- **Frontend**: React on port 3000, Shadcn UI, dark theme
- **Auth**: Dual — Keycloak JWT + Local Super Admin (bcrypt + JWT)
- **K8s**: `kubernetes` Python client for Traefik middleware CRUD (gracefully mocked outside cluster)

## DB Schema
- `super_admins`: `{username, password_hash, created_at}`
- `applications`: `{name, namespace, ip_allowlist: [{type:"manual"|"template", value, template_id?, template_name?}], enabled, created_at, updated_at, created_by}`
- `ip_templates`: `{name, value, description, created_by, created_at, updated_at?}`

## Completed Features
- Full CRUD for applications and IP templates
- Keycloak + local super admin auth with role-based access
- Relational linking: templates <-> application allowlists
- Template update propagation to all linked applications
- Dashboard auto-refresh on template edit/delete (bug fix 2026-04-12)
- Template usage counter — shows how many apps link to each template (2026-04-12)
- Dashboard shows ALL IPs per app, each on a separate line (2026-04-12)
- YAML preview button — generates and displays final Traefik Middleware YAML per app (2026-04-12)

## Key Endpoints
- `POST /api/auth/local-login` — local admin login
- `GET/POST/PUT/DELETE /api/applications` — app CRUD
- `GET/POST/PUT/DELETE /api/ip-templates` — template CRUD
- `GET /api/ip-templates/usage` — template usage counts
- `GET /api/applications/{id}/yaml` — Traefik middleware YAML preview
- `POST /api/applications/{id}/toggle` — enable/disable
- `GET /api/namespaces` — list K8s namespaces

## Backlog
None — all requested features delivered.
