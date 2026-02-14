import os
from typing import Any, Callable, Optional


def _env_bool(key: str, default: bool) -> bool:
    value = os.getenv(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RQ_QUEUE_NAME = os.getenv("RQ_QUEUE_NAME", "notes_ai")
RQ_ENABLED = _env_bool("RQ_ENABLED", False)


class QueueExecutionResult:
    def __init__(
        self,
        mode: str,
        job_id: Optional[str] = None,
        result: Optional[Any] = None,
        error: Optional[str] = None,
    ):
        self.mode = mode
        self.job_id = job_id
        self.result = result
        self.error = error


def _get_rq_queue():
    if not RQ_ENABLED:
        return None
    from redis import Redis
    from rq import Queue

    connection = Redis.from_url(REDIS_URL)
    return Queue(RQ_QUEUE_NAME, connection=connection)


def enqueue_or_run(
    func: Callable[..., Any],
    *args: Any,
    job_id: Optional[str] = None,
    **kwargs: Any,
) -> QueueExecutionResult:
    """
    Try to enqueue work on Redis RQ. Falls back to in-process execution if unavailable.
    """
    if RQ_ENABLED:
        try:
            queue = _get_rq_queue()
            job = queue.enqueue(func, *args, job_id=job_id, **kwargs)
            return QueueExecutionResult(mode="queued", job_id=job.id)
        except Exception as error:
            result = func(*args, **kwargs)
            return QueueExecutionResult(
                mode="inline_fallback",
                result=result,
                error=str(error),
            )

    result = func(*args, **kwargs)
    return QueueExecutionResult(mode="inline", result=result)


def cancel_queued_job(job_id: str) -> bool:
    if not RQ_ENABLED:
        return False
    try:
        from rq.job import Job

        queue = _get_rq_queue()
        if queue is None:
            return False
        job = Job.fetch(job_id, connection=queue.connection)
        job.cancel()
        return True
    except Exception:
        return False
