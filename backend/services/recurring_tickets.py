import logging
import threading
import time
from datetime import datetime

logger = logging.getLogger("recurring_tickets")


def _is_due(template, now: datetime) -> bool:
    """Has this template's schedule come around since it last fired?"""
    last = template.last_created_at
    if template.frequency == "daily":
        return last is None or last.date() < now.date()
    if template.frequency == "weekly":
        if template.day_of_week is None or now.weekday() != template.day_of_week:
            return False
        return last is None or last.date() < now.date()
    if template.frequency == "monthly":
        target_day = template.day_of_month or 1
        if now.day != min(target_day, 28):
            return False
        return last is None or (last.year, last.month) != (now.year, now.month)
    return False


def create_ticket_from_template(template, db) -> int:
    import models
    from services.ticket_routing import find_routed_engineer

    assigned_to = template.assigned_to
    ticket = models.SupportTicket(
        title=template.title,
        description=template.description,
        category=template.category,
        priority=template.priority,
        department_id=template.department_id,
        organization_id=template.organization_id,
        branch_id=template.branch_id,
        assigned_to=assigned_to,
        status="open",
        source="manual",
        recurring_template_id=template.id,
    )
    if not ticket.assigned_to:
        routed = find_routed_engineer(ticket.title, ticket.description, db)
        if routed:
            ticket.assigned_to = routed
    db.add(ticket)
    template.last_created_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    db.add(models.TicketComment(
        ticket_id=ticket.id, author_name="النظام",
        content="تم إنشاء هذه التذكرة تلقائيًا من قالب دوري مجدول",
        type="activity",
    ))
    db.commit()
    logger.info(f"Created recurring ticket #{ticket.id} from template '{template.title}'")
    return ticket.id


class RecurringTicketService:
    def __init__(self):
        self.running = False
        self._thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="recurring-tickets")
        self._thread.start()

    def stop(self):
        self.running = False

    @property
    def is_running(self):
        return self.running and (self._thread is not None) and self._thread.is_alive()

    def _loop(self):
        logger.info("Recurring ticket scheduler started")
        last_check_minute = None
        while self.running:
            try:
                now = datetime.utcnow()
                minute_key = now.strftime("%Y-%m-%d %H:%M")
                if minute_key != last_check_minute:
                    last_check_minute = minute_key
                    self._check_all()
            except Exception as e:
                logger.error(f"Recurring ticket check error: {e}")
            time.sleep(30)

    def _check_all(self):
        import models
        from database import SessionLocal
        db = SessionLocal()
        try:
            now = datetime.utcnow()
            templates = db.query(models.RecurringTicketTemplate).filter(
                models.RecurringTicketTemplate.active == "true"
            ).all()
            for tpl in templates:
                if _is_due(tpl, now):
                    create_ticket_from_template(tpl, db)
        finally:
            db.close()


service = RecurringTicketService()
