import random
from typing import Optional
from sqlalchemy.orm import Session
import models


def find_routed_engineer(title: str, description: str, db: Session) -> Optional[str]:
    """Return the engineer name whose routing rule matches the ticket's text, or None.

    A rule's engineer_name may list several engineers separated by commas
    (e.g. two people sharing responsibility for network/cameras) — one of
    them is picked at random so tickets get spread across the team.
    """
    text = f"{title or ''} {description or ''}".lower()
    if not text.strip():
        return None

    rules = (
        db.query(models.TicketRoutingRule)
        .filter(models.TicketRoutingRule.active == "true")
        .order_by(models.TicketRoutingRule.priority_order, models.TicketRoutingRule.id)
        .all()
    )
    for rule in rules:
        keywords = [k.strip().lower() for k in rule.keywords.split(",") if k.strip()]
        if any(kw in text for kw in keywords):
            engineers = [e.strip() for e in rule.engineer_name.split(",") if e.strip()]
            return random.choice(engineers) if engineers else None
    return None
