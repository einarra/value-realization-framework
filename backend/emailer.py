"""
Invitation email sender.
Uses Supabase Auth's built-in invite_user_by_email so no external SMTP or
API keys are required — Supabase handles delivery.

The invitation_url (our JWT-based accept link) is passed as redirect_to so
the user lands on it after Supabase authenticates them.
"""

from supabase import Client


def send_invitation_email(
    db: Client,
    to_email: str,
    invitation_url: str,
) -> None:
    try:
        db.auth.admin.invite_user_by_email(
            to_email,
            options={"redirect_to": invitation_url},
        )
    except Exception as exc:
        # "User already registered" is fine — they can use the link directly.
        msg = str(exc).lower()
        if "already" in msg or "exists" in msg:
            print(f"[EMAIL] {to_email} already registered in Supabase; skipping invite email.")
        else:
            raise
