"""
storage.py
==========

Utilidades para resolver rutas dentro de un bucket de forma segura,
evitando ataques de path traversal (`../`).
"""
import re
from pathlib import Path

from fastapi import HTTPException, status

from config.constants import STORAGE_PATH

# Nombres de bucket: letras minúsculas, dígitos y guiones, 3-32 chars.
# Empieza con letra, no termina con guión.
_BUCKET_NAME_RE = re.compile(r"^[a-z][a-z0-9-]{1,30}[a-z0-9]$")


def validate_bucket_name(name: str) -> None:
    if not _BUCKET_NAME_RE.match(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de bucket inválido (3-32 chars, [a-z0-9-], "
            "empieza con letra, no termina con guión)",
        )


def bucket_dir(bucket: str) -> Path:
    # Devuelve la ruta absoluta del directorio raíz del bucket.
    validate_bucket_name(bucket)
    return (STORAGE_PATH / bucket).resolve()


def resolve_safe_path(bucket: str, relative: str) -> Path:
    # Resuelve una ruta dentro del bucket, asegurándose de que no escapa.
    if not relative or relative.startswith("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ruta inválida",
        )

    root = bucket_dir(bucket)
    target = (root / relative).resolve()

    if root not in target.parents and target != root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ruta fuera del directorio permitido",
        )

    return target
