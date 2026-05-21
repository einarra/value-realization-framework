-- =============================================================================
-- AI Value Framework – Database Schema
-- Target: Supabase (PostgreSQL 15+)
-- Auth: Supabase Auth (auth.users is managed by Supabase, not defined here)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy search on project names


-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- projects
-- One row per workshop engagement. A user can own many projects.
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);


-- -----------------------------------------------------------------------------
-- project_members
-- Covers both accepted members and pending invitations.
--   • pending:  user_id IS NULL, accepted_at IS NULL
--   • accepted: user_id IS NOT NULL, accepted_at IS NOT NULL
--
-- invited_email is always populated so we can match on sign-up.
-- role 'owner' is assigned automatically when a project is created;
-- only one owner per project (enforced at application level).
-- -----------------------------------------------------------------------------
CREATE TABLE project_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL until accepted
  invited_email   TEXT        NOT NULL CHECK (char_length(invited_email) > 0),
  role            TEXT        NOT NULL DEFAULT 'editor'
                              CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by      UUID        NOT NULL REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,                                               -- NULL = pending
  invitation_token TEXT       UNIQUE,                                        -- signed token, cleared after accept
  token_expires_at TIMESTAMPTZ,

  -- A registered user can only appear once per project
  CONSTRAINT uq_project_user   UNIQUE (project_id, user_id),
  -- An email address can only have one pending invitation per project
  CONSTRAINT uq_project_email  UNIQUE (project_id, invited_email)
);

CREATE INDEX idx_project_members_project  ON project_members(project_id);
CREATE INDEX idx_project_members_user     ON project_members(user_id);
CREATE INDEX idx_project_members_email    ON project_members(invited_email);
CREATE INDEX idx_project_members_token    ON project_members(invitation_token)
  WHERE invitation_token IS NOT NULL;


-- -----------------------------------------------------------------------------
-- workspace_data
-- One live snapshot per project, stored as a versioned JSONB blob.
-- Mirrors the existing client-side workspace JSON exactly (version: 1).
-- Use JSONB so Postgres can index and query inside the document if needed.
--
-- Structure of the data column:
-- {
--   "version": 1,
--   "workspace": { "name": "...", "createdAt": "...", "updatedAt": "..." },
--   "phase1": { "cards": [...] },
--   "phase2": { "opportunities": [...] },
--   "phase3": { "useCases": [...] },
--   "phase4": { "scores": { "<id>": { "businessValue": 1-5, "feasibility": 1-5 } } },
--   "phase5": { "roadmapItems": [...] }
-- }
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_data (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  schema_ver  INTEGER     NOT NULL DEFAULT 1,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saved_by    UUID        NOT NULL REFERENCES auth.users(id),

  CONSTRAINT uq_workspace_project UNIQUE (project_id)   -- one live snapshot per project
);

CREATE INDEX idx_workspace_data_project ON workspace_data(project_id);
-- Allow querying inside the JSON (e.g. use case names, phase counts)
CREATE INDEX idx_workspace_data_gin     ON workspace_data USING GIN (data jsonb_path_ops);


-- =============================================================================
-- AUDIT / HISTORY (optional but recommended)
-- Append-only log of every save. Enables undo, conflict detection, and
-- "last edited by" display without a full event-sourcing setup.
-- =============================================================================
CREATE TABLE workspace_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  schema_ver  INTEGER     NOT NULL DEFAULT 1,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saved_by    UUID        NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_workspace_history_project ON workspace_history(project_id, saved_at DESC);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Keep projects.updated_at current on any row update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Append to history every time workspace_data is upserted
CREATE OR REPLACE FUNCTION record_workspace_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO workspace_history (project_id, data, schema_ver, saved_at, saved_by)
  VALUES (NEW.project_id, NEW.data, NEW.schema_ver, NEW.saved_at, NEW.saved_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_history
  AFTER INSERT OR UPDATE ON workspace_data
  FOR EACH ROW EXECUTE FUNCTION record_workspace_history();


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- All tables are locked down. Access is granted only through explicit policies.
-- FastAPI authenticates with a Supabase service-role key for admin operations
-- (e.g. sending invitations). All other access uses the anon/user JWT.
-- =============================================================================

ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_history ENABLE ROW LEVEL SECURITY;


-- Helper: is the calling user a member of this project?
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id    = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

-- Helper: what is the calling user's role on this project?
CREATE OR REPLACE FUNCTION project_role(p_project_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM project_members
  WHERE project_id = p_project_id
    AND user_id    = auth.uid()
    AND accepted_at IS NOT NULL
  LIMIT 1;
$$;


-- projects: visible to members; only owner can delete
CREATE POLICY projects_select ON projects FOR SELECT
  USING (is_project_member(id));

CREATE POLICY projects_insert ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_update ON projects FOR UPDATE
  USING (project_role(id) IN ('owner', 'editor'))
  WITH CHECK (project_role(id) IN ('owner', 'editor'));

CREATE POLICY projects_delete ON projects FOR DELETE
  USING (owner_id = auth.uid());


-- project_members: members can see who else is on the project; only owner/editor can invite
CREATE POLICY members_select ON project_members FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY members_insert ON project_members FOR INSERT
  WITH CHECK (project_role(project_id) IN ('owner', 'editor'));

CREATE POLICY members_update ON project_members FOR UPDATE
  USING (project_role(project_id) = 'owner');

CREATE POLICY members_delete ON project_members FOR DELETE
  USING (project_role(project_id) = 'owner' OR user_id = auth.uid());


-- workspace_data: readable by all members; writable only by editors/owners
CREATE POLICY workspace_select ON workspace_data FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY workspace_insert ON workspace_data FOR INSERT
  WITH CHECK (project_role(project_id) IN ('owner', 'editor'));

CREATE POLICY workspace_update ON workspace_data FOR UPDATE
  USING (project_role(project_id) IN ('owner', 'editor'))
  WITH CHECK (project_role(project_id) IN ('owner', 'editor'));


-- workspace_history: read-only for all members
CREATE POLICY history_select ON workspace_history FOR SELECT
  USING (is_project_member(project_id));


-- =============================================================================
-- SEED: owner membership is created automatically when a project is inserted
-- =============================================================================
CREATE OR REPLACE FUNCTION auto_add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  owner_email TEXT;
BEGIN
  SELECT email INTO owner_email FROM auth.users WHERE id = NEW.owner_id;
  INSERT INTO project_members (project_id, user_id, invited_email, role, invited_by, accepted_at)
  VALUES (NEW.id, NEW.owner_id, owner_email, 'owner', NEW.owner_id, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_owner_member
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION auto_add_owner_as_member();
