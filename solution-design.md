# Solution Design: AI Value Framework – Backend

**Status:** Draft  
**Date:** 2026-05-21  
**Scope:** Moving the local-first POC to a multi-user, multi-project backend

---

## 1. Context

The current app is a facilitator workspace for running one-day AI Value Realization workshops. It is entirely browser-based, storing all data in `localStorage`. The POC needs to evolve to support:

- User authentication (login, registration, password reset)
- Multiple projects per user (one project = one workshop engagement)
- Project-level collaboration (invite others by email, role-based access)
- Retained JSON export/import capability

---

## 2. Architecture

### 2.1 High-Level Stack

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│          Vanilla JS (existing frontend)             │
│     Supabase JS SDK (auth only)  +  fetch() API     │
└──────────────┬───────────────────────┬──────────────┘
               │ JWT (Supabase token)  │ JSON REST calls
               ▼                       ▼
┌──────────────────────┐   ┌───────────────────────────┐
│   Supabase Auth      │   │     FastAPI (Python)      │
│   – email/password   │   │     – project CRUD        │
│   – magic link       │   │     – workspace save/load │
│   – OAuth (optional) │   │     – invite / accept     │
└──────────┬───────────┘   └──────────────┬────────────┘
           │                              │
           └──────────────┬───────────────┘
                          ▼
              ┌───────────────────────┐
              │  Supabase Postgres    │
              │  – projects           │
              │  – project_members    │
              │  – workspace_data     │
              │  – workspace_history  │
              │  Row Level Security   │
              └───────────────────────┘
```

### 2.2 Responsibilities

| Layer | Owns |
|---|---|
| **Supabase Auth** | User identity, JWT issuance, email verification, password reset, OAuth |
| **FastAPI** | All business logic: project management, workspace persistence, invitation lifecycle, authorization checks |
| **Supabase Postgres + RLS** | Data storage, schema enforcement, access control as defence-in-depth |
| **Frontend (vanilla JS)** | UI rendering, local state, export/import, calls FastAPI for everything except sign-in |

**FastAPI talks to Postgres using the service-role key** (bypasses RLS) and enforces authorization itself. The frontend never connects to Supabase Postgres directly.

---

## 3. Data Model

See [`db/schema.sql`](db/schema.sql) for the full DDL.

### 3.1 Tables

**`projects`** – One row per workshop engagement  
`id | name | owner_id | created_at | updated_at`

**`project_members`** – Membership and pending invitations  
`id | project_id | user_id (nullable) | invited_email | role | invited_by | invited_at | accepted_at | invitation_token | token_expires_at`

- `user_id = NULL` + `accepted_at = NULL` → pending invitation
- `user_id = NOT NULL` + `accepted_at = NOT NULL` → active member
- Roles: `owner`, `editor`, `viewer`

**`workspace_data`** – One live JSONB snapshot per project  
`id | project_id | data (JSONB) | schema_ver | saved_at | saved_by`

The `data` column stores the existing workspace JSON structure unchanged:
```json
{
  "version": 1,
  "workspace": { "name": "...", "createdAt": "...", "updatedAt": "..." },
  "phase1": { "cards": [] },
  "phase2": { "opportunities": [] },
  "phase3": { "useCases": [] },
  "phase4": { "scores": {} },
  "phase5": { "roadmapItems": [] }
}
```

**`workspace_history`** – Append-only save log (auto-populated by trigger)  
`id | project_id | data | schema_ver | saved_at | saved_by`

### 3.2 Roles

| Role | Read workspace | Write workspace | Invite others | Remove members | Delete project |
|---|:---:|:---:|:---:|:---:|:---:|
| owner | yes | yes | yes | yes | yes |
| editor | yes | yes | yes | no | no |
| viewer | yes | no | no | no | no |

---

## 4. API Design (FastAPI)

Base path: `/api/v1`  
Auth: `Authorization: Bearer <supabase-jwt>` on all endpoints

### 4.1 Projects

```
GET    /projects                     List all projects the caller is a member of
POST   /projects                     Create project (caller becomes owner)
GET    /projects/{id}                Get project metadata + member list
PATCH  /projects/{id}                Rename project (owner or editor)
DELETE /projects/{id}                Delete project and all data (owner only)
```

### 4.2 Workspace

```
GET    /projects/{id}/workspace      Load the current workspace snapshot
PUT    /projects/{id}/workspace      Save (upsert) the full workspace snapshot
GET    /projects/{id}/history        List save history (timestamp + saved_by)
GET    /projects/{id}/history/{hid}  Load a specific historical snapshot
```

The `PUT` endpoint accepts the same JSON structure that `buildExportPayload()` currently produces. The frontend's export/import logic requires no changes — export still generates a local file, import still calls `parseWorkspaceJson()`, and the validated object is then sent to `PUT /projects/{id}/workspace` instead of localStorage.

### 4.3 Members & Invitations

```
GET    /projects/{id}/members        List members (accepted + pending)
POST   /projects/{id}/invite         Invite by email, returns 201 (idempotent on same email)
DELETE /projects/{id}/members/{uid}  Remove a member (owner only, or self-removal)
PATCH  /projects/{id}/members/{uid}  Change role (owner only)

