import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


_bearer_scheme = HTTPBearer(auto_error=False)


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return max(parsed, minimum)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padded = data + "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _current_epoch_seconds() -> int:
    return int(time.time())


def is_auth_required() -> bool:
    """Whether API authentication is enforced."""
    return _env_flag("AUTH_REQUIRED", True)


def is_auth_bypass_for_tests_enabled() -> bool:
    """Allow tests to bypass auth checks without rewriting all fixtures."""
    # Never allow bypass in non-test environments, even if env var is set.
    if os.getenv("ENVIRONMENT", "development") != "test":
        return False
    return _env_flag("AUTH_BYPASS_FOR_TESTS", False)


def get_site_password() -> Optional[str]:
    return os.getenv("SITE_PASSWORD")


def get_auth_token_ttl_seconds() -> int:
    return _env_int("AUTH_TOKEN_TTL_SECONDS", 60 * 60 * 8, minimum=60)


def _get_token_secret() -> Optional[str]:
    # Prefer dedicated secret, fallback to SITE_PASSWORD for compatibility.
    return os.getenv("AUTH_TOKEN_SECRET") or get_site_password()


def issue_auth_token(subject: str = "site-user") -> str:
    """
    Issue a signed bearer token with expiration.

    Token format: base64url(payload).base64url(hmac_sha256_signature)
    """
    secret = _get_token_secret()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication is misconfigured: token secret is not set.",
        )

    now = _current_epoch_seconds()
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + get_auth_token_ttl_seconds(),
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url_encode(payload_json)
    signature = hmac.new(
        secret.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64url_encode(signature)
    return f"{payload_b64}.{signature_b64}"


def is_auth_token_valid(token: str) -> bool:
    if not token:
        return False

    parts = token.split(".")
    if len(parts) != 2:
        return False

    payload_b64, signature_b64 = parts

    secret = _get_token_secret()
    if not secret:
        return False

    try:
        provided_signature = _b64url_decode(signature_b64)
    except Exception:
        return False

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()

    if not hmac.compare_digest(provided_signature, expected_signature):
        return False

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        return False

    exp = payload.get("exp")
    if not isinstance(exp, int):
        return False

    now = _current_epoch_seconds()
    if exp <= now:
        return False

    return True


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> None:
    """Dependency that enforces bearer auth on protected routes."""
    if is_auth_bypass_for_tests_enabled():
        return

    if not is_auth_required():
        return

    if not get_site_password():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication is misconfigured: SITE_PASSWORD is not set.",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    if not is_auth_token_valid(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
