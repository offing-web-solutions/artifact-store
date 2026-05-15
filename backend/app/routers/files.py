"""
files.py
========

Endpoints de archivos, todos scoped a un bucket:

    POST   /upload/{bucket}/{path:path}    - Sube un archivo (X-API-Key del bucket)
    POST   /sign/{bucket}/{path:path}      - URL firmada temporal
    GET    /files/{bucket}/{path:path}     - Descarga (URL firmada)
    GET    /list/{bucket}                  - Lista archivos del bucket
    DELETE /files/{bucket}/{path:path}     - Borra archivo

La descarga sólo necesita firma válida en la URL. El resto requieren la
`X-API-Key` que coincida con la clave del bucket de la URL.
"""
from __future__ import annotations

import sqlite3
import time
from typing import Annotated

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, UploadFile, status
from fastapi.responses import FileResponse

from app import db
from app.helpers.auth import require_bucket_key
from app.helpers.signing import generate_signature, verify_signature
from app.helpers.storage import resolve_safe_path, bucket_dir
from config.constants import DEFAULT_EXPIRES_IN, PUBLIC_BASE_URL

router = APIRouter()

# Tamaño del bloque de lectura para subidas en streaming
_CHUNK_SIZE = 1024 * 1024  # 1 MB


@router.post(
    "/upload/{bucket}/{path:path}",
    tags=["Files"],
    summary="Sube un archivo a un bucket (sobrescribe si existe)",
)
async def upload_file(
    bucket: str,
    path: str,
    file: UploadFile = File(...),
    _: sqlite3.Row = Depends(require_bucket_key),
) -> dict:
    target = resolve_safe_path(bucket, path)
    target.parent.mkdir(parents=True, exist_ok=True)

    bytes_written = 0
    async with aiofiles.open(target, "wb") as out:
        while chunk := await file.read(_CHUNK_SIZE):
            await out.write(chunk)
            bytes_written += len(chunk)

    return {
        "bucket": bucket,
        "path": path,
        "size": bytes_written,
    }


@router.post(
    "/sign/{bucket}/{path:path}",
    tags=["Files"],
    summary="Genera una URL firmada temporal",
)
async def sign_url(
    bucket: str,
    path: str,
    expires_in: Annotated[int, Query(ge=60, le=86400)] = DEFAULT_EXPIRES_IN,
    _: sqlite3.Row = Depends(require_bucket_key),
) -> dict:
    target = resolve_safe_path(bucket, path)
    if not target.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado",
        )

    expires_at = int(time.time()) + expires_in
    signature = generate_signature(bucket, path, expires_at)
    url = f"{PUBLIC_BASE_URL}/files/{bucket}/{path}?expires={expires_at}&sig={signature}"

    return {
        "url": url,
        "expires_at": expires_at,
        "expires_in": expires_in,
    }


@router.get(
    "/files/{bucket}/{path:path}",
    tags=["Files"],
    summary="Descarga un archivo (requiere URL firmada)",
)
async def download_file(
    bucket: str,
    path: str,
    expires: int = Query(...),
    sig: str = Query(...),
):
    # Validar firma antes de cualquier lookup, para no filtrar existencia
    if not verify_signature(bucket, path, expires, sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Firma inválida o expirada",
        )

    if not db.get_bucket_by_name(bucket):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket no encontrado",
        )

    target = resolve_safe_path(bucket, path)
    if not target.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado",
        )

    return FileResponse(
        path=target,
        media_type="application/octet-stream",
        filename=target.name,
    )


@router.get(
    "/list/{bucket}",
    tags=["Files"],
    summary="Lista los archivos de un bucket",
)
async def list_files(
    bucket: str = Path(...),
    _: sqlite3.Row = Depends(require_bucket_key),
) -> dict:
    root = bucket_dir(bucket)
    if not root.exists():
        return {"bucket": bucket, "files": [], "total": 0}

    files = []
    for entry in sorted(root.rglob("*")):
        if entry.is_file():
            stat = entry.stat()
            files.append(
                {
                    "path": str(entry.relative_to(root)),
                    "size": stat.st_size,
                    "modified_at": int(stat.st_mtime),
                }
            )

    return {"bucket": bucket, "files": files, "total": len(files)}


@router.delete(
    "/files/{bucket}/{path:path}",
    tags=["Files"],
    summary="Elimina un archivo del bucket",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_file(
    bucket: str,
    path: str,
    _: sqlite3.Row = Depends(require_bucket_key),
) -> None:
    target = resolve_safe_path(bucket, path)
    if not target.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado",
        )
    target.unlink()
