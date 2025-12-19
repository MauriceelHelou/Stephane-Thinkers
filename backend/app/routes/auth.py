from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple password - can be set via environment variable or defaults to hardcoded value
SITE_PASSWORD = os.getenv("SITE_PASSWORD", "mauriceiloveyousomuch")


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """Simple password check - returns success if password matches."""
    if request.password == SITE_PASSWORD:
        return LoginResponse(success=True, message="Welcome!")
    else:
        raise HTTPException(status_code=401, detail="Incorrect password")


@router.get("/check")
def check_auth():
    """Check if auth is required (always true for this simple implementation)."""
    return {"auth_required": True}
