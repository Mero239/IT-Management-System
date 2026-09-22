import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import assets, requests, tickets, departments, reports, import_excel, email_agent as email_agent_router, engineers, notifications, auth as auth_router, channels as channels_router, monitor as monitor_router, employees as employees_router, mailboxes as mailboxes_router, licensed_software as licensed_software_router, agreements as agreements_router, ticket_routing as ticket_routing_router, organizations as organizations_router, branches as branches_router, ticket_reports as ticket_reports_router, canned_responses as canned_responses_router, recurring_tickets as recurring_tickets_router, ticket_categories as ticket_categories_router, nav_config as nav_config_router, tasks as tasks_router
from services.email_agent import agent as email_agent, load_config as email_load_config
from services.telegram_bot import bot as telegram_bot, load_config as tg_load_config
from services.monitor import monitor as monitor_service, load_config as mon_load_config
from services.ticket_escalation import service as escalation_service
from services.recurring_tickets import service as recurring_service
from services.ticket_autoclose import service as autoclose_service
from services.task_reminders import service as task_reminder_service

Base.metadata.create_all(bind=engine)


def _auto_add_missing_columns():
    """create_all() only creates brand-new tables — it never ALTERs an
    existing one, so a column added to a model after its table already
    exists in production silently breaks every query against it (exactly
    what happened when last_reminded_at was added to engineer_tasks). This
    keeps existing tables in sync with the models on every startup, without
    needing a real migration tool for what is, so far, always a plain
    ADD COLUMN. Renames/drops/type or constraint changes still need care by
    hand — this only ever adds what's missing."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col in table.columns:
                if col.name in existing_cols:
                    continue
                col_type = col.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}'))


_auto_add_missing_columns()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-start email agent
    cfg = email_load_config()
    if cfg.get("enabled") and cfg.get("password") and cfg.get("claude_api_key"):
        email_agent.start()
    # Auto-start telegram bot
    tg_cfg = tg_load_config()
    if tg_cfg.get("enabled") and tg_cfg.get("token"):
        telegram_bot.start()
    # Auto-start server monitor
    mon_cfg = mon_load_config()
    if mon_cfg.get("enabled") and mon_cfg.get("channel_id"):
        monitor_service.start()
    # These two need no external config — always on.
    escalation_service.start()
    recurring_service.start()
    autoclose_service.start()
    task_reminder_service.start()
    yield
    email_agent.stop()
    telegram_bot.stop()
    monitor_service.stop()
    escalation_service.stop()
    recurring_service.stop()
    autoclose_service.stop()
    task_reminder_service.stop()


app = FastAPI(
    title="نظام إدارة تكنولوجيا المعلومات",
    description="برنامج متكامل لإدارة أصول تكنولوجيا المعلومات وحصر احتياجاتها",
    version="1.0.0",
    lifespan=lifespan,
)

_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:23309", "http://localhost:3000", *_extra_origins],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(departments.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(requests.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(import_excel.router, prefix="/api")
app.include_router(email_agent_router.router, prefix="/api")
app.include_router(engineers.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")
app.include_router(channels_router.router, prefix="/api")
app.include_router(monitor_router.router, prefix="/api")
app.include_router(employees_router.router, prefix="/api")
app.include_router(mailboxes_router.router, prefix="/api")
app.include_router(licensed_software_router.router, prefix="/api")
app.include_router(agreements_router.router, prefix="/api")
app.include_router(ticket_routing_router.router, prefix="/api")
app.include_router(organizations_router.router, prefix="/api")
app.include_router(branches_router.router, prefix="/api")
app.include_router(ticket_reports_router.router, prefix="/api")
app.include_router(canned_responses_router.router, prefix="/api")
app.include_router(recurring_tickets_router.router, prefix="/api")
app.include_router(ticket_categories_router.router, prefix="/api")
app.include_router(nav_config_router.router, prefix="/api")
app.include_router(tasks_router.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "نظام إدارة تكنولوجيا المعلومات - API يعمل بنجاح"}
