import os
from celery import Celery

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "contract_workers",
    broker=redis_url,
    backend=redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "check-stale-deals": {
            "task": "check_stale_deals",
            "schedule": 86400.0,  # daily
        },
        "check-deliverable-reminders": {
            "task": "check_deliverable_reminders",
            "schedule": 86400.0,  # daily
        },
    },
)

# Auto-discover tasks
celery_app.autodiscover_tasks(["workers"])
