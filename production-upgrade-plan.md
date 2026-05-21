# Production Upgrade Plan: localStorage → Supabase + FastAPI

**Status:** Ready to implement  
**Date:** 2026-05-21  
**Based on:** `solution-design.md`

---

## Current State

| What | State |
|---|---|
| Frontend (vanilla JS, 6 phase renderers) | Done — fully functional |
| Database schema (`db/schema.sql`) | Written — not yet applied to Supabase |
| Supabase project | Live at `uhkrspeeqdjjbzveibir.supabase.co` |
| FastAPI backend | Not started |
| Auth screens | Not started |
| Project list UI | Not started |

The migration path below follows the order in `solution-design.md §8`. Each step is independently deployable and keeps the app working at every stage.

---

## Step 1 — Apply database schema

**Goal:** Tables and RLS policies live in Supabase Postgres.

**What to do:**
- Run `db/schema.sql` against the Supabase project via `mcp__supabase__apply_migration` or the Supabase dashboard SQL editor.
- Verify all 4 tables appear: `projects`, `project_members`, `workspace_data`, `workspace_history`.
- Verify RLS is enabled on all tables.
- Verify the 3 triggers are present: `update_updated_at`, `record_workspace_history`, `auto_add_owner_as_member`.

**Files touched:** none in the app — DB only.

**Done when:** `list_tables` shows all 4 tables with `rls_enabled: true`.

---

## Step 2 — Build FastAPI skeleton

**Goal:** A running Python server with JWT middleware and a health check. No business logic yet.

### Create project structure

```
backend/
├── main.py                 # FastAPI app, CORS, router registration
├── auth.py                 # JWT verification middleware / dependency
├── db.py                   # Supabase service-role client
├── config.py               # Settings from environment variables
├── routers/
│   ├── projects.py         # Empty router, /api/v1/projects stubs
│   ├── workspace.py        # Empty router, /api/v1/projects/{id}/workspace stubs
│   ├── members.py          # Empty router, /api/v1/projects/{id}/members stubs
│   └── invitations.py      # Empty router, /invitations/accept stub
└── requirements.txt
```

### `requirements.txt`
```
fastapi
uvicorn[standard]
supabase
python-jose[cryptography]
httpx
resend                      # or sendgrid — for invitation emails
python-dotenv
```

### `config.py` — reads environment variables
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    invitation_token_secret: str
    invitation_expiry_days: int = 7
    email_provider_api_key: str
    frontend_url: str

    class Config:
        env_file = ".env"

settings = Settings()
```

### `auth.py` — FastAPI dependency that verifies Supabase JWT
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from config import settings

bearer = HTTPBearer()

async def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload  # contains sub (user id), email, etc.
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
```

### `main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import projects, workspace, members, invitations
from config import settings

app = FastAPI(title="AI Value Framework API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1")
app.include_router(workspace.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1")
app.include_router(invitations.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

### Backend `.env`
```
SUPABASE_URL=https://uhkrspeeqdjjbzveibir.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API>
SUPABASE_JWT_SECRET=<get from Supabase dashboard → Settings → API → JWT Secret>
INVITATION_TOKEN_SECRET=<generate: python -c "import secrets; print(secrets.token_hex(32))">
INVITATION_EXPIRY_DAYS=7
EMAIL_PROVIDER_API_KEY=<Resend or SendGrid API key>
FRONTEND_URL=http://localhost:8080
```

**Done when:** `GET /health` returns `{"status": "ok"}`.

---

## Step 3 — Implement project CRUD endpoints

**Goal:** Owner can create, list, rename, and delete projects.

### `routers/projects.py`

```
GET    /projects                    → list all projects caller is member of
POST   /projects                    → create project (caller becomes owner via DB trigger)
GET    /projects/{id}               → project metadata + member list
PATCH  /projects/{id}               → rename (owner or editor)
DELETE /projects/{id}               → delete project + all data (owner only)
```

**Implementation notes:**
- All endpoints use `current_user` dependency.
- Use service-role Supabase client from `db.py` — bypass RLS, enforce auth in Python.
- `POST /projects` inserts into `projects` table. The `auto_add_owner_as_member` trigger automatically adds the creator as owner in `project_members`.
- `GET /projects` queries `project_members` joining `projects` where `user_id = auth.uid()` and `accepted_at IS NOT NULL`.
- `DELETE /projects/{id}` checks role = `owner` before deleting. Cascade deletes handle related rows.

**Done when:** Can create a project, list it, rename it, and delete it via API calls.

---

## Step 4 — Implement workspace endpoints

**Goal:** Frontend can load and save workspace JSON through the API instead of localStorage.

### `routers/workspace.py`

```
GET  /projects/{id}/workspace       → return workspace_data.data for project
PUT  /projects/{id}/workspace       → upsert workspace_data.data (last-write-wins)
GET  /projects/{id}/history         → list workspace_history rows (timestamp + saved_by)
GET  /projects/{id}/history/{hid}   → return historical snapshot
```

**Implementation notes:**
- `GET /workspace` returns `null` with 404 if no snapshot saved yet (first open).
- `PUT /workspace` accepts the same JSON shape that `buildExportPayload()` produces — the raw workspace object (not the wrapper). Use `ON CONFLICT (project_id) DO UPDATE`.
- The `record_workspace_history` trigger fires automatically on update, populating `workspace_history`.
- Validate `schema_ver` on PUT. Reject unknown versions with `422`.
- Authorization: membership check + role check before any read or write.

**Done when:** Can `PUT` a workspace snapshot and retrieve it with `GET`.

---

## Step 5 — Wire the frontend to the API

**Goal:** `persist()` and `loadWorkspace()` talk to the API. localStorage remains as an offline fallback.

### Changes to `js/storage.js`

Add API-backed save and load alongside existing localStorage functions:

```javascript
// New: save to API (called after successful auth)
export async function saveWorkspaceRemote(projectId, workspace, token) {
  const res = await fetch(`/api/v1/projects/${projectId}/workspace`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(workspace)
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return workspace;
}

// New: load from API
export async function loadWorkspaceRemote(projectId, token) {
  const res = await fetch(`/api/v1/projects/${projectId}/workspace`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 404) return null;  // no snapshot yet
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  return res.json();
}
```

### Changes to `js/app.js`

Replace `persist()` to save both locally and remotely (localStorage as write-behind fallback):

```javascript
async function persist() {
  state.workspace = saveWorkspace(state.workspace);           // localStorage (keep)
  setStatus('Saving…');
  try {
    if (state.projectId && state.token) {
      await saveWorkspaceRemote(state.projectId, state.workspace, state.token);
      setStatus(`Saved ${new Date().toLocaleTimeString()}`);
    } else {
      setStatus(`Saved locally ${new Date().toLocaleTimeString()}`);
    }
  } catch (e) {
    setStatus('Save failed — kept locally');
    console.error(e);
  }
  render();
}
```

Extend `state` to carry auth context:
```javascript
const state = {
  workspace: loadWorkspace(),
  activePhase: 'intro',
  projectId: null,    // set when a project is opened
  token: null         // Supabase JWT, set after login
};
```

**Done when:** Opening a project loads from the API; edits save to the API within ~2 s.

---

## Step 6 — Add authentication screens

**Goal:** Users can register, log in, and log out. JWT is obtained and stored in memory.

### Add Supabase JS SDK to the frontend

Add to `index.html` (or load via npm if bundling later):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Create `js/auth.js`:
```javascript
const SUPABASE_URL = 'https://uhkrspeeqdjjbzveibir.supabase.co';
const SUPABASE_ANON_KEY = '<anon key from .env>';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;   // session.access_token is the JWT
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
```

### New HTML screens

Create `login.html`, `register.html`, and `projects.html` as standalone pages (not SPA routes — simplest approach for vanilla JS):

**`projects.html`** — project list screen:
- On load: call `getSession()`. If no session, redirect to `login.html`.
- Fetch `GET /api/v1/projects` with JWT.
- Render list of projects with "Open" button.
- "New Project" button → `POST /api/v1/projects` → redirect to `index.html?project=<id>`.

**`login.html`** — login form:
- Email + password form.
- On submit: call `signIn()`, store session token in `sessionStorage`.
- Redirect to `projects.html`.

**`register.html`** — registration form:
- Email + password form.
- On submit: call `signUp()`.
- Show "Check your email" confirmation.

### Changes to `index.html`

Add to app startup in `app.js`:
```javascript
const session = await getSession();
if (!session) {
  window.location.href = '/login.html';
}
const projectId = new URLSearchParams(window.location.search).get('project');
state.token = session.access_token;
state.projectId = projectId;

// Load from API if we have a project context
if (projectId) {
  const remote = await loadWorkspaceRemote(projectId, session.access_token);
  if (remote) state.workspace = remote;
}
```

**Done when:** Users can register, log in, see their project list, and open a project.

---

## Step 7 — Project settings + member management

**Goal:** Owners and editors can invite collaborators by email.

### New screen: `settings.html` (or a panel within `index.html`)

- Shows project name (editable for owner/editor).
- Lists current members with roles.
- "Invite by email" form: input + role selector (editor/viewer) + send button.
- "Remove member" button (owner only).

### Wire to API endpoints

```
GET    /projects/{id}/members        → populate member list
POST   /projects/{id}/invite         → send invitation
DELETE /projects/{id}/members/{uid}  → remove member
PATCH  /projects/{id}/members/{uid}  → change role
```

### Implement `routers/members.py`

**Invite flow (backend):**
1. Check caller is owner or editor.
2. Insert `project_members` row: `user_id=NULL`, `accepted_at=NULL`, `invited_email=email`, `role=role`.
3. Generate invitation JWT: `jose.jwt.encode({ project_id, invited_email, exp: now + 7 days }, INVITATION_TOKEN_SECRET)`.
4. Store `token_hash` (SHA-256 of token) + `token_expires_at` on the row.
5. Send email via Resend/SendGrid with link: `{FRONTEND_URL}/invitations/accept?token=<token>`.
6. Return `201` with member row data.

### Create `invitations.html`

- On load: extract `token` from query string.
- If not logged in: redirect to `login.html?next=/invitations/accept?token=...`.
- Call `POST /invitations/accept { token }`.
- On success: redirect to the project page.

### Implement `routers/invitations.py`

```
POST /invitations/accept
```
- No auth required (public endpoint).
- Requires `Authorization` header with logged-in user's JWT (to verify identity).
- Verify invitation token signature + expiry.
- Extract `{ project_id, invited_email }`.
- Check logged-in user's email matches `invited_email`.
- Update `project_members`: set `user_id = caller.sub`, `accepted_at = NOW()`, clear `invitation_token`.
- Return `{ project_id, role }`.

**Done when:** Inviting a colleague sends an email, they click the link, accept, and can open the shared project.

---

## Step 8 — Export/import: no changes needed

The existing `export.js` functions are untouched. Export still generates a local JSON file. Import calls `parseWorkspaceJson()` to validate, then the result is sent to `PUT /projects/{id}/workspace` instead of localStorage. This single line change in the import handler in `app.js` is the only edit needed.

---

## Step 9 — Deployment

### Backend (FastAPI)

Deploy to Railway, Render, or Fly.io as a single container.

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Set environment variables in the platform dashboard (never commit to git).

### Frontend (static files)

Deploy `index.html`, `login.html`, `register.html`, `projects.html`, `settings.html`, `invitations.html`, `js/`, and `css/` to Vercel, Netlify, or Cloudflare Pages.

Update `FRONTEND_URL` in the backend `.env` to match the deployed domain.

Update `CORS` origins in `main.py` to match the deployed domain.

---

## Environment Variables Reference

### Backend (`backend/.env`)
```
SUPABASE_URL=https://uhkrspeeqdjjbzveibir.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase dashboard → Settings → API → service_role>
SUPABASE_JWT_SECRET=<Supabase dashboard → Settings → API → JWT Secret>
INVITATION_TOKEN_SECRET=<generate locally: python -c "import secrets; print(secrets.token_hex(32))">
INVITATION_EXPIRY_DAYS=7
EMAIL_PROVIDER_API_KEY=<Resend or SendGrid API key>
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (`js/auth.js` constants — safe for browser)
```
SUPABASE_URL=https://uhkrspeeqdjjbzveibir.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (anon key, not secret)
```

---

## Implementation Order (recommended)

| # | Step | Effort | Unblocks |
|---|---|---|---|
| 1 | Apply DB schema | 10 min | Everything |
| 2 | FastAPI skeleton + health check | 1–2 h | Steps 3–7 |
| 3 | Project CRUD endpoints | 2–3 h | Steps 4–7 |
| 4 | Workspace endpoints | 1–2 h | Step 5 |
| 5 | Wire frontend to API | 2–3 h | Step 6 |
| 6 | Auth screens (login/register/projects) | 3–4 h | Step 7 |
| 7 | Member management + invitations | 3–4 h | — |
| 8 | Export/import wiring | 30 min | — |
| 9 | Deployment | 1–2 h | — |

---

## What is NOT changing

- All 6 phase renderers (`phases/*.js`) — zero changes
- `schema.js` (data model, validation, `createDefaultWorkspace`)
- `export.js` (`buildExportPayload`, `parseWorkspaceJson`, `downloadJson`)
- `dom.js` (DOM utilities)
- `css/styles.css`
- The immutable `setWorkspace` / `structuredClone` update pattern
- localStorage continues to work as an offline fallback

The migration is purely additive around the existing core logic.
