"""
Invitation email sender.
Uses Resend when EMAIL_PROVIDER_API_KEY is configured.
Falls back to console logging in dev (when the key is still REPLACE_ME).
"""

from config import settings


def send_invitation_email(
    to_email: str,
    project_name: str,
    invitation_url: str,
    invited_by_email: str,
) -> None:
    if not settings.email_provider_api_key or settings.email_provider_api_key == "REPLACE_ME":
        # Dev fallback — print the link so it can be used manually.
        print(
            f"\n[EMAIL not configured] Invitation link for {to_email}:\n  {invitation_url}\n"
        )
        return

    import resend  # only imported when key is present

    resend.api_key = settings.email_provider_api_key
    resend.Emails.send(
        {
            "from": f"AI Value Framework <noreply@{settings.frontend_url.removeprefix('https://').removeprefix('http://')}>",
            "to": to_email,
            "subject": f'{invited_by_email} invited you to "{project_name}"',
            "html": f"""
<p>Hi,</p>
<p><strong>{invited_by_email}</strong> has invited you to collaborate on
<strong>{project_name}</strong> in the AI Value Realization Framework.</p>
<p><a href="{invitation_url}" style="
  display:inline-block;padding:0.65rem 1.2rem;background:#008751;color:#fff;
  border-radius:10px;text-decoration:none;font-weight:700">
  Accept invitation
</a></p>
<p style="color:#666;font-size:0.9rem">This link expires in {settings.invitation_expiry_days} days.</p>
""",
        }
    )
