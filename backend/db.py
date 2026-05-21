from supabase import Client, create_client

from config import settings

# Service-role client — bypasses RLS.
# Authorization is enforced in the FastAPI layer, never expose this to the browser.
_client: Client | None = None


def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client
