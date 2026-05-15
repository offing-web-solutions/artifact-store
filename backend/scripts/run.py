"""
Punto de entrada para el binario PyInstaller.

Cuando PyInstaller empaqueta la app, sys.frozen=True y los recursos
embebidos viven en sys._MEIPASS. Exponemos la ruta de frontend/dist
vía AS_FRONTEND_DIST para que app.main la consuma sin más cambios.
"""
import os
import secrets
import sys
from pathlib import Path


def _bootstrap() -> None:
    if not getattr(sys, "frozen", False):
        return

    bundle = Path(getattr(sys, "_MEIPASS"))
    os.environ.setdefault("AS_FRONTEND_DIST", str(bundle / "frontend" / "dist"))
    # En binario PyInstaller el modo por defecto es producción:
    # sin debugpy, sin cookies inseguras, sin CORS abierto.
    os.environ.setdefault("ENVIRONMENT", "production")

    # En binario nativo /data no existe (es el default para Docker). Usamos
    # ~/.artifact-store para que el binario arranque sin configuración previa.
    storage_path = Path(os.environ.setdefault(
        "STORAGE_PATH", str(Path.home() / ".artifact-store")
    ))
    storage_path.mkdir(parents=True, exist_ok=True)

    # SIGNING_SECRET se autogenera y persiste en STORAGE_PATH si no se pasa
    # por entorno. Mantenerlo entre reinicios es imprescindible para que las
    # URLs firmadas en circulación sigan siendo válidas.
    if not os.environ.get("SIGNING_SECRET"):
        secret_file = storage_path / ".signing_secret"
        if secret_file.exists():
            os.environ["SIGNING_SECRET"] = secret_file.read_text().strip()
        else:
            secret = secrets.token_hex(32)
            secret_file.write_text(secret)
            secret_file.chmod(0o600)
            os.environ["SIGNING_SECRET"] = secret


def main() -> None:
    _bootstrap()

    # Import explícito (NO como string) para que PyInstaller pueda rastrear
    # las dependencias estáticamente. uvicorn.run("app.main:app", ...) usa
    # importlib y el bundle no encuentra los módulos.
    import uvicorn
    from app.main import app

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "3008"))
    uvicorn.run(app, host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
