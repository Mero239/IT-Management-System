import logging
import threading
import time
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("ticket_autoclose")

CHECK_INTERVAL_SECONDS = 3600  # 1 hour
AUTO_CLOSE_AFTER_DAYS = 7  # a resolved ticket with no further activity for this long auto-closes


def _autoclose_ticket(ticket, db):
    import models

    ticket.status = "closed"
    db.add(models.TicketComment(
        ticket_id=ticket.id, author_name="النظام",
        content=f"تم إغلاق التذكرة تلقائيًا بعد {AUTO_CLOSE_AFTER_DAYS} أيام من الحل بدون أي نشاط إضافي",
        type="activity",
    ))
    db.commit()
    logger.info(f"Auto-closed ticket #{ticket.id}")


class TicketAutoCloseService:
    def __init__(self):
        self.running = False
        self._thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="ticket-autoclose")
        self._thread.start()

    def stop(self):
        self.running = False

    @property
    def is_running(self):
        return self.running and (self._thread is not None) and self._thread.is_alive()

    def _loop(self):
        logger.info("Ticket auto-close watcher started")
        while self.running:
            try:
                self._check_all()
            except Exception as e:
                logger.error(f"Auto-close check error: {e}")
            for _ in range(CHECK_INTERVAL_SECONDS):
                if not self.running:
                    break
                time.sleep(1)

    def _check_all(self):
        import models
        from database import SessionLocal
        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=AUTO_CLOSE_AFTER_DAYS)
            stale = db.query(models.SupportTicket).filter(
                models.SupportTicket.status == "resolved",
                models.SupportTicket.updated_at < cutoff,
            ).all()
            for t in stale:
                _autoclose_ticket(t, db)
        finally:
            db.close()


service = TicketAutoCloseService()
