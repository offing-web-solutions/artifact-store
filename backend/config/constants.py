"""
constants.py
============

Variables de entorno cargadas desde `.env.local` (o el entorno del proceso).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Cargar variables del .env.local si existe
_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    load_dotenv(_env_file)

ENVIRONMENT = os.getenv("ENVIRONMENT", "local")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
ROOT_PATH = os.getenv("ROOT_PATH", "")

# Directorio de almacenamiento de los archivos (montado como volumen en Docker)
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "/data"))

# Clave usada para firmar URLs temporales (HMAC-SHA256)
SIGNING_SECRET = os.getenv("SIGNING_SECRET", "")

# URL pública del servicio, usada para construir las URLs firmadas
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:3008").rstrip("/")

# Tiempo de expiración por defecto para las URLs firmadas (segundos)
DEFAULT_EXPIRES_IN = int(os.getenv("DEFAULT_EXPIRES_IN", "3600"))
