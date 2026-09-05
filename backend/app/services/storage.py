"""Storage abstraction: local filesystem or S3-compatible object storage."""
import hashlib
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings

LOCAL_STATIC_PATH = Path(settings.LOCAL_UPLOAD_DIR)


class StorageBackend(ABC):
    @abstractmethod
    def save(self, fileobj: BinaryIO, folder: str, ext: str) -> tuple[str, str, int]:
        """Persist file; return (storage_key, sha256, size_bytes)."""

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def get_path(self, key: str) -> Path: ...

    @abstractmethod
    def public_url(self, key: str) -> str: ...


class LocalStorage(StorageBackend):
    def save(self, fileobj: BinaryIO, folder: str, ext: str) -> tuple[str, str, int]:
        LOCAL_STATIC_PATH.mkdir(parents=True, exist_ok=True)
        folder_dir = LOCAL_STATIC_PATH / folder
        folder_dir.mkdir(parents=True, exist_ok=True)
        key = f"{folder}/{uuid.uuid4().hex}{ext}"
        dest = LOCAL_STATIC_PATH / key

        digest = hashlib.sha256()
        size = 0
        with dest.open("wb") as out:
            while chunk := fileobj.read(1024 * 1024):
                digest.update(chunk)
                out.write(chunk)
                size += len(chunk)
        return key, digest.hexdigest(), size

    def delete(self, key: str) -> None:
        path = LOCAL_STATIC_PATH / key
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    def get_path(self, key: str) -> Path:
        return LOCAL_STATIC_PATH / key

    def public_url(self, key: str) -> str:
        return f"{settings.BASE_URL}/static/uploads/{key}"


class S3Storage(StorageBackend):
    def __init__(self) -> None:
        import boto3  # lazy import so local dev has no AWS dependency

        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

    def save(self, fileobj: BinaryIO, folder: str, ext: str) -> tuple[str, str, int]:
        import io

        digest = hashlib.sha256()
        buffer = io.BytesIO()
        size = 0
        while chunk := fileobj.read(1024 * 1024):
            digest.update(chunk)
            buffer.write(chunk)
            size += len(chunk)
        key = f"{folder}/{uuid.uuid4().hex}{ext}"
        buffer.seek(0)
        self.client.upload_fileobj(buffer, self.bucket, key)
        return key, digest.hexdigest(), size

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except Exception:
            pass

    def get_path(self, key: str) -> Path:
        raise NotImplementedError("Download via signed URL")

    def public_url(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=3600
        )


def get_storage() -> StorageBackend:
    if settings.STORAGE_BACKEND == "s3":
        return S3Storage()
    return LocalStorage()