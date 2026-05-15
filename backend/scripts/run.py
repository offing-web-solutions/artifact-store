"""
Punto de entrada para el binario PyInstaller.

Cuando PyInstaller empaqueta la app, sys.frozen=True y los recursos
embebidos viven en sys._MEIPASS. Exponemos la ruta de frontend/dist
vía AS_FRONTEND_DIST para que app.main la consuma sin más cambios.
"""
import os
import sys
from pathlib import Path


def _bootstrap() -> None:
    if getattr(sys, "frozen", False):
        bundle = Path(getattr(sys, "_MEIPASS"))
        os.environ.setdefault("AS_FRONTEND_DIST", str(bundle / "frontend" / "dist"))
        # En binario PyInstaller el modo por defecto es producción:
        # sin debugpy, sin cookies inseguras, sin CORS abierto.
        os.environ.setdefault("ENVIRONMENT", "production")


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
