"""
health.py
=========

Endpoints de salud y estado básico del servicio.
"""
from fastapi import APIRouter

from config.constants import STORAGE_PATH

router = APIRouter()


@router.get("/health", tags=["Health"], summary="Estado del servicio")
async def health() -> dict:
    # Comprueba si el directorio de almacenamiento es accesible
    storage_ok = STORAGE_PATH.exists() and STORAGE_PATH.is_dir()
    return {
        "status": "ok" if storage_ok else "degraded",
        "storage_path": str(STORAGE_PATH),
        "storage_ready": storage_ok,
    }
