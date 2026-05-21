from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel, EmailStr, Field
from supabase import Client

from auth import current_user
from config import settings
from db import get_db
from emailer import send_invitation_email
from routers.projects import _require_editor_or_owner, _require_member, _require_owner

router = APIRouter(tags=["members"])

VALID_ROLES = {"editor", "viewer"}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    email: EmailStr
    role: str = Field(..., pattern="^(editor|viewer)$")


class ChangeRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(editor|viewer)$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_invitation_token(project_id: str, invited_email: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.invitation_expiry_days)
    return jwt.encode(
        {"project_id": project_id, "invited_email": invited_email, "exp": exp},
        settings.invitation_token_secret,
        algorithm="HS256",
    )


def _get_member_row(db: Client, project_id: str, member_id: str) -> dict:
    result = (
        db.table("project_members")
        .select("*")
        .eq("project_id", project_id)
        .eq("id", member_id)
        .maybe_single()
        .execute()
    )
    if result is None or result.data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return result.data


def _owner_count(db: Client, project_id: str) -> int:
    result = (
        db.table("project_members")
        .select("id", count="exact")
        .eq("project_id", project_id)
        .eq("role", "owner")
        .not_.is_("accepted_at", "null")
        .execute()
    )
    return result.count or 0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/members")
def list_members(
    project_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """List all accepted members and pending invitations for a project."""
    user_id = user["sub"]
    _require_member(db, project_id, user_id)

    result = (
        db.table("project_members")
        .select("id, user_id, invited_email, role, invited_at, accepted_at, invited_by")
        .eq("project_id", project_id)
        .order("invited_at")
        .execute()
    )
    return result.data


@router.post("/projects/{project_id}/invite", status_code=status.HTTP_201_CREATED)
def invite_member(
    project_id: str,
    body: InviteRequest,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """
    Invite a collaborator by email. Idempotent: if the email already has a
    pending invitation or is an active member, returns the existing row.
    """
    user_id = user["sub"]
    _require_editor_or_owner(db, project_id, user_id)

    email = body.email.lower()

    # Idempotency check — return existing row if already invited or member.
    existing = (
        db.table("project_members")
        .select("*")
        .eq("project_id", project_id)
        .eq("invited_email", email)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        return existing.data

    # Fetch project name for the email.
    project_result = (
        db.table("projects").select("name").eq("id", project_id).single().execute()
    )
    project_name = project_result.data["name"]

    # Inviter email comes from the verified JWT payload.
    inviter_email = user.get("email", "A colleague")

    # Generate signed invitation token and expiry.
    token = _make_invitation_token(project_id, email)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=settings.invitation_expiry_days)
    ).isoformat()

    result = (
        db.table("project_members")
        .insert(
            {
                "project_id": project_id,
                "invited_email": email,
                "role": body.role,
                "invited_by": user_id,
                "invitation_token": token,
                "token_expires_at": expires_at,
            }
        )
        .execute()
    )
    row = result.data[0]

    invitation_url = f"{settings.frontend_url}/invitations.html?token={token}"
    send_invitation_email(email, project_name, invitation_url, inviter_email)

    # Include the invitation URL in the response (useful when email isn't configured).
    return {**row, "invitation_url": invitation_url}


@router.delete("/projects/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: str,
    member_id: str,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """
    Remove a member. Owners can remove anyone (except themselves if they are
    the last owner). Members can remove themselves.
    """
    user_id = user["sub"]
    caller_role = _require_member(db, project_id, user_id)
    target = _get_member_row(db, project_id, member_id)

    is_self = target["user_id"] == user_id

    if not is_self and caller_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can remove other members",
        )

    # Prevent removing the last owner.
    if target["role"] == "owner" and _owner_count(db, project_id) <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove the last owner. Transfer ownership first.",
        )

    db.table("project_members").delete().eq("id", member_id).execute()


@router.patch("/projects/{project_id}/members/{member_id}")
def change_role(
    project_id: str,
    member_id: str,
    body: ChangeRoleRequest,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """Change a member's role. Owner only. Cannot change own role."""
    user_id = user["sub"]
    _require_owner(db, project_id, user_id)
    target = _get_member_row(db, project_id, member_id)

    if target["user_id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot change your own role",
        )

    result = (
        db.table("project_members")
        .update({"role": body.role})
        .eq("id", member_id)
        .execute()
    )
    return result.data[0]
