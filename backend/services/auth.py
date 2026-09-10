import bcrypt
import jwt
import os
from datetime import datetime, timedelta

SECRET_KEY = os.environ.get("JWT_SECRET", "it-mgmt-mobica-secret-2024")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 24

DEFAULT_PASSWORD = "Mobica@2024"


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
