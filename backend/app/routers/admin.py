"""
admin.py
========

Endpoints de administración del panel:

    GET    /admin/setup-needed              - ¿Hay que crear admin?
    POST   /admin/setup                     - Crea el primer admin (sólo si no hay)
    POST   /admin/login                     - Login (set-cookie)
    POST   /admin/logout                    - Logout
    GET    /admin/me                        - Info del admin actual
    GET    /admin/buckets                   - Lista buckets
    POST   /admin/buckets                   - Crea bucket
    DELETE /admin/buckets/{name}            - Borra bucket (con archivos)
    POST   /admin/buckets/{name}/regenerate - Regenera la API key

Todas las rutas excepto setup-needed/setup/login requieren cookie de sesión.
"""
from __future__ import annotations

import secrets
import shutil
import sqlite3

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app import db
from app.helpers import storage
from app.helpers.auth import (
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    create_session,
    hash_password,
    require_admin,
    verify_password,
)
from config.constants import ENVIRONMENT

router = APIRouter(prefix="/admin", tags=["Admin"])


# --- Esquemas -------------------------------------------------------------

class CredentialsIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=256)


class SetupIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=256)
    confirm_password: str = Field(..., min_length=8, max_length=256)


class BucketIn(BaseModel):
    name: str = Field(..., min_length=3, max_length=32)


def _bucket_to_dict(b: sqlite3.Row) -> dict:
    return {
        "name": b["name"],
        "api_key": b["api_key"],
        "created_at": b["created_at"],
    }


def _set_session_cookie(response: Response, token: str) -> None:
    # En local servimos por http; en producción se asume https detrás de proxy.
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=ENVIRONMENT != "local",
        path="/",
    )


# --- Setup / sesión -------------------------------------------------------

@router.get(
    "/status",
    summary="Estado de auth: ¿hay admin? ¿sesión activa?",
)
def auth_status(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    setup_required = db.count_users() == 0
    authenticated = False
    if not setup_required and session_token:
        sess = db.get_session(session_token)
        authenticated = bool(sess and db.get_user_by_id(sess["user_id"]))
    return {"setup_required": setup_required, "authenticated": authenticated}


@router.post(
    "/setup",
    summary="Crea el primer admin (sólo si no existe ninguno)",
    status_code=status.HTTP_201_CREATED,
)
def setup(body: SetupIn, response: Response) -> dict:
    if db.count_users() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un administrador",
        )
    if body.password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las contraseñas no coinciden",
        )
    pwd_hash, pwd_salt = hash_password(body.password)
    user_id = db.create_user(body.username, pwd_hash, pwd_salt)
    token, _ = create_session(user_id)
    _set_session_cookie(response, token)
    return {"username": body.username}


def _client_ip(request: Request) -> str:
    # Prefiere X-Forwarded-For (primer hop) si está detrás de un proxy.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", summary="Login de admin (set-cookie)")
def login(creds: CredentialsIn, request: Request, response: Response) -> dict:
    ip = _client_ip(request)

    blocked, remaining = db.is_login_blocked(ip)
    if blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos. Reintenta en {remaining}s.",
        )

    user = db.get_user_by_username(creds.username)
    if not user or not verify_password(
        creds.password, user["password_hash"], user["password_salt"]
    ):
        blocked_now, remaining = db.check_and_record_failed_login(ip)
        if blocked_now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Demasiados intentos. Reintenta en {remaining}s.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    db.reset_login_attempts(ip)
    token, _ = create_session(user["id"])
    _set_session_cookie(response, token)
    return {"username": user["username"]}


@router.post("/logout", summary="Logout (limpia cookie y sesión)")
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    if session_token:
        db.delete_session(session_token)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", summary="Información del admin actual")
def me(user: sqlite3.Row = Depends(require_admin)) -> dict:
    return {"username": user["username"]}


# --- Buckets --------------------------------------------------------------

@router.get("/buckets", summary="Lista todos los buckets")
def list_buckets(_: sqlite3.Row = Depends(require_admin)) -> dict:
    return {"buckets": [_bucket_to_dict(b) for b in db.list_buckets()]}


@router.post(
    "/buckets",
    summary="Crea un bucket nuevo",
    status_code=status.HTTP_201_CREATED,
)
def create_bucket(
    body: BucketIn, _: sqlite3.Row = Depends(require_admin)
) -> dict:
    storage.validate_bucket_name(body.name)
    if db.get_bucket_by_name(body.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un bucket con ese nombre",
        )
    api_key = secrets.token_hex(32)
    db.create_bucket(body.name, api_key)
    storage.bucket_dir(body.name).mkdir(parents=True, exist_ok=True)
    new_bucket = db.get_bucket_by_name(body.name)
    return _bucket_to_dict(new_bucket)


@router.delete(
    "/buckets/{name}",
    summary="Borra un bucket y todos sus archivos",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def delete_bucket(
    name: str, _: sqlite3.Row = Depends(require_admin)
) -> None:
    if not db.get_bucket_by_name(name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket no encontrado",
        )
    db.delete_bucket(name)
    bdir = storage.bucket_dir(name)
    if bdir.exists():
        shutil.rmtree(bdir)


@router.post(
    "/buckets/{name}/regenerate",
    summary="Regenera la API key del bucket",
)
def regenerate_key(
    name: str, _: sqlite3.Row = Depends(require_admin)
) -> dict:
    if not db.get_bucket_by_name(name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket no encontrado",
        )
    new_key = secrets.token_hex(32)
    db.regenerate_bucket_key(name, new_key)
    return _bucket_to_dict(db.get_bucket_by_name(name))
