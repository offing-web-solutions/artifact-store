# Artifact Store

## Description

**Artifact Store** is a lightweight, self-hosted artifact server for Docker
images, build outputs, release tarballs and any binary blob you need to hand
off between systems. It exposes a small REST API plus an admin web UI, and
its key idea is **temporary signed URLs**: a CI pipeline authenticates with a
bucket API key to upload a file, then asks the server for a short-lived URL
that any downstream consumer (a production server, a script, a customer) can
use to download the file *without* credentials.

It is intentionally small — a single process, SQLite for metadata, the
filesystem for blobs — and ships as both a Docker image and a native binary.

**Highlights**

- Multi-bucket: each bucket has its own API key (CI scoped per bucket).
- Admin UI to create/delete buckets, regenerate keys, browse files.
- Brute-force protection on login (10 attempts / 15 min per IP).
- Single Docker image, frontend served by the backend.
- SQLite for metadata, filesystem for blobs (`$STORAGE_PATH/{bucket}/...`).
- Distributed as Docker images (`amd64`, `arm64`, `armv7`, `musl` variants)
  **and** native macOS binaries (`arm64`, `amd64`).

## Contents

- [Installation](#installation)
  - [Quick install](#quick-install)
  - [Manual download](#manual-download)
  - [Docker](#docker)
  - [From source](#from-source)
- [Docker Compose](#docker-compose)
- [Docker Swarm stack](#docker-swarm-stack)
- [Users & sessions](#users--sessions)
- [Buckets & API keys](#buckets--api-keys)
- [CI/CD integration](#cicd-integration)
- [Environment variables](#environment-variables)
- [Health check](#health-check)
- [Security](#security)

## Installation

Every install method needs the same runtime state: a writable `STORAGE_PATH`
directory and a stable `SIGNING_SECRET` (32-byte hex). See
[Environment variables](#environment-variables) for the full list. After
starting, open [http://localhost:3008](http://localhost:3008) — on first
visit you'll be prompted to create the admin user.

> ⚠️ Store the `SIGNING_SECRET` somewhere safe and reuse it on every restart.
> Rotating it invalidates every signed URL already in flight.

### Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/offing-web-solutions/artifact-store/main/install.sh | sh
```

Detects your platform and installs to `/usr/local/bin` (root) or
`~/.local/bin` (non-root). After install, run `artifact-store` to start the
server on port `3008`.

### Manual download

Pre-built artifacts are available on the [releases page](https://github.com/offing-web-solutions/artifact-store/releases)
(or in [`dist/`](./dist/) after `make build`).

| Platform | Package |
|---|---|
| Linux x86_64 (glibc) — Docker image | `artifact-store-linux-amd64.tar.gz` |
| Linux x86_64 (Alpine/musl) — Docker image | `artifact-store-linux-amd64-musl.tar.gz` |
| Linux ARM64 (glibc) — Docker image | `artifact-store-linux-arm64.tar.gz` |
| Linux ARM64 (Alpine/musl) — Docker image | `artifact-store-linux-arm64-musl.tar.gz` |
| Linux ARMv7 — Docker image | `artifact-store-linux-armv7.tar.gz` |
| macOS Intel | `artifact-store-macos-amd64.tar.gz` |
| macOS Apple Silicon | `artifact-store-macos-arm64.tar.gz` |

Use the static (`-musl`) variant on Alpine Linux or any system where glibc
availability is uncertain. The `macos-*` tarballs are real native binaries
you can run directly; the `linux-*` tarballs are Docker image archives —
load them with `docker load -i <file>` and run as in [Docker](#docker).

### Docker

Multi-arch images (`linux/amd64`, `linux/arm64`) are published to Docker Hub at
[`offingwebsolutions/artifact-store`](https://hub.docker.com/r/offingwebsolutions/artifact-store).

```bash
docker run -d \
  --name artifact-store \
  --restart unless-stopped \
  -p 3008:3008 \
  -v artifact-store-data:/data \
  -e STORAGE_PATH=/data \
  -e SIGNING_SECRET=$(openssl rand -hex 32) \
  -e PUBLIC_BASE_URL=http://localhost:3008 \
  offingwebsolutions/artifact-store:latest
```

Pin to a specific version with `offingwebsolutions/artifact-store:vX.Y.Z`.

### From source

Useful for contributing or running an unreleased revision. Requires
**Python 3.12**, **Poetry** and **pnpm**. The Makefile has the full dev
workflow — `make help` lists every target:

```bash
git clone https://github.com/offing-web-solutions/artifact-store.git
cd artifact-store
make install        # backend + frontend deps + .env.local
make start          # backend :3008  +  frontend dev :5173 (HMR + proxy)
```

## Docker Compose

A ready-to-edit example lives in [`docker-compose.example.yml`](./docker-compose.example.yml).

```yaml
services:
  artifact-store:
    image: offingwebsolutions/artifact-store:latest
    container_name: artifact-store
    restart: unless-stopped
    ports:
      - "3008:3008"
    volumes:
      - artifact-store-data:/data
    environment:
      - ENVIRONMENT=production
      - STORAGE_PATH=/data
      - SIGNING_SECRET=${SIGNING_SECRET}
      - PUBLIC_BASE_URL=https://artifacts.example.com
      - ALLOWED_ORIGINS=*
      - DEFAULT_EXPIRES_IN=3600

volumes:
  artifact-store-data:
```

## Docker Swarm stack

```yaml
services:
  artifact-store:
    image: offingwebsolutions/artifact-store:latest
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    ports:
      - target: 3008
        published: 3008
        protocol: tcp
        mode: host                    # bypasses ingress mesh → real client IP
    volumes:
      - artifact-store-data:/data
    environment:
      - STORAGE_PATH=/data
      - SIGNING_SECRET=${SIGNING_SECRET}
      - PUBLIC_BASE_URL=https://artifacts.example.com

volumes:
  artifact-store-data:
```

Deploy:
```bash
docker stack deploy -c stack.yml artifact-store
```

## Users & sessions

On first launch a setup screen lets you create the initial admin (username +
password, minimum 8 characters). Sessions are stored in a HttpOnly cookie and
remain valid for **30 days**.

All metadata — admin users, buckets, sessions and login history — is stored in
a single SQLite database at `$STORAGE_PATH/.metadata.db`. Blobs live alongside
it under `$STORAGE_PATH/{bucket}/...`. Mount a named volume at `/data` so it
survives container updates.

### Persistence behaviour

| Situation | Data kept? |
|---|---|
| `docker restart artifact-store` | ✅ Yes |
| `docker stop` + `docker start` | ✅ Yes |
| `docker compose pull` + `up -d` | ✅ Yes — if volume is mounted |
| `docker rm` + `docker run` without volume | ❌ No — setup required again |

## Buckets & API keys

After login, create one or more buckets from the dashboard. Each bucket gets
its own random API key — give that key to your CI pipeline (or any client
that needs to upload/sign/list files for that bucket).

```bash
# Replace BUCKET and API_KEY with values from the UI
BUCKET=builds
API_KEY=<your-bucket-api-key>
HOST=https://artifacts.example.com

# Upload
curl -X POST -H "X-API-Key: $API_KEY" \
  -F "file=@dist.tar.gz" \
  $HOST/upload/$BUCKET/v1.2.3/dist.tar.gz

# Generate signed URL (valid 1 hour)
curl -X POST -H "X-API-Key: $API_KEY" \
  "$HOST/sign/$BUCKET/v1.2.3/dist.tar.gz?expires_in=3600"

# Download — no auth needed, just the signed URL
curl -L -o dist.tar.gz "<signed-url-from-previous-step>"
```

The full API spec is exposed at [`/docs`](http://localhost:3008/docs)
(Swagger UI).

## CI/CD integration

The canonical flow is: **build → upload with the bucket API key → ask for a
signed URL → hand it to the deploy target**. A full Bitbucket Pipelines example
ships in [`bitbucket-pipelines.example.yml`](./bitbucket-pipelines.example.yml).

Minimal GitHub Actions equivalent:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    env:
      ARTIFACT_STORE_URL: https://artifacts.example.com
      BUCKET: builds
    steps:
      - uses: actions/checkout@v4

      - name: Build & save image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker save my-app:${{ github.sha }} | gzip > my-app.tar.gz

      - name: Upload to artifact-store
        env:
          API_KEY: ${{ secrets.ARTIFACT_STORE_API_KEY }}
        run: |
          curl -sS --fail -X POST \
            -H "X-API-Key: $API_KEY" \
            -F "file=@my-app.tar.gz" \
            "$ARTIFACT_STORE_URL/upload/$BUCKET/my-app/${{ github.sha }}.tar.gz"

      - name: Generate signed URL & trigger deploy
        env:
          API_KEY: ${{ secrets.ARTIFACT_STORE_API_KEY }}
        run: |
          SIGNED=$(curl -sS --fail -X POST \
            -H "X-API-Key: $API_KEY" \
            "$ARTIFACT_STORE_URL/sign/$BUCKET/my-app/${{ github.sha }}.tar.gz?expires_in=3600" \
            | jq -r '.url')
          ssh deploy@server "curl -sSL '$SIGNED' | gunzip | docker load"
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `STORAGE_PATH` | `/data` | Directory for the SQLite metadata DB and bucket blobs |
| `SIGNING_SECRET` | _(required)_ | Secret for signing temporary URLs (HMAC-SHA256). Generate with `openssl rand -hex 32` |
| `PUBLIC_BASE_URL` | `http://localhost:3008` | URL embedded in signed download links |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `ENVIRONMENT` | `local` | Set to `production` to disable debug helpers and enable secure cookies |
| `DEFAULT_EXPIRES_IN` | `3600` | Default lifetime (seconds) for signed URLs |
| `ROOT_PATH` | `""` | Set when running behind a reverse proxy at a sub-path |

## Health check

`GET /health` returns `200 OK` with a small JSON payload. Use it for liveness
probes in Docker, Kubernetes or your reverse proxy:

```yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:3008/health"]
  interval: 30s
  timeout: 3s
  retries: 3
```

## Security

- Signed URLs cover `bucket + path + absolute expiration`. Anyone with the URL
  can download until it expires; no credentials needed downstream.
- Bucket API keys are scoped: the key for bucket A cannot read or write into
  bucket B.
- Login attempts are rate-limited per IP: blocked after **10 failed attempts**
  in a 15-minute window.
- Admin passwords are hashed with `hashlib.scrypt` + per-user salt.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and marked `Secure` outside
  of `ENVIRONMENT=local`.
- Path traversal is blocked at the storage layer (`../` and friends).
