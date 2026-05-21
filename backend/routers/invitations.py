from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel
from supabase import Client

from auth import current_user
from config import settings
from db import get_db

router = APIRouter(tags=["invitations"])


class AcceptRequest(BaseModel):
    token: str


@router.post("/invitations/accept")
def accept_invitation(
    body: AcceptRequest,
    user: dict = Depends(current_user),
    db: Client = Depends(get_db),
):
    """
    Accept a project invitation.
    The caller must be authenticated. Their email must match the invited_email
    encoded in the token.
    """
    # 1. Verify token signature and expiry.
    try:
        payload = jwt.decode(
            body.token,
            settings.invitation_token_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token",
        )

    project_id: str = payload.get("project_id")
    invited_email: str = payload.get("invited_email", "").lower()

    if not project_id or not invited_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed invitation token",
        )

    # 2. Verify the logged-in user's email matches the invitation.
    caller_email = (user.get("email") or "").lower()
    if caller_email != invited_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This invitation was sent to {invited_email}. You are signed in as {caller_email}.",
        )

    # 3. Find the pending member row.
    result = (
        db.table("project_members")
        .select("*")
        .eq("project_id", project_id)
        .eq("invited_email", invited_email)
        .is_("accepted_at", "null")
        .maybe_single()
        .execute()
    )
    if result is None or result.data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already accepted",
        )
    member_row = result.data

    # 4. Check the token stored on the row still matches (covers revocation).
    if member_row.get("invitation_token") != body.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation token has been superseded or revoked",
        )

    # 5. Accept: set user_id, accepted_at, clear token fields.
    user_id = user["sub"]
    updated = (
        db.table("project_members")
        .update(
            {
                "user_id": user_id,
                "accepted_at": datetime.now(timezone.utc).isoformat(),
                "invitation_token": None,
                "token_expires_at": None,
            }
        )
        .eq("id", member_row["id"])
        .execute()
    )

    row = updated.data[0]
    return {"project_id": project_id, "role": row["role"]}
