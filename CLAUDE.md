# artifact-store

Almacén ligero de artefactos (imágenes Docker, builds, paquetes…) con URLs
firmadas temporales, soporte multi-bucket y autenticación admin.

Modelo:
- **Admin** (usuario + contraseña): gestiona buckets desde la UI.
- **Buckets**: directorios bajo `STORAGE_PATH/{bucket}/`. Cada bucket tiene su
  propia API key para operaciones de CI.
- **Bucket API key**: se envía en `X-API-Key`. Da acceso completo (read/write)
  *sólo* a su bucket.
- **URLs firmadas**: descarga sin credenciales, firmadas con `SIGNING_SECRET`
  global. La firma incluye `bucket+path+expiración`.

## Entorno
- Python 3.12
- Poetry (gestor de dependencias — NO usar pip directamente)
- FastAPI + Uvicorn + SQLite (std lib)
- Puerto: **3008** · Debugpy: **5688**

## Comandos
```bash
make install   # pyenv + venv (backend) + pnpm (frontend) + .env.local
make start     # arranca backend :3008 + frontend dev :5173 (HMR + proxy)
make build     # construye el frontend en frontend/dist (servido por FastAPI)
make logs      # tail de logs (backend + frontend)
make stop      # mata ambos servicios
```

En **dev** se usa el dev server de Vite (HMR). En **prod** sólo el backend
sirve el build estático: `make build && make start` y todo va por :3008.

## Estructura
```
artifact-store/
├── backend/                # Python (FastAPI)
│   ├── app/
│   │   ├── main.py         # entrada FastAPI, middleware, routers, SPA fallback
│   │   ├── db.py           # SQLite (users, buckets, sessions, login_attempts)
│   │   ├── routers/
│   │   │   ├── health.py   # estado del servicio
│   │   │   ├── admin.py    # status, setup, login, logout, buckets CRUD (cookie)
│   │   │   └── files.py    # upload, sign, download, list, delete (X-API-Key)
│   │   └── helpers/
│   │       ├── auth.py     # hash de password, sesiones, validación bucket key
│   │       ├── signing.py  # firma HMAC-SHA256 de URLs (incluye bucket)
│   │       └── storage.py  # resolución segura de rutas dentro de un bucket
│   ├── config/
│   │   └── constants.py    # variables de entorno
│   ├── tests/
│   ├── pyproject.toml
│   ├── poetry.lock
│   └── .env.local          # (ignorado por git)
├── frontend/               # React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── services/       # http, auth, buckets, files (capa fetch tipada)
│   │   ├── hooks/          # use-auth, use-buckets, use-toast
│   │   ├── components/ui/  # Toast, Modal, format
│   │   └── pages/
│   │       ├── auth/       # SetupForm, LoginForm, AuthPage
│   │       └── dashboard/  # DashboardPage, Sidebar, BucketView, Dropzone, FilesTable
│   ├── package.json
│   └── vite.config.ts
└── data/                   # runtime (BD SQLite + archivos por bucket)
```

## API

### Admin (cookie de sesión)
| Método | Ruta | Descripción |
|---|---|---|
| GET    | `/admin/setup-needed`              | ¿Hay que crear admin? |
| POST   | `/admin/setup`                     | Crea el primer admin (sólo si no existe) |
| POST   | `/admin/login`                     | Login (set-cookie) |
| POST   | `/admin/logout`                    | Logout |
| GET    | `/admin/me`                        | Info del admin actual |
| GET    | `/admin/buckets`                   | Lista buckets + sus claves |
| POST   | `/admin/buckets`                   | Crea bucket |
| DELETE | `/admin/buckets/{name}`            | Borra bucket (con archivos) |
| POST   | `/admin/buckets/{name}/regenerate` | Regenera la API key |

### Files (`X-API-Key` del bucket)
| Método | Ruta | Descripción |
|---|---|---|
| POST   | `/upload/{bucket}/{path:path}` | Sube archivo |
| POST   | `/sign/{bucket}/{path:path}`   | URL firmada temporal |
| GET    | `/list/{bucket}`               | Lista archivos del bucket |
| DELETE | `/files/{bucket}/{path:path}`  | Borra archivo |

### Público
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/files/{bucket}/{path:path}?expires=...&sig=...` | Descarga (URL firmada) |
| GET | `/health` | Estado del servicio |

## Variables de entorno (`backend/.env.local`)
```bash
ENVIRONMENT=local
ALLOWED_ORIGINS=*
STORAGE_PATH=/data
SIGNING_SECRET=<openssl rand -hex 32>
PUBLIC_BASE_URL=https://artifacts.tu-dominio.com
DEFAULT_EXPIRES_IN=3600
```
La BD SQLite vive en `STORAGE_PATH/.metadata.db` y se crea en el primer arranque.

## Reglas de código
- Comentarios en castellano, código en inglés
- snake_case · sin `any` en endpoints
- Persistencia: SQLite local en `STORAGE_PATH/.metadata.db` (usuarios, buckets,
  sesiones). Los archivos siguen viviendo en el filesystem bajo
  `STORAGE_PATH/{bucket}/...`.

## Seguridad
- `SIGNING_SECRET` debe ser una cadena aleatoria larga (32 bytes hex como mínimo).
- Contraseñas hasheadas con `hashlib.scrypt` + salt aleatorio por usuario.
- Bucket keys: 32 bytes hex generados en el servidor (`secrets.token_hex(32)`).
- `resolve_safe_path` previene path traversal (`../`).
- Las URLs firmadas incluyen `bucket`, `path` y timestamp absoluto.
- Comparaciones de claves siempre con `hmac.compare_digest` (tiempo constante).
- Cookies de sesión: HttpOnly, SameSite=Lax. Expiran en 30 días.

## Despliegue

Ver `docker-compose.example.yml`. La imagen Docker se construye con el
`Dockerfile` incluido (multi-stage, ~150 MB final).
