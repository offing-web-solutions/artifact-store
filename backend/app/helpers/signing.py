"""
signing.py
==========

Firma y verificación de URLs temporales mediante HMAC-SHA256.

El esquema:
    - Se incluye el bucket, el path y un timestamp de expiración.
    - Se firma con un secreto compartido conocido solo por el servidor.
    - Cualquiera con la URL puede descargar antes de la expiración,
      sin necesitar credenciales.
"""
import base64
import hashlib
import hmac
import time

from config.constants import SIGNING_SECRET


def _sign(message: str) -> str:
    digest = hmac.new(
        SIGNING_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def generate_signature(bucket: str, path: str, expires_at: int) -> str:
    # Genera la firma para una tripleta (bucket, path, expires_at)
    return _sign(f"{bucket}:{path}:{expires_at}")


def verify_signature(bucket: str, path: str, expires_at: int, signature: str) -> bool:
    if expires_at < int(time.time()):
        return False
    expected = generate_signature(bucket, path, expires_at)
    return hmac.compare_digest(expected, signature)
