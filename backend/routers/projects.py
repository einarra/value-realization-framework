from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from auth import current_user
from db import get_db

router = APIRouter(tags=["projects"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ProjectRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_role(db: Client, project_id: str, user_id: str) -> str | None:
    """Return the caller's role on the project, or None if not a member."""
    result = (
        db.table("project_members")
        .select("role")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .not_.is_("accepted_at", "null")
        .maybe_single()
        .execute()
    )
    return result.data["role"] if result.data else None


def _require_member(db: Client, project_id: str, user_id: str) -> str:
    role = _get_role(db, project_id, user_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return role


def _require_editor_or_owner(db: Client, project_id: str, user_id: str) -> None:
    role = _require_member(db, project_id, user_id)
    if role not in ("owner", "editor"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def _require_owner(db: Client, project_id: str, user_id: str) -> None:
    role = _require_member(db, project_id, user_id)
    if role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the project owner can do this")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects")
def list_projects(user: dict = Depends(current_user), db: Client = Depends(get_db)):
    """List all projects the caller is an accepted member of."""
    user_id = user["sub"]

    memberships = (
        db.table("project_members")
        .select("role, project_id, projects(id, name, owner_id, created_at, updated_at)")
        .eq("user_id", user_id)
        .not_.is_("accepted_at", "null")
        .execute()
    )

    return [
        {
            **m["projects"],
            "role": m["role"],
        }
        for m in memberships.data
        if m.get("projects")
    ]


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """
    Create a new project. The DB trigger auto_add_owner_as_member fires and
    inserts the caller as the owner in project_members.
    """
    user_id = user["sub"]

    result = (
        db.table("projects")
        .insert({"name": body.name, "owner_id": user_id})
        .execute()
    )
    return result.data[0]


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """Return project metadata and member list. Caller must be an accepted member."""
    user_id = user["sub"]
    _require_member(db, project_id, user_id)

    project_result = (
        db.table("projects")
        .select("*")
        .eq("id", project_id)
        .single()
        .execute()
    )

    members_result = (
        db.table("project_members")
        .select("id, user_id, invited_email, role, invited_at, accepted_at")
        .eq("project_id", project_id)
        .execute()
    )

    return {
        **project_result.data,
        "members": members_result.data,
    }


@router.patch("/projects/{project_id}")
def rename_project(
    project_id: str,
    body: ProjectRename,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """Rename a project. Requires owner or editor role."""
    user_id = user["sub"]
    _require_editor_or_owner(db, project_id, user_id)

    result = (
        db.table("projects")
        .update({"name": body.name})
        .eq("id", project_id)
        .execute()
    )
    return result.data[0]


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """
    Delete a project and all related data. Owner only.
    Cascade deletes handle project_members, workspace_data, and workspace_history.
    """
    user_id = user["sub"]
    _require_owner(db, project_id, user_id)

    db.table("projects").delete().eq("id", project_id).execute()
