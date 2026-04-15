# K8s Maintenance Manager — PRD

## Problem Statement
Manage websites hosted in a Kubernetes cluster by managing Traefik `ip-allowlist` Middlewares per application (name, ip-allowlist, namespace). Supports Keycloak + local Super Admin authentication. Roles: admin (full access), user (update + toggle + template CRUD), readonly (read only). Includes reusable IP/CIDR templates linked to application allowlists — updating a template auto-propagates to all linked apps.

## Architecture
- **Backend**: FastAPI (Python) on port 8001, MongoDB via Motor AsyncIO
- **Frontend**: React on port 3000, Shadcn UI, dark theme
- **Auth**: Dual — Keycloak OAuth2 code exchange + Local Super Admin (bcrypt + JWT)
- **K8s**: `kubernetes` Python client for Traefik middleware CRUD (gracefully mocked outside cluster)

## DB Schema
- `super_admins`: `{username, password_hash, created_at}`
- `applications`: `{name, namespace, ip_allowlist: [{type, value, template_id?, template_name?}], enabled, created_at, updated_at, created_by}`
- `ip_templates`: `{name, value, description, created_by, created_at, updated_at?}`
- `audit_logs`: `{action, target_type, target_name, user, details, timestamp}` (90-day TTL)

## Role Permissions
- **admin**: Full access — create/delete apps, toggle, update allowlists, template CRUD
- **user**: Toggle apps, update allowlists, create/update/delete IP templates
- **readonly**: View only — dashboard, YAML preview, audit log

## Completed Features
- Full CRUD for applications and IP templates
- Keycloak OAuth2 auth (code exchange flow) + local super admin auth
- Relational linking: templates <-> application allowlists with auto-propagation
- Template usage counter
- Dashboard shows ALL IPs per app on separate lines
- YAML preview — real cluster YAML or generated, with source badge
- Sync status indicator — namespace + middleware existence check
- Audit log — tracks all mutations with user, action, target, details, timestamp, filtering, pagination

## Key Endpoints
- `POST /api/auth/local-login` — local admin login
- `POST /api/auth/keycloak-callback` — exchange Keycloak auth code for token
- `GET /api/audit-logs` — audit log with ?action= and ?target_type= filters
- `GET/POST/PUT/DELETE /api/applications` — app CRUD
- `GET/POST/PUT/DELETE /api/ip-templates` — template CRUD
- `GET /api/ip-templates/usage` — template usage counts
- `GET /api/applications/{id}/yaml` — Traefik middleware YAML
- `GET /api/applications/sync-status` — cluster sync status
- `POST /api/applications/{id}/toggle` — enable/disable

## Backlog
None — all requested features delivered.
