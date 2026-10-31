from __future__ import annotations

import os
import re
from datetime import date
from pathlib import PurePath
from urllib.parse import quote
from uuid import uuid4

import httpx


MAX_INVOICE_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_FILE_TYPES = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".jpg": ("image/jpeg", b"\xff\xd8\xff"),
    ".jpeg": ("image/jpeg", b"\xff\xd8\xff"),
    ".png": ("image/png", b"\x89PNG\r\n\x1a\n"),
}


def validate_invoice_file(filename: str, content_type: str, content: bytes) -> str:
    extension = PurePath(filename).suffix.lower()
    allowed = ALLOWED_FILE_TYPES.get(extension)
    if allowed is None:
        raise ValueError("Invoice attachments must be PDF, JPG, or PNG files.")
    expected_type, signature = allowed
    normalized_type = content_type.split(";", 1)[0].strip().lower()
    if normalized_type != expected_type:
        raise ValueError("Invoice attachment content type does not match its file extension.")
    if not content:
        raise ValueError("Invoice attachment cannot be empty.")
    if len(content) > MAX_INVOICE_FILE_SIZE:
        raise ValueError("Invoice attachment must be 10 MB or smaller.")
    if not content.startswith(signature):
        raise ValueError("Invoice attachment contents do not match the selected file type.")
    return expected_type


def _storage_config() -> tuple[str, str, str]:
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_INVOICE_BUCKET", "invoice-documents").strip()
    if not base_url or not service_key or not bucket:
        raise RuntimeError(
            "Invoice attachment storage is not configured. Set SUPABASE_URL, "
            "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_INVOICE_BUCKET."
        )
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+", base_url):
        raise RuntimeError("SUPABASE_URL must be an HTTPS Supabase project URL.")
    return base_url, service_key, bucket


def upload_invoice_file(filename: str, content_type: str, content: bytes) -> str:
    validated_type = validate_invoice_file(filename, content_type, content)
    base_url, service_key, bucket = _storage_config()
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }
    bucket_url = f"{base_url}/storage/v1/bucket/{quote(bucket, safe='')}"
    try:
        bucket_response = httpx.get(bucket_url, headers=headers, timeout=15)
        if bucket_response.status_code == 404:
            raise RuntimeError(
                f"Private Supabase Storage bucket '{bucket}' does not exist. Create it with public access disabled."
            )
        bucket_response.raise_for_status()
        bucket_details = bucket_response.json()
        if bucket_details.get("public") is not False:
            raise RuntimeError(
                f"Supabase Storage bucket '{bucket}' must be private before invoice uploads are enabled."
            )

        extension = PurePath(filename).suffix.lower()
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", PurePath(filename).name)[:120]
        object_path = f"invoices/{date.today().isoformat()}/{uuid4().hex}_{safe_name}"
        object_url = (
            f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/"
            f"{quote(object_path, safe='/')}"
        )
        response = httpx.post(
            object_url,
            headers={
                **headers,
                "Content-Type": validated_type,
                "x-upsert": "false",
            },
            content=content,
            timeout=30,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(
            "Supabase Storage could not save the invoice attachment."
        ) from exc
    return object_path
