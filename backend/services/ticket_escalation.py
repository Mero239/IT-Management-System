import logging
import threading
import time

logger = logging.getLogger("ticket_escalation")

CHECK_INTERVAL_SECONDS = 300  # 5 minutes


def _escalate_ticket(ticket, db):
    import models

    admins = db.query(models.ITEngineer).filter(
        models.ITEngineer.permission_level == "admin",
        models.ITEngineer.active == "true",
    ).all()

    reason = "متجاوزة الموعد (SLA)" if ticket.sla_status == "breached" else "قريبة من تجاوز الموعد (SLA)"
    message = f"⚠️ تصعيد تلقائي: تذكرة #{ticket.id} \"{ticket.title}\" {reason}"

    for admin in admins:
        notif = models.Notification(
            engineer_name=admin.name,
            engineer_email=admin.email,
            ticket_id=ticket.id,
            ticket_title=ticket.title,
            message=message,
            is_read="false",
            email_sent="false",
        )
        db.add(notif)

    db.add(models.TicketComment(
        ticket_id=ticket.id, author_name="النظام",
        content=f"تم تصعيد التذكرة تلقائيًا — {reason}، ولم يتم اتخاذ إجراء كافٍ في الوقت المناسب",
        type="activity",
    ))
    ticket.escalated = "true"
    db.commit()
    logger.info(f"Escalated ticket #{ticket.id} ({reason})")


class TicketEscalationService:
    def __init__(self):
        self.running = False
        self._thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="ticket-escalation")
        self._thread.start()

    def stop(self):
        self.running = False

    @property
    def is_running(self):
        return self.running and (self._thread is not None) and self._thread.is_alive()

    def _loop(self):
        logger.info("Ticket escalation watcher started")
        while self.running:
            try:
                self._check_all()
            except Exception as e:
                logger.error(f"Escalation check error: {e}")
            for _ in range(CHECK_INTERVAL_SECONDS):
                if not self.running:
                    break
                time.sleep(1)

    def _check_all(self):
        import models
        from database import SessionLocal
        db = SessionLocal()
        try:
            open_tickets = db.query(models.SupportTicket).filter(
                models.SupportTicket.status.in_(["open", "in_progress"]),
                models.SupportTicket.escalated != "true",
            ).all()
            for t in open_tickets:
                if t.sla_status in ("at_risk", "breached"):
                    _escalate_ticket(t, db)
        finally:
            db.close()


service = TicketEscalationService()
