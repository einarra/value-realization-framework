from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from auth import current_user
from db import get_db
from routers.projects import _require_editor_or_owner, _require_member

router = APIRouter(tags=["workspace"])

SUPPORTED_SCHEMA_VERSIONS = {1}


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class WorkspaceSave(BaseModel):
    version: int = Field(..., ge=1)
    workspace: dict
    phase1: dict
    phase2: dict
    phase3: dict
    phase4: dict
    phase5: dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/workspace")
def get_workspace(
    project_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """Return the current workspace snapshot. 404 if none has been saved yet."""
    user_id = user["sub"]
    _require_member(db, project_id, user_id)

    result = (
        db.table("workspace_data")
        .select("data, schema_ver, saved_at, saved_by")
        .eq("project_id", project_id)
        .maybe_single()
        .execute()
    )

    if result is None or result.data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No workspace saved for this project yet",
        )

    return result.data


@router.put("/projects/{project_id}/workspace")
def save_workspace(
    project_id: str,
    body: WorkspaceSave,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """
    Upsert the full workspace snapshot (last-write-wins).
    The record_workspace_history trigger fires automatically on every upsert.
    """
    user_id = user["sub"]
    _require_editor_or_owner(db, project_id, user_id)

    if body.version not in SUPPORTED_SCHEMA_VERSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported schema version: {body.version}. Supported: {sorted(SUPPORTED_SCHEMA_VERSIONS)}",
        )

    now = datetime.now(timezone.utc).isoformat()

    result = (
        db.table("workspace_data")
        .upsert(
            {
                "project_id": project_id,
                "data": body.model_dump(),
                "schema_ver": body.version,
                "saved_at": now,
                "saved_by": user_id,
            },
            on_conflict="project_id",
        )
        .execute()
    )

    return result.data[0]


@router.get("/projects/{project_id}/history")
def list_history(
    project_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """List save history entries (newest first). Returns timestamp and saved_by, not the full data."""
    user_id = user["sub"]
    _require_member(db, project_id, user_id)

    result = (
        db.table("workspace_history")
        .select("id, schema_ver, saved_at, saved_by")
        .eq("project_id", project_id)
        .order("saved_at", desc=True)
        .execute()
    )

    return result.data


@router.get("/projects/{project_id}/history/{history_id}")
def get_history_snapshot(
    project_id: str,
    history_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """Return a specific historical snapshot by its id."""
    user_id = user["sub"]
    _require_member(db, project_id, user_id)

    result = (
        db.table("workspace_history")
        .select("id, data, schema_ver, saved_at, saved_by")
        .eq("project_id", project_id)
        .eq("id", history_id)
        .maybe_single()
        .execute()
    )

    if result is None or result.data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History snapshot not found",
        )

    return result.data