POST   /invitations/accept           Accept invite via token (no auth required — public endpoint)
```

### 4.4 Invitation Payload

```
POST /projects/{id}/invite
{
  "email": "colleague@example.com",
  "role": "editor"
}
```

Response `201`:
```json
{ "id": "...", "invited_email": "...", "role": "editor", "invited_at": "..." }
```

---

## 5. Invitation Flow

```
1. Owner/editor POSTs to /projects/{id}/invite with email + role
2. FastAPI:
     a. Inserts project_members row (user_id=NULL, accepted_at=NULL)
     b. Generates a signed JWT (HS256, 7-day expiry) encoding { project_id, invited_email }
     c. Stores token hash + expiry on the row
     d. Sends invitation email via Supabase transactional email or external provider (e.g. Resend)
     e. Email contains: https://app.example.com/invitations/accept?token=<token>

3. Invitee clicks the link → frontend calls POST /invitations/accept { token }
4. FastAPI:
     a. Verifies token signature + expiry
     b. Extracts { project_id, invited_email }
     c. If user is not logged in: redirect to /login?next=/invitations/accept?token=...
     d. Verifies logged-in user's email matches invited_email
     e. Sets user_id = auth.uid(), accepted_at = NOW(), clears invitation_token
     f. Returns { project_id, role } → frontend redirects to the project

5. If invitee has no account:
     → redirect to /register?invited_email=...&token=...
     → after registration, Supabase confirms email, then step 4 runs automatically
```

---

## 6. Frontend Changes

The frontend requires minimal structural changes. The core phase logic (Phase 1–5 renderers, schema validation, export/import) is unchanged.

### 6.1 New Screens

| Screen | Description |
|---|---|
| `/login` | Email/password + magic link, handled by Supabase JS SDK |
| `/register` | Registration, handled by Supabase JS SDK |
| `/projects` | Project list; create new project; open existing |
| `/projects/{id}` | Existing workshop UI (phases 1–5) with project context |
| `/projects/{id}/settings` | Rename, manage members, invite collaborators |
| `/invitations/accept` | Token acceptance landing page |

### 6.2 Changes to `app.js`

| Current | Replacement |
|---|---|
| `loadWorkspace()` from localStorage | `GET /api/v1/projects/{id}/workspace` on project open |
| `saveWorkspace()` to localStorage | `PUT /api/v1/projects/{id}/workspace` (debounced, ~2 s) |
| Single workspace, no concept of project | Project selector replaces intro or lives in nav |
| `resetWorkspace()` | Stays as local clear; server data untouched unless user explicitly deletes project |

Keep `persist()` as the single save seam — just replace the localStorage call with a `fetch()`. The immutable `setWorkspace` / `structuredClone` pattern stays identical.

### 6.3 Conflict Handling (Phase 1)

For the initial release, **last-write-wins**: the PUT endpoint overwrites unconditionally. This is safe for workshops where one person facilitates at a time. Add optimistic locking later if simultaneous editing becomes a requirement (compare `saved_at` on PUT, reject stale writes with `409 Conflict`).

---

## 7. Deployment

### Recommended

| Component | Platform |
|---|---|
| Supabase (Auth + Postgres) | Supabase Cloud (free tier → Pro) |
| FastAPI | Railway, Render, or Fly.io (single container, no cold-start on paid plans) |
| Frontend (static files) | Vercel, Netlify, or Cloudflare Pages |

### Environment Variables (FastAPI)

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # never exposed to browser
SUPABASE_JWT_SECRET=<jwt-secret>               # for verifying user tokens
INVITATION_TOKEN_SECRET=<random-secret>        # for signing invitation tokens
INVITATION_EXPIRY_DAYS=7
EMAIL_PROVIDER_API_KEY=<resend-or-sendgrid-key>
FRONTEND_URL=https://app.example.com
```

---

## 8. Migration Path from POC

1. **Set up Supabase project** – run `db/schema.sql`
2. **Build FastAPI skeleton** – JWT middleware, health check, empty routers
3. **Add project list screen** – before touching any phase logic
4. **Wire `persist()`** – replace localStorage write with `PUT /workspace`, keep localStorage as offline fallback
5. **Add auth screens** – login, register (Supabase JS SDK does the heavy lifting)
6. **Build invite flow** – invitation endpoint + email + accept page
7. **Export/import** – no changes needed to `export.js`; import just calls `PUT /workspace` after validation

---

## 9. Future Considerations

- **Realtime collaboration** – Supabase Realtime (websockets) can broadcast workspace updates to all connected members once simultaneous editing is needed
- **AI-assisted facilitation** – FastAPI + Python makes it straightforward to add LLM calls (suggest opportunities from Phase 1 cards, auto-draft use cases, score with reasoning)
- **Schema migration** – `workspace_history` makes it safe to evolve the workspace JSON; old snapshots remain readable under their original `schema_ver`
- **Offline mode** – keep localStorage as a write-behind cache; sync on reconnect using `saved_at` comparison
