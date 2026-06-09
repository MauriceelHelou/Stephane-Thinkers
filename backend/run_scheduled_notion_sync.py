"""
Scheduled Notion incremental-sync entrypoint.

Invoke this script from platform cron (every N minutes) to run one cycle:
1) optionally enqueue sync on RQ
2) execute a guarded incremental sync (changed notes only)
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

from app.services.notion_sync import run_scheduled_notion_cycle
from app.utils.queue import RQ_ENABLED, REDIS_URL


def _time_bucket_job_id(interval_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    bucket_seconds = max(interval_minutes, 1) * 60
    bucket_start = int(now.timestamp()) // bucket_seconds * bucket_seconds
    slot = datetime.fromtimestamp(bucket_start, timezone.utc)
    return f"notion-auto-{slot.strftime('%Y%m%d%H%M')}"


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        interval_minutes = max(int(os.getenv("NOTION_AUTO_SYNC_INTERVAL_MINUTES", "5")), 1)

        if RQ_ENABLED:
            from redis import Redis
            from rq import Queue

            queue_name = os.getenv("RQ_NOTION_QUEUE_NAME", "notion_jobs")
            queue = Queue(queue_name, connection=Redis.from_url(REDIS_URL))
            job_id = _time_bucket_job_id(interval_minutes)
            try:
                job = queue.enqueue(run_scheduled_notion_cycle, job_id=job_id)
                result = {
                    "status": "queued",
                    "queue": queue_name,
                    "job_id": job.id,
                    "interval_minutes": interval_minutes,
                    "enqueued_at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as exc:
                message = str(exc)
                if "already exists" in message.lower():
                    result = {
                        "status": "already_queued",
                        "queue": queue_name,
                        "job_id": job_id,
                        "interval_minutes": interval_minutes,
                    }
                else:
                    raise
        else:
            result = run_scheduled_notion_cycle()

        print(json.dumps(result, indent=2, default=str))
        return 0
    except Exception as exc:
        print(f"[scheduled-notion-sync] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
