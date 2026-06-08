"""
Backup manifest creation and HMAC signing/verification.

Uses HMAC-SHA256 with a configurable secret and key ID for rotation support.
"""
import hashlib
import hmac
import json
import os
from typing import Dict, Any, Optional


def _get_signing_secret() -> str:
    secret = os.getenv("BACKUP_SIGNING_SECRET", "")
    if not secret:
        raise RuntimeError("BACKUP_SIGNING_SECRET is not configured")
    return secret


def _get_key_id() -> str:
    """Return a key identifier for the current signing key.

    This allows future key rotation — manifests record which key signed them.
    """
    return os.getenv("BACKUP_SIGNING_KEY_ID", "v1")


def _get_verification_secret(key_id: Optional[str] = None) -> str:
    """
    Resolve verification secret for the provided key ID.

    Supports a simple key ring via BACKUP_SIGNING_SECRETS:
      "v1:secret-one,v2:secret-two"
    """
    if key_id:
        raw_key_ring = os.getenv("BACKUP_SIGNING_SECRETS", "")
        if raw_key_ring:
            for pair in raw_key_ring.split(","):
                if ":" not in pair:
                    continue
                candidate_key_id, secret = pair.split(":", 1)
                if candidate_key_id.strip() == key_id and secret:
                    return secret.strip()

    return _get_signing_secret()


def compute_file_checksum(file_path: str) -> str:
    """Compute SHA-256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def compute_bytes_checksum(data: bytes) -> str:
    """Compute SHA-256 checksum of bytes."""
    return hashlib.sha256(data).hexdigest()


def build_manifest(
    *,
    backup_run_id: str,
    file_path: str,
    checksum_sha256: str,
    size_bytes: int,
    total_rows: int,
    exported_at: str,
) -> Dict[str, Any]:
    """Build a manifest dict for a backup artifact."""
    return {
        "backup_run_id": backup_run_id,
        "file_path": file_path,
        "checksum_sha256": checksum_sha256,
        "size_bytes": size_bytes,
        "total_rows": total_rows,
        "exported_at": exported_at,
    }


def sign_manifest(manifest: Dict[str, Any], secret: Optional[str] = None) -> tuple[str, str]:
    """Sign a manifest dict with HMAC-SHA256.

    Returns (signature_hex, key_id).
    """
    if secret is None:
        secret = _get_signing_secret()
    key_id = _get_key_id()

    # Canonical JSON serialization for deterministic signing
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()
    return signature, key_id


def verify_manifest_signature(
    manifest: Dict[str, Any],
    signature: str,
    secret: Optional[str] = None,
    key_id: Optional[str] = None,
) -> bool:
    """Verify a manifest's HMAC-SHA256 signature."""
    if secret is None:
        secret = _get_verification_secret(key_id=key_id)

    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_file_checksum(file_path: str, expected_checksum: str) -> bool:
    """Verify a file's SHA-256 checksum."""
    actual = compute_file_checksum(file_path)
    return hmac.compare_digest(actual, expected_checksum)
