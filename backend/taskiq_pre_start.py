"""
Pre-start script for Taskiq workers and scheduler.
Ensures Redis is ready before starting Taskiq processes.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from tenacity import after_log, before_log, retry, stop_after_attempt, wait_fixed
from app.core.redis import redis_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

max_tries = 60 * 5  # 5 minutes
wait_seconds = 1


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARN),
)
def check_redis() -> None:
    """Check if Redis is ready."""
    try:
        pong = redis_client.ping()
        if not pong:
            raise ConnectionError("Redis ping returned False")
        logger.info("Redis is ready")
    except Exception as e:
        logger.error(f"Redis not ready: {e}")
        raise e


def main() -> None:
    """Initialize Taskiq service."""
    logger.info("Initializing Taskiq service")
    check_redis()
    logger.info("Taskiq service finished initializing")


if __name__ == "__main__":
    main()
