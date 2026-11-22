import os
import hmac
import hashlib
import base64
import json
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

SECRET = os.getenv(
    "SECRET_KEY",
    "development-only-change-this-secret"
)

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        180_000
    )

    return base64.b64encode(salt + digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        raw = base64.b64decode(stored)
        salt, expected = raw[:16], raw[16:]

        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt,
            180_000
        )

        return hmac.compare_digest(actual, expected)

    except Exception:
        return False


def create_token(user: User) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "sub": user.id,
            "role": user.role,
            "exp": int(time.time()) + 60 * 60 * 24
        }).encode()
    ).decode().rstrip("=")

    signature = hmac.new(
        SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return payload + "." + signature


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db)
):
    if not credentials:
        raise HTTPException(401, "Sign in to continue")

    try:
        payload, signature = credentials.credentials.split(".", 1)

        expected = hmac.new(
            SECRET.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")

        data = json.loads(
            base64.urlsafe_b64decode(
                payload + "=" * (-len(payload) % 4)
            )
        )

        if data["exp"] < time.time():
            raise ValueError("Session expired")

        user = db.get(User, int(data["sub"]))

        if not user:
            raise ValueError("User not found")

        return user

    except Exception:
        raise HTTPException(401, "Invalid or expired session")


def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")

    return user
