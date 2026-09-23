import logging
import threading
import time
from datetime import datetime, date, timezone

logger = logging.getLogger("task_reminders")

CHECK_INTERVAL_SECONDS = 1800  # 30 minutes — reminders are day-granularity, no need to poll faster


def _is_due_today(task, today: date) -> bool:
    task_date = task.task_date.date() if isinstance(task.task_date, datetime) else task.task_date
    if task.frequency == "daily":
        return True
    if task.frequency == "weekly":
        return today.weekday() == task_date.weekday()
    if task.frequency == "monthly":
        return today.day == task_date.day
    # one_time
    return today == task_date


def _already_reminded_today(task, today: date) -> bool:
    if not task.last_reminded_at:
        return False
    last = task.last_reminded_at.date() if isinstance(task.last_reminded_at, datetime) else task.last_reminded_at
    return last == today


def _is_overdue(task, today: date) -> bool:
    """One-time: the fixed due date has passed and it's still pending.
    Recurring (daily/weekly/monthly): it's already been reminded on some
    earlier cycle and is STILL pending now that a new cycle is due — i.e.
    the previous occurrence was missed, not just "due again as normal"."""
    task_date = task.task_date.date() if isinstance(task.task_date, datetime) else task.task_date
    if task.frequency == "one_time":
        return task_date < today
    return task.last_reminded_at is not None


def _reset_recurring_cycles(db, today: date) -> int:
    """A daily/weekly/monthly task marked 'done' should come back to life —
    as if it was never done — once its next occurrence is due, so it gets
    actioned (and reminded about) again instead of staying done forever."""
    import models

    tasks = db.query(models.EngineerTask).filter(
        models.EngineerTask.status == "done",
        models.EngineerTask.frequency.in_(["daily", "weekly", "monthly"]),
    ).all()
    reset = 0
    for task in tasks:
        if not _is_due_today(task, today):
            continue
        completed = task.completed_at.date() if isinstance(task.completed_at, datetime) else task.completed_at
        if completed == today:
            continue  # this cycle's occurrence was already completed today — nothing to reset yet
        task.status = "pending"
        task.completed_at = None
        task.last_reminded_at = None
        reset += 1
    if reset:
        db.commit()
        logger.info(f"Reset {reset} recurring task(s) to pending for a new cycle")
    return reset


def _remind(task, db, overdue=False):
    import models

    if not task.assigned_to:
        return
    eng = db.query(models.ITEngineer).filter(models.ITEngineer.name == task.assigned_to).first()

    freq_label = {"daily": "يومية", "weekly": "أسبوعية", "monthly": "شهرية", "one_time": "لمرة واحدة"}.get(task.frequency, task.frequency)

    if overdue and task.frequency == "one_time":
        task_date = task.task_date.date() if isinstance(task.task_date, datetime) else task.task_date
        days_late = (date.today() - task_date).days
        message = f"⚠️ مهمة متأخرة: \"{task.title}\" كان موعدها من {days_late} يوم ولسه مش منجزة"
    elif overdue:
        message = f"⚠️ لسه ما اتعملتش مهمة {freq_label}: \"{task.title}\" — فاتت الفترة اللي فاتت وجه ميعادها تاني"
    else:
        message = f"🔔 تذكير بمهمة {freq_label}: \"{task.title}\" مستحقة اليوم"

    # keep a recurring task's date field pointing at TODAY's occurrence —
    # otherwise it stays frozen at whenever the task was first created and
    # looks like it never actually renewed, even though it did
    if task.frequency in ("daily", "weekly", "monthly"):
        today = date.today()
        task.task_date = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    db.add(models.Notification(
        engineer_name=task.assigned_to,
        engineer_email=eng.email if eng else "",
        # ticket_id/ticket_title predate this feature and are still NOT NULL
        # at the DB level (adding a column can't relax an existing SQLite
        # column's constraint) — task_id is the real reference, these are
        # just harmless placeholders the frontend never reads.
        ticket_id=0,
        ticket_title=task.title,
        task_id=task.id,
        message=message,
        is_read="false",
        email_sent="false",
    ))
    task.last_reminded_at = datetime.utcnow()
    db.commit()
    logger.info(f"Reminded {task.assigned_to} about task #{task.id} ({task.frequency})")


class TaskReminderService:
    def __init__(self):
        self.running = False
        self._thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="task-reminders")
        self._thread.start()

    def stop(self):
        self.running = False

    @property
    def is_running(self):
        return self.running and (self._thread is not None) and self._thread.is_alive()

    def _loop(self):
        logger.info("Task reminder watcher started")
        while self.running:
            try:
                self._check_all()
            except Exception as e:
                logger.error(f"Task reminder check error: {e}")
            for _ in range(CHECK_INTERVAL_SECONDS):
                if not self.running:
                    break
                time.sleep(1)

    def _check_all(self):
        import models
        from database import SessionLocal
        db = SessionLocal()
        try:
            today = date.today()
            _reset_recurring_cycles(db, today)
            tasks = db.query(models.EngineerTask).filter(models.EngineerTask.status != "done").all()
            for task in tasks:
                if _already_reminded_today(task, today):
                    continue
                # A one-time task can be overdue on any day past its date; a
                # recurring one only ever fires ON its due day (daily/weekly/
                # monthly) — being "overdue" there just changes the wording,
                # not whether it fires today.
                if task.frequency == "one_time":
                    if _is_overdue(task, today):
                        _remind(task, db, overdue=True)
                    elif _is_due_today(task, today):
                        _remind(task, db, overdue=False)
                elif _is_due_today(task, today):
                    _remind(task, db, overdue=_is_overdue(task, today))
        finally:
            db.close()


service = TaskReminderService()
