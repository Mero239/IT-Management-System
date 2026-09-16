import logging
import threading
import time

logger = logging.getLogger("ticket_escalation")

CHECK_INTERVAL_SECONDS = 300  # 5 minutes


def _nudge_engineer(ticket, db):
    """Early, gentle heads-up sent straight to the assigned engineer while a
    ticket is only at_risk — most tickets should get handled here and never
    reach the admin-facing escalation below."""
    import models

    if not ticket.assigned_to:
        return
    eng = db.query(models.ITEngineer).filter(models.ITEngineer.name == ticket.assigned_to).first()
    message = f"⏰ تذكرة #{ticket.id} \"{ticket.title}\" قريبة من تجاوز موعد الـ SLA — يُفضّل المتابعة قريبًا"

    notif = models.Notification(
        engineer_name=ticket.assigned_to,
        engineer_email=eng.email if eng else "",
        ticket_id=ticket.id,
        ticket_title=ticket.title,
        message=message,
        is_read="false",
        email_sent="false",
    )
    db.add(notif)
    ticket.sla_nudged = "true"
    db.commit()
    notif_id = notif.id

    if eng and eng.email:
        from services.email_notifier import send_assignment_email
        from database import SessionLocal

        def _send():
            sent = send_assignment_email(eng.name, eng.email, ticket.id, f"[تذكير SLA] {ticket.title}", ticket.requester_name or "")
            if sent:
                session = SessionLocal()
                try:
                    n = session.query(models.Notification).filter(models.Notification.id == notif_id).first()
                    if n:
                        n.email_sent = "true"
                        session.commit()
                finally:
                    session.close()

        threading.Thread(target=_send, daemon=True).start()

    logger.info(f"Nudged {ticket.assigned_to} about at-risk ticket #{ticket.id}")


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
            ).all()
            for t in open_tickets:
                if t.sla_status == "breached" and t.escalated != "true":
                    _escalate_ticket(t, db)
                elif t.sla_status == "at_risk" and t.sla_nudged != "true":
                    _nudge_engineer(t, db)
        finally:
            db.close()


service = TicketEscalationService()
