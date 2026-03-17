import re
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise ValueError("Invalid token")


def verify_refresh_token(token: str) -> dict:
    """Decode and validate refresh token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")
        return payload
    except JWTError:
        raise ValueError("Invalid refresh token")


PASSWORD_RULES = {
    "min_length": 8,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_digit": True,
    "require_special": True,
}


def validate_password_strength(password: str) -> list[str]:
    """
    Validate password against policy rules.
    Returns a list of violated rule messages (empty list = password is valid).
    """
    errors = []
    if len(password) < PASSWORD_RULES["min_length"]:
        errors.append(f"Password must be at least {PASSWORD_RULES['min_length']} characters long.")
    if PASSWORD_RULES["require_uppercase"] and not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if PASSWORD_RULES["require_lowercase"] and not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if PASSWORD_RULES["require_digit"] and not re.search(r"\d", password):
        errors.append("Password must contain at least one number.")
    if PASSWORD_RULES["require_special"] and not re.search(r"[^A-Za-z0-9]", password):
        errors.append("Password must contain at least one special character.")
    return errors


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

