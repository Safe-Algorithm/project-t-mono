"""
Taskiq broker and scheduler configuration for background tasks.
"""

from taskiq import TaskiqScheduler
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_redis import ListQueueBroker

from app.core.config import settings

# Create broker with Redis
broker = ListQueueBroker(settings.REDIS_URL)

# Create scheduler with LabelScheduleSource
scheduler = TaskiqScheduler(
    broker=broker,
    sources=[LabelScheduleSource(broker)],
)
