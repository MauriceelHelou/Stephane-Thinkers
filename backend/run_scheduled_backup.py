"""
Scheduled backup entrypoint.

Invoke this script from platform cron (e.g., Railway cron) to run one backup cycle:
1) create a scheduled backup artifact
2) enforce retention policy
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

# Ensure app modules are importable when script is launched from backend root.
sys.path.insert(0, os.path.dirname(__file__))

from app.services.backup_jobs import run_scheduled_cycle
from app.utils.queue import RQ_ENABLED, REDIS_URL


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        if RQ_ENABLED:
            from redis import Redis
            from rq import Queue

            queue_name = os.getenv("RQ_BACKUP_QUEUE_NAME", "backup_jobs")
            queue = Queue(queue_name, connection=Redis.from_url(REDIS_URL))
            job = queue.enqueue(run_scheduled_cycle)
            result = {
                "status": "queued",
                "queue": queue_name,
                "job_id": job.id,
                "enqueued_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            result = run_scheduled_cycle()
        print(json.dumps(result, indent=2, default=str))
        return 0
    except Exception as exc:
        print(f"[scheduled-backup] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
