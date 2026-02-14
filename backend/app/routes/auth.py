from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import hmac

from app.security import (
    get_auth_token_ttl_seconds,
    get_site_password,
    is_auth_required,
    issue_auth_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    token: str | None = None


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """Password check that returns a bearer token for API access."""
    if not is_auth_required():
        return LoginResponse(success=True, message="Authentication is disabled", token=None)

    site_password = get_site_password()
    if not site_password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is enabled but SITE_PASSWORD is not configured.",
        )

    if not hmac.compare_digest(request.password, site_password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    return LoginResponse(success=True, message="Welcome!", token=issue_auth_token())


@router.get("/check")
def check_auth():
    """Check if auth is required and properly configured."""
    auth_required = is_auth_required()
    response = {
        "auth_required": auth_required,
        "configured": bool(get_site_password()) if auth_required else True,
    }
    if auth_required:
        response["token_ttl_seconds"] = get_auth_token_ttl_seconds()
    return response
