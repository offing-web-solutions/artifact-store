"""
auth.py
=======

Autenticación de:
    - Admin (sesión por cookie HttpOnly): contraseñas con `hashlib.scrypt`.
    - Bucket API key (cabecera `X-API-Key`): comparación en tiempo constante.

El bucket queda resuelto en la dependencia `require_bucket_key` y se usa en
los endpoints de archivos para asegurar que la clave coincide con el bucket
de la URL.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
import time

from fastapi import Cookie, HTTPException, Path, Request, Security, status
from fastapi.security import APIKeyHeader

from app import db

# Cookie usada para la sesión de admin
SESSION_COOKIE = "ast_session"
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 días

# Parámetros de scrypt — OWASP recomienda N>=2^17 para producción, pero al
# ejecutarse en cada login conviene equilibrar coste/usabilidad.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


# --- Password hashing -----------------------------------------------------

def hash_password(password: str) -> tuple[str, str]:
    # Devuelve (hash_hex, salt_hex). Salt aleatorio de 16 bytes por usuario.
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return digest.hex(), salt.hex()


def verify_password(password: str, password_hash: str, password_salt: str) -> bool:
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=bytes.fromhex(password_salt),
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return hmac.compare_digest(digest.hex(), password_hash)


# --- Sessions -------------------------------------------------------------

def create_session(user_id: int) -> tuple[str, int]:
    # Devuelve (token, expires_at). El token se entrega al cliente en cookie.
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    db.create_session(token, user_id, expires_at)
    return token, expires_at


def require_admin(
    request: Request,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> sqlite3.Row:
    # Dependencia FastAPI: exige sesión válida; devuelve la fila del usuario.
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión requerida"
        )
    sess = db.get_session(session_token)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión expirada"
        )
    user = db.get_user_by_id(sess["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inexistente"
        )
    return user


# --- Bucket API key -------------------------------------------------------

def require_bucket_key(
    bucket: str = Path(..., description="Nombre del bucket"),
    provided: str | None = Security(api_key_header),
) -> sqlite3.Row:
    # Verifica que la clave proporcionada corresponda al bucket de la URL.
    if not provided:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="X-API-Key requerida"
        )
    target = db.get_bucket_by_name(bucket)
    if not target:
        # No filtramos si el bucket existe o la clave es mala: respuesta uniforme
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key inválida"
        )
    if not hmac.compare_digest(provided, target["api_key"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key inválida"
        )
    return target
