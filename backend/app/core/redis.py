import redis
from app.core.config import settings

# Redis connection
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

def add_token_to_blacklist(token: str, expires_in: int) -> None:
    """Add a token to the blacklist with expiration time"""
    redis_client.setex(f"blacklist:{token}", expires_in, "true")

def is_token_blacklisted(token: str) -> bool:
    """Check if a token is blacklisted"""
    return redis_client.exists(f"blacklist:{token}") > 0
