import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config import settings

bearer = HTTPBearer()

# Module-level JWKS cache: kid → key data dict
_jwks_cache: dict[str, dict] = {}


def _fetch_jwks() -> None:
    """Populate _jwks_cache from the Supabase JWKS endpoint."""
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=5)
    resp.raise_for_status()
    for key in resp.json().get("keys", []):
        _jwks_cache[key["kid"]] = key


def _decode_token(token: str) -> dict:
    """
    Verify a Supabase-issued JWT. Handles both:
    - ES256 (current default): verified via JWKS public key
    - HS256 (legacy):          verified via SUPABASE_JWT_SECRET
    """
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    alg = header.get("alg", "")

    if alg == "HS256":
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    if alg == "ES256":
        kid = header.get("kid")

        # Populate cache on first use or if this kid is unknown
        if kid not in _jwks_cache:
            try:
                _fetch_jwks()
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Could not fetch signing keys",
                ) from exc

        key_data = _jwks_cache.get(kid)
        if key_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unknown signing key",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            return jwt.decode(
                token,
                key_data,
                algorithms=["ES256"],
                audience="authenticated",
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Unsupported token algorithm: {alg}",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """
    FastAPI dependency. Verifies the Supabase JWT and returns the decoded payload.
    The payload contains at minimum: sub (user id), email, role.
    """
    return _decode_token(credentials.credentials)
