# ─── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:22-slim AS frontend

RUN npm install -g pnpm@latest

WORKDIR /app

COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/
# --ignore-scripts: pnpm 10 bloquea postinstalls por defecto (esbuild). El
# binario de esbuild ya viene en el paquete @esbuild/<plataforma>, así que el
# postinstall es redundante.
RUN cd frontend && pnpm install --frozen-lockfile=false --ignore-scripts

COPY frontend/ frontend/
RUN cd frontend && pnpm build

# ─── Stage 2: Backend dependencies ──────────────────────────────────────────
FROM python:3.12-slim AS backend

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

WORKDIR /app/backend

# build-essential + libffi-dev: necesarios para compilar wheels de C
# (msgpack, cffi, …) en arquitecturas sin wheels precompiladas (armv7, 386).
# Se descartan al copiar solo site-packages al stage runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libffi-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==1.8.3

COPY backend/pyproject.toml backend/poetry.lock* ./
RUN poetry install --only main --no-root

# ─── Stage 3: Runtime ───────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

WORKDIR /app/backend

COPY --from=backend /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin

COPY backend/app    ./app
COPY backend/config ./config

COPY --from=frontend /app/frontend/dist /app/frontend/dist

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3008

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3008"]
