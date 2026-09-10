import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import assets, requests, tickets, departments, reports, import_excel, email_agent as email_agent_router, engineers, notifications, auth as auth_router, channels as channels_router, monitor as monitor_router, employees as employees_router, mailboxes as mailboxes_router, licensed_software as licensed_software_router, agreements as agreements_router, ticket_routing as ticket_routing_router
from services.email_agent import agent as email_agent, load_config as email_load_config
from services.telegram_bot import bot as telegram_bot, load_config as tg_load_config
from services.monitor import monitor as monitor_service, load_config as mon_load_config

Base.metadata.create_all(bind=engine)


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
    yield
    email_agent.stop()
    telegram_bot.stop()
    monitor_service.stop()


app = FastAPI(
    title="نظام إدارة تكنولوجيا المعلومات",
    description="برنامج متكامل لإدارة أصول تكنولوجيا المعلومات وحصر احتياجاتها",
    version="1.0.0",
    lifespan=lifespan,
)

_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", *_extra_origins],
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


@app.get("/")
def root():
    return {"message": "نظام إدارة تكنولوجيا المعلومات - API يعمل بنجاح"}
