"""
Cloud storage abstraction for backup offsite copy.

Provides a unified interface with two backends:
  - LocalFileBackend: copies artifacts to a separate local directory (dev/test)
  - R2Backend: pushes artifacts to Cloudflare R2 (S3-compatible) with retention support

The active backend is determined by the BACKUP_CLOUD_BACKEND env var.
"""
import logging
import os
import shutil
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Optional

logger = logging.getLogger(__name__)


class CloudStorageBackend(ABC):
    """Abstract interface for offsite backup storage."""

    @abstractmethod
    def push(self, local_path: str, remote_key: str) -> dict:
        """Upload a local file to remote storage. Returns metadata dict."""

    @abstractmethod
    def pull(self, remote_key: str, local_dest: str) -> str:
        """Download a remote file to a local path. Returns the local path."""

    @abstractmethod
    def list_objects(self, prefix: str = "") -> List[dict]:
        """List objects in remote storage. Returns list of {key, size, last_modified}."""

    @abstractmethod
    def exists(self, remote_key: str) -> bool:
        """Check if a remote object exists."""


class LocalFileBackend(CloudStorageBackend):
    """Copy-based backend for development and testing.

    Simulates offsite storage by copying files to a separate directory.
    """

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or os.getenv("BACKUP_CLOUD_LOCAL_DIR", "./data/backups/offsite")
        os.makedirs(self.base_dir, exist_ok=True)

    def push(self, local_path: str, remote_key: str) -> dict:
        dest = os.path.join(self.base_dir, remote_key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(local_path, dest)
        size = os.path.getsize(dest)
        logger.info("LocalFileBackend: copied %s -> %s (%d bytes)", local_path, dest, size)
        return {
            "backend": "local",
            "key": remote_key,
            "size_bytes": size,
            "pushed_at": datetime.now(timezone.utc).isoformat(),
        }

    def pull(self, remote_key: str, local_dest: str) -> str:
        src = os.path.join(self.base_dir, remote_key)
        if not os.path.exists(src):
            raise FileNotFoundError(f"Remote object not found: {remote_key}")
        os.makedirs(os.path.dirname(local_dest), exist_ok=True)
        shutil.copy2(src, local_dest)
        return local_dest

    def list_objects(self, prefix: str = "") -> List[dict]:
        results = []
        for root, _dirs, files in os.walk(self.base_dir):
            for name in files:
                full = os.path.join(root, name)
                key = os.path.relpath(full, self.base_dir)
                if prefix and not key.startswith(prefix):
                    continue
                stat = os.stat(full)
                results.append({
                    "key": key,
                    "size": stat.st_size,
                    "last_modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                })
        return results

    def exists(self, remote_key: str) -> bool:
        return os.path.exists(os.path.join(self.base_dir, remote_key))


class R2Backend(CloudStorageBackend):
    """Cloudflare R2 (S3-compatible) backend for production offsite backups."""

    def __init__(self):
        import boto3

        self.bucket_name = os.getenv("R2_BUCKET_NAME", "stephane-thinkers-backups")
        self.endpoint_url = os.getenv("R2_ENDPOINT_URL", "")
        self.access_key = os.getenv("R2_ACCESS_KEY_ID", "")
        self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY", "")

        if not self.endpoint_url:
            raise RuntimeError("R2_ENDPOINT_URL is not configured")
        if not self.access_key or not self.secret_key:
            raise RuntimeError("R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are not configured")

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="auto",
        )

    def push(self, local_path: str, remote_key: str) -> dict:
        size = os.path.getsize(local_path)
        self.client.upload_file(local_path, self.bucket_name, remote_key)
        logger.info("R2Backend: uploaded %s -> s3://%s/%s (%d bytes)", local_path, self.bucket_name, remote_key, size)
        return {
            "backend": "r2",
            "bucket": self.bucket_name,
            "key": remote_key,
            "size_bytes": size,
            "pushed_at": datetime.now(timezone.utc).isoformat(),
        }

    def pull(self, remote_key: str, local_dest: str) -> str:
        os.makedirs(os.path.dirname(local_dest), exist_ok=True)
        self.client.download_file(self.bucket_name, remote_key, local_dest)
        logger.info("R2Backend: downloaded s3://%s/%s -> %s", self.bucket_name, remote_key, local_dest)
        return local_dest

    def list_objects(self, prefix: str = "") -> List[dict]:
        results = []
        paginator = self.client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
        for page in pages:
            for obj in page.get("Contents", []):
                results.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat() if obj.get("LastModified") else None,
                })
        return results

    def exists(self, remote_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=remote_key)
            return True
        except Exception:
            return False


def get_cloud_backend() -> CloudStorageBackend:
    """Factory: return the configured cloud storage backend."""
    backend_type = os.getenv("BACKUP_CLOUD_BACKEND", "local").lower()
    if backend_type == "r2":
        return R2Backend()
    if backend_type == "local":
        return LocalFileBackend()
    raise RuntimeError(f"Unsupported BACKUP_CLOUD_BACKEND '{backend_type}'")
