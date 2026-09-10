import bcrypt
import jwt
import os
import secrets
from datetime import datetime, timedelta
from paths import data_path

ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 24

# Kept as "Mobica@2024" by default so this doesn't change behavior for an
# existing installation's not-yet-activated accounts; override via env var
# for a fresh installation at a different company. `or` (not `.get(key,
# default)`) so an env var that's set-but-empty (e.g. left blank in Docker
# Compose) still falls back correctly instead of becoming "".
DEFAULT_PASSWORD = os.environ.get("DEFAULT_PASSWORD") or "Mobica@2024"


def _load_or_create_secret() -> str:
    """JWT signing key. Prefer an explicit env var; otherwise generate one
    on first run and persist it in DATA_DIR so it stays stable across
    restarts (and isn't a fixed value baked into the source code)."""
    env_secret = os.environ.get("JWT_SECRET")
    if env_secret:
        return env_secret
    secret_path = data_path(".jwt_secret")
    if os.path.exists(secret_path):
        with open(secret_path) as f:
            return f.read().strip()
    new_secret = secrets.token_hex(32)
    with open(secret_path, "w") as f:
        f.write(new_secret)
    return new_secret


SECRET_KEY = _load_or_create_secret()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(engineer_id: int, email: str, permission_level: str) -> str:
    payload = {
        "sub": str(engineer_id),
        "email": email,
        "permission": permission_level,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
