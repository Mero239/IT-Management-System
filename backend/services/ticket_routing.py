import json
import logging
import random
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from paths import data_path
import models

logger = logging.getLogger("ticket_routing")

ROUTING_PROMPT = """You are an IT support ticket router. Below is a numbered list of categories,
each with a few example phrases (not exhaustive — a ticket describing the same underlying
problem in different words still counts as a match, e.g. "my laptop is old and slow, can I
get a replacement" matches a "new device request" category even without the word "buy").

Step 1: List every category that plausibly applies to this ticket.
Step 2: If more than one applies (e.g. a location category like "Tower branch" and a topic
category like "network issue" both apply because the network problem happens to be at the
Tower), pick whichever of those appears FIRST in the list below — earlier categories always
override later ones for ties like this.
Step 3: If truly no category applies, the answer is "none".

Ticket:
Title: {title}
Description: {description}

Categories (in priority order):
{categories}

Reply with ONLY the final category number, or the word "none". No explanation, no punctuation."""


def _gemini_key() -> str:
    try:
        with open(data_path("email_agent_config.json")) as f:
            return json.load(f).get("gemini_api_key", "")
    except Exception:
        return ""


def _least_busy(names: list, db: Session) -> Optional[str]:
    """Pick whichever of these engineers currently has the fewest open/in-progress
    tickets, so a shared rule spreads work by actual load instead of pure chance.
    Ties (including the common case of everyone at 0) are broken randomly."""
    if not names:
        return None
    if len(names) == 1:
        return names[0]
    counts = dict(
        db.query(models.SupportTicket.assigned_to, func.count(models.SupportTicket.id))
        .filter(
            models.SupportTicket.assigned_to.in_(names),
            models.SupportTicket.status.in_(["open", "in_progress"]),
        )
        .group_by(models.SupportTicket.assigned_to)
        .all()
    )
    load = {n: counts.get(n, 0) for n in names}
    min_load = min(load.values())
    candidates = [n for n, c in load.items() if c == min_load]
    return random.choice(candidates)


def _pick_engineer(rule: "models.TicketRoutingRule", db: Session) -> Optional[str]:
    engineers = [e.strip() for e in rule.engineer_name.split(",") if e.strip()]
    return _least_busy(engineers, db) if engineers else None


def _keyword_match(text: str, rules: list) -> Optional["models.TicketRoutingRule"]:
    for rule in rules:
        keywords = [k.strip().lower() for k in rule.keywords.split(",") if k.strip()]
        if any(kw in text for kw in keywords):
            return rule
    return None


def _ai_match(title: str, description: str, rules: list) -> Optional["models.TicketRoutingRule"]:
    api_key = _gemini_key()
    if not api_key:
        return None

    categories = "\n".join(
        f"{i+1}. {rule.keywords}" for i, rule in enumerate(rules)
    )
    prompt = ROUTING_PROMPT.format(title=title or "", description=description or "", categories=categories)

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(model="gemini-2.5-flash-lite", contents=prompt)
        answer = (resp.text or "").strip().lower()
        if answer == "none" or not answer:
            return None
        idx = int("".join(ch for ch in answer if ch.isdigit()) or -1) - 1
        if 0 <= idx < len(rules):
            return rules[idx]
        return None
    except Exception as e:
        logger.warning(f"AI routing failed, falling back to keyword match: {e}")
        return None


def find_routed_engineer(title: str, description: str, db: Session) -> Optional[str]:
    """Return the engineer name whose routing rule matches the ticket's text, or None.

    Tries Gemini first to understand the ticket's actual intent (reusing the
    same rules as categories); falls back to plain keyword substring matching
    if no AI key is configured or the call fails, so ticket creation never
    breaks because of this.

    A rule's engineer_name may list several engineers separated by commas
    (e.g. two people sharing responsibility for network/cameras) — whoever
    currently has the fewest open tickets is picked, so work stays balanced
    across the team instead of split by pure chance.
    """
    matched = _match_rule(title, description, db)
    return _pick_engineer(matched, db) if matched else None


def _match_rule(title: str, description: str, db: Session) -> Optional["models.TicketRoutingRule"]:
    text = f"{title or ''} {description or ''}".strip()
    if not text:
        return None

    rules = (
        db.query(models.TicketRoutingRule)
        .filter(models.TicketRoutingRule.active == "true")
        .order_by(models.TicketRoutingRule.priority_order, models.TicketRoutingRule.id)
        .all()
    )
    if not rules:
        return None

    matched = _ai_match(title, description, rules)
    if matched is None:
        matched = _keyword_match(text.lower(), rules)
    return matched


def find_routing_match(title: str, description: str, db: Session) -> Optional[dict]:
    """Like find_routed_engineer, but also returns every engineer listed on the
    matched rule (not just the one randomly picked as the ticket's owner) —
    used so a rule shared by several engineers (e.g. laptop purchases going to
    both Amr Issa and Mahmoud Farag) can notify all of them, not only whoever
    ends up as assigned_to."""
    rule = _match_rule(title, description, db)
    if not rule:
        return None
    names = [n.strip() for n in rule.engineer_name.split(",") if n.strip()]
    emails = [e.strip() for e in (rule.engineer_email or "").split(",") if e.strip()]
    engineers = [
        {"name": n, "email": emails[i] if i < len(emails) else ""}
        for i, n in enumerate(names)
    ]
    if not engineers:
        return None
    return {"assigned_to": _least_busy(names, db), "engineers": engineers}
