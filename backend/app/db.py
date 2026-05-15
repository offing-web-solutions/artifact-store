"""
db.py
=====

Capa de persistencia con SQLite. La BD vive en `STORAGE_PATH/.metadata.db`
y se inicializa al arranque de la aplicación.

Tablas:
    users     - administradores del panel (login con cookie de sesión)
    buckets   - buckets disponibles, cada uno con su propia API key
    sessions  - tokens de sesión activos
"""
from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from config.constants import STORAGE_PATH

DB_FILENAME = ".metadata.db"


def _db_path() -> Path:
    return STORAGE_PATH / DB_FILENAME


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    # Abre una conexión por operación (SQLite gestiona concurrencia con WAL)
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_db_path(), isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def init_schema() -> None:
    # Crea las tablas si no existen. Se invoca al arrancar la app.
    with connect() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT    NOT NULL UNIQUE,
                password_hash   TEXT    NOT NULL,
                password_salt   TEXT    NOT NULL,
                created_at      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS buckets (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT    NOT NULL UNIQUE,
                api_key         TEXT    NOT NULL,
                created_at      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token           TEXT    PRIMARY KEY,
                user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at      INTEGER NOT NULL,
                created_at      INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

            CREATE TABLE IF NOT EXISTS login_attempts (
                ip          TEXT    PRIMARY KEY,
                attempts    INTEGER NOT NULL DEFAULT 0,
                reset_at    INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
            );
            """
        )


# --- Login rate-limit ----------------------------------------------------

# Bloqueo: N intentos fallidos dentro de WINDOW segundos → BLOCK_FOR segundos.
LOGIN_MAX_ATTEMPTS = 10
LOGIN_WINDOW_SECONDS = 15 * 60


def check_and_record_failed_login(ip: str) -> tuple[bool, int]:
    # Devuelve (blocked, remaining_secs). Llamar SIEMPRE tras un fallo.
    now = int(time.time())
    with connect() as c:
        row = c.execute(
            "SELECT attempts, reset_at FROM login_attempts WHERE ip = ?", (ip,)
        ).fetchone()
        if row and row["reset_at"] > now:
            attempts = row["attempts"] + 1
            reset_at = row["reset_at"]
        else:
            attempts = 1
            reset_at = now + LOGIN_WINDOW_SECONDS
        c.execute(
            "INSERT INTO login_attempts (ip, attempts, reset_at, updated_at) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(ip) DO UPDATE SET attempts=excluded.attempts, "
            "reset_at=excluded.reset_at, updated_at=excluded.updated_at",
            (ip, attempts, reset_at, now),
        )
        blocked = attempts >= LOGIN_MAX_ATTEMPTS
        return blocked, max(0, reset_at - now)


def is_login_blocked(ip: str) -> tuple[bool, int]:
    now = int(time.time())
    with connect() as c:
        row = c.execute(
            "SELECT attempts, reset_at FROM login_attempts WHERE ip = ?", (ip,)
        ).fetchone()
    if not row or row["reset_at"] <= now:
        return False, 0
    if row["attempts"] >= LOGIN_MAX_ATTEMPTS:
        return True, row["reset_at"] - now
    return False, 0


def reset_login_attempts(ip: str) -> None:
    with connect() as c:
        c.execute("DELETE FROM login_attempts WHERE ip = ?", (ip,))


# --- Users ----------------------------------------------------------------

def count_users() -> int:
    with connect() as c:
        return c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]


def create_user(username: str, password_hash: str, password_salt: str) -> int:
    with connect() as c:
        cur = c.execute(
            "INSERT INTO users (username, password_hash, password_salt, created_at) "
            "VALUES (?, ?, ?, ?)",
            (username, password_hash, password_salt, int(time.time())),
        )
        return cur.lastrowid


def get_user_by_username(username: str) -> sqlite3.Row | None:
    with connect() as c:
        return c.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()


def get_user_by_id(user_id: int) -> sqlite3.Row | None:
    with connect() as c:
        return c.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()


# --- Buckets --------------------------------------------------------------

def list_buckets() -> list[sqlite3.Row]:
    with connect() as c:
        return c.execute(
            "SELECT id, name, api_key, created_at FROM buckets ORDER BY name"
        ).fetchall()


def get_bucket_by_name(name: str) -> sqlite3.Row | None:
    with connect() as c:
        return c.execute(
            "SELECT * FROM buckets WHERE name = ?", (name,)
        ).fetchone()


def get_bucket_by_api_key(api_key: str) -> sqlite3.Row | None:
    with connect() as c:
        return c.execute(
            "SELECT * FROM buckets WHERE api_key = ?", (api_key,)
        ).fetchone()


def create_bucket(name: str, api_key: str) -> int:
    with connect() as c:
        cur = c.execute(
            "INSERT INTO buckets (name, api_key, created_at) VALUES (?, ?, ?)",
            (name, api_key, int(time.time())),
        )
        return cur.lastrowid


def delete_bucket(name: str) -> bool:
    with connect() as c:
        cur = c.execute("DELETE FROM buckets WHERE name = ?", (name,))
        return cur.rowcount > 0


def regenerate_bucket_key(name: str, new_key: str) -> bool:
    with connect() as c:
        cur = c.execute(
            "UPDATE buckets SET api_key = ? WHERE name = ?", (new_key, name)
        )
        return cur.rowcount > 0


# --- Sessions -------------------------------------------------------------

def create_session(token: str, user_id: int, expires_at: int) -> None:
    with connect() as c:
        c.execute(
            "INSERT INTO sessions (token, user_id, expires_at, created_at) "
            "VALUES (?, ?, ?, ?)",
            (token, user_id, expires_at, int(time.time())),
        )


def get_session(token: str) -> sqlite3.Row | None:
    with connect() as c:
        return c.execute(
            "SELECT * FROM sessions WHERE token = ? AND expires_at > ?",
            (token, int(time.time())),
        ).fetchone()


def delete_session(token: str) -> None:
    with connect() as c:
        c.execute("DELETE FROM sessions WHERE token = ?", (token,))


def cleanup_expired_sessions() -> None:
    with connect() as c:
        c.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))
