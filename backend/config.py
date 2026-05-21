from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    invitation_token_secret: str
    invitation_expiry_days: int = 7
    # Optional — if unset or REPLACE_ME, invitation emails fall back to console logging.
    email_provider_api_key: str = ""
    # Comma-separated list of allowed CORS origins, e.g.:
    #   http://localhost:8080,https://your-app.vercel.app
    frontend_url: str

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    model_config = {"env_file": ".env"}


settings = Settings()
