"""
main.py
=======

Entrada principal de la aplicación FastAPI.
"""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app import db
from app.routers import admin, files, health
from config.constants import ALLOWED_ORIGINS, ENVIRONMENT, ROOT_PATH, STORAGE_PATH

# Asegura que el directorio de almacenamiento exista y arranca la BD
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
db.init_schema()

app = FastAPI(
    title="artifact-store",
    version="0.1.1",
    root_path=ROOT_PATH,
)

# Habilitar el servidor de depuración solo en desarrollo
if ENVIRONMENT == "local":
    import debugpy
    debugpy.listen(("localhost", 5688))

origins = ["*"] if ENVIRONMENT == "local" else ALLOWED_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(admin.router)
app.include_router(files.router)


# --- Frontend (SPA build) -------------------------------------------------
# El frontend Vite se construye en frontend/dist/. En dev, se usa el dev server
# de Vite (:5173 con proxy a este servicio). En prod, FastAPI sirve el build.

# Resolución de frontend/dist:
#   - Modo PyInstaller: variable AS_FRONTEND_DIST inyectada por scripts/run.py
#   - Modo normal: ../../frontend/dist relativo a este archivo
_env_dist = os.environ.get("AS_FRONTEND_DIST")
_frontend_dist = Path(_env_dist) if _env_dist else (
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
)

# Prefijos reservados para el backend; el catch-all NO debe servir el SPA
# para estos paths (deben dar 404 si no matchean ningún router).
_API_PREFIXES = (
    "admin/", "upload/", "sign/", "list/", "files/",
    "health", "openapi.json", "docs", "redoc",
)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if any(full_path == p.rstrip("/") or full_path.startswith(p) for p in _API_PREFIXES):
        raise HTTPException(status_code=404)

    if not _frontend_dist.exists():
        return JSONResponse(
            {"detail": "Frontend no construido. Ejecuta 'pnpm -C frontend build' "
                       "o usa el dev server de Vite (:5173)."},
            status_code=503,
        )

    asset = _frontend_dist / full_path
    if full_path and asset.is_file():
        return FileResponse(asset)
    return FileResponse(_frontend_dist / "index.html")
