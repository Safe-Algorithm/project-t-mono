"""
Taskiq broker and scheduler configuration for background tasks.
"""

from taskiq import TaskiqScheduler
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from app.core.config import settings

# Create Redis result backend
result_backend = RedisAsyncResultBackend(settings.REDIS_URL)

# Create broker with Redis
broker = ListQueueBroker(settings.REDIS_URL).with_result_backend(result_backend)

# Create scheduler
scheduler = TaskiqScheduler(broker=broker)
