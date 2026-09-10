import json
import logging
import os
from paths import data_path
import subprocess
import threading
import time
from datetime import datetime

import psutil
import paramiko
import requests

logger = logging.getLogger("monitor")

CONFIG_PATH = data_path("monitor_config.json")
TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
WHATSAPP_API = "https://graph.facebook.com/v20.0/{phone_number_id}/messages"

DEFAULT_CONFIG = {
    "enabled": False,
    "channel_id": "",
    "schedule": ["07:30", "11:00", "15:00", "16:50"],
    "alert_interval_minutes": 60,
    "thresholds": {"cpu": 85, "ram": 90, "disk": 85},
    # WhatsApp (Meta Cloud API) — bootstrap defaults only, real values live in
    # the gitignored monitor_config.json. Recipients must have messaged the
    # sending number first (or a template must be used) per WhatsApp policy.
    "whatsapp_enabled": False,
    "whatsapp_access_token": "",
    "whatsapp_phone_number_id": "",
    "whatsapp_recipients": [],
    # Bootstrap defaults only — real values live in the gitignored monitor_config.json
    # and take over via load_config()'s shallow merge. Never hardcode real credentials here.
    "servers": [
        {"name": "IT Support AI",      "ip": "192.1.1.180", "os": "none"},
        {"name": "Domain Controller",  "ip": "192.1.1.23",  "os": "none"},
        {"name": "DHCP Server",        "ip": "192.1.1.229", "os": "windows", "ssh_user": "", "ssh_pass": ""},
        {"name": "File Server",        "ip": "192.1.1.244", "os": "none"},
        {"name": "TriForma2025",       "ip": "192.1.16.14", "os": "none"},
        {"name": "mobica-library-fac", "ip": "192.1.5.130", "os": "none"},
    ],
}


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        return {**DEFAULT_CONFIG, **cfg}
    return DEFAULT_CONFIG.copy()


def save_config(cfg: dict):
    merged = {**DEFAULT_CONFIG, **cfg}
    with open(CONFIG_PATH, "w") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)


def _tg_token() -> str:
    tg_cfg_path = data_path("telegram_config.json")
    try:
        with open(tg_cfg_path) as f:
            return json.load(f).get("token", "")
    except Exception:
        return ""


def send_telegram(channel_id: str, message: str):
    token = _tg_token()
    if not token or not channel_id:
        return
    url = TELEGRAM_API.format(token=token)
    try:
        requests.post(url, json={"chat_id": channel_id, "text": message, "parse_mode": "HTML"}, timeout=10)
    except Exception as e:
        logger.warning(f"Telegram alert error: {e}")


def _tg_html_to_whatsapp(text: str) -> str:
    """Convert Telegram's <b>..</b> HTML formatting to WhatsApp's *bold* markup."""
    return text.replace("<b>", "*").replace("</b>", "*")


def send_whatsapp(cfg: dict, message: str):
    """Send a plain-text WhatsApp message via Meta's Cloud API to every configured recipient.

    Note: outside the 24h customer-service window WhatsApp only allows
    pre-approved message templates — a free-text send like this one will be
    rejected for recipients who haven't messaged the sending number recently.
    """
    if not cfg.get("whatsapp_enabled"):
        return
    token = cfg.get("whatsapp_access_token", "")
    phone_number_id = cfg.get("whatsapp_phone_number_id", "")
    recipients = cfg.get("whatsapp_recipients", [])
    if not token or not phone_number_id or not recipients:
        return

    url = WHATSAPP_API.format(phone_number_id=phone_number_id)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    for raw_number in recipients:
        to = "".join(ch for ch in raw_number if ch.isdigit())
        if not to:
            continue
        try:
            resp = requests.post(
                url, headers=headers, timeout=10,
                json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": message}},
            )
            if resp.status_code >= 400:
                logger.warning(f"WhatsApp send failed for {to}: {resp.status_code} {resp.text[:300]}")
        except Exception as e:
            logger.warning(f"WhatsApp alert error for {to}: {e}")


# ── Server checks ────────────────────────────────────────────────────────────

def ping(ip: str) -> bool:
    result = subprocess.run(["ping", "-c", "1", "-W", "2", ip], capture_output=True)
    return result.returncode == 0


def ssh_stats_linux(ip: str, user: str, password: str) -> dict | None:
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username=user, password=password, timeout=8)
        _, out, _ = ssh.exec_command("top -bn1 | grep Cpu | awk '{print $2}'")
        cpu = out.read().decode().strip().replace(",", ".")
        _, out, _ = ssh.exec_command("free | awk '/Mem:/ {printf \"%.1f\", $3/$2*100}'")
        ram = out.read().decode().strip()
        _, out, _ = ssh.exec_command("df -h / | awk 'NR==2 {print $5}' | tr -d '%'")
        disk = out.read().decode().strip()
        ssh.close()
        return {"cpu": cpu, "ram": ram, "disk": disk}
    except Exception as e:
        logger.debug(f"SSH linux {ip}: {e}")
        return None


def ssh_stats_windows(ip: str, user: str, password: str) -> dict | None:
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username=user, password=password, timeout=8)
        _, out, _ = ssh.exec_command(
            'powershell "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average"'
        )
        cpu = out.read().decode().strip()
        _, out, _ = ssh.exec_command(
            'powershell "$os = Get-WmiObject Win32_OperatingSystem; [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize * 100, 1)"'
        )
        ram = out.read().decode().strip()
        _, out, _ = ssh.exec_command(
            'powershell "$d = Get-PSDrive C; [math]::Round($d.Used/($d.Used+$d.Free)*100,1)"'
        )
        disk = out.read().decode().strip()
        ssh.close()
        return {"cpu": cpu, "ram": ram, "disk": disk}
    except Exception as e:
        logger.debug(f"SSH windows {ip}: {e}")
        return None


def local_stats() -> dict:
    cpu  = psutil.cpu_percent(interval=1)
    ram  = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu":        round(cpu, 1),
        "ram":        round(ram.percent, 1),
        "ram_used_gb": round(ram.used / 1024**3, 1),
        "ram_total_gb": round(ram.total / 1024**3, 1),
        "disk":       round(disk.percent, 1),
        "disk_free_gb": round(disk.free / 1024**3, 1),
    }


# ── Report builder ───────────────────────────────────────────────────────────

def build_report(cfg: dict) -> str:
    now   = datetime.now().strftime("%Y-%m-%d %H:%M")
    ls    = local_stats()
    lines = [
        "📊 <b>تقرير MOBICA IT</b>",
        f"🕐 {now}\n",
        "🖥️ <b>IT Management Server</b>",
        f"• CPU: {ls['cpu']}%",
        f"• RAM: {ls['ram']}% ({ls['ram_used_gb']}GB / {ls['ram_total_gb']}GB)",
        f"• Disk: {ls['disk']}% (متاح {ls['disk_free_gb']}GB)\n",
        "🌐 <b>حالة السيرفرات</b>",
    ]

    for srv in cfg.get("servers", []):
        ip     = srv["ip"]
        is_up  = ping(ip)
        status = "🟢 يعمل" if is_up else "🔴 لا يستجيب"
        line   = f"• {srv['name']} ({ip}): {status}"

        if is_up and srv.get("os") == "linux" and srv.get("ssh_user"):
            stats = ssh_stats_linux(ip, srv["ssh_user"], srv["ssh_pass"])
            if stats:
                line += f"\n  └ CPU:{stats['cpu']}% RAM:{stats['ram']}% Disk:{stats['disk']}%"

        elif is_up and srv.get("os") == "windows" and srv.get("ssh_user"):
            stats = ssh_stats_windows(ip, srv["ssh_user"], srv["ssh_pass"])
            if stats:
                line += f"\n  └ CPU:{stats['cpu']}% RAM:{stats['ram']}% Disk:{stats['disk']}%"

        lines.append(line)

    return "\n".join(lines)


def check_local_alerts(cfg: dict) -> list[str]:
    th    = cfg.get("thresholds", DEFAULT_CONFIG["thresholds"])
    ls    = local_stats()
    alerts = []
    if ls["cpu"]  > th["cpu"]:  alerts.append(f"🔥 CPU مرتفع: {ls['cpu']}%")
    if ls["ram"]  > th["ram"]:  alerts.append(f"💾 RAM مرتفع: {ls['ram']}%")
    if ls["disk"] > th["disk"]: alerts.append(f"💿 Disk ممتلئ: {ls['disk']}%")
    return alerts


def check_server_alerts(cfg: dict) -> list[str]:
    alerts = []
    for srv in cfg.get("servers", []):
        if not ping(srv["ip"]):
            alerts.append(f"🔴 {srv['name']} ({srv['ip']}) لا يستجيب!")
    return alerts


# ── Background service ───────────────────────────────────────────────────────

class MonitorService:
    def __init__(self):
        self.running    = False
        self._thread    = None
        self._last_alert_times: dict[str, float] = {}  # key → last sent timestamp

    def start(self) -> bool:
        if self.running:
            return True
        cfg = load_config()
        if not cfg.get("enabled") or not cfg.get("channel_id"):
            return False
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="monitor")
        self._thread.start()
        logger.info("Monitor service started")
        return True

    def stop(self):
        self.running = False
        logger.info("Monitor service stopped")

    @property
    def is_running(self):
        return self.running and (self._thread is not None) and self._thread.is_alive()

    def send_report_now(self):
        cfg = load_config()
        report = build_report(cfg)
        send_telegram(cfg["channel_id"], report)
        send_whatsapp(cfg, _tg_html_to_whatsapp(report))
        return report

    def _loop(self):
        sent_schedules: set[str] = set()
        last_check = 0.0

        while self.running:
            cfg         = load_config()
            channel_id  = cfg.get("channel_id", "")
            schedule    = cfg.get("schedule", [])
            alert_interval = cfg.get("alert_interval_minutes", 60) * 60
            now_str     = datetime.now().strftime("%H:%M")
            now_ts      = time.time()

            # ── Scheduled reports ────────────────────────────────────────
            if now_str in schedule:
                if now_str not in sent_schedules:
                    try:
                        report = build_report(cfg)
                        send_telegram(channel_id, report)
                        send_whatsapp(cfg, _tg_html_to_whatsapp(report))
                        logger.info(f"Scheduled report sent at {now_str}")
                    except Exception as e:
                        logger.error(f"Report error: {e}")
                    sent_schedules.add(now_str)
            else:
                sent_schedules.discard(now_str)

            # ── Alert checks (every 60 seconds) ──────────────────────────
            if now_ts - last_check >= 60:
                last_check = now_ts
                try:
                    for alert in check_local_alerts(cfg) + check_server_alerts(cfg):
                        last = self._last_alert_times.get(alert, 0)
                        if now_ts - last > alert_interval:
                            alert_msg = f"⚠️ <b>تنبيه MOBICA IT</b>\n{alert}"
                            send_telegram(channel_id, alert_msg)
                            send_whatsapp(cfg, _tg_html_to_whatsapp(alert_msg))
                            self._last_alert_times[alert] = now_ts
                except Exception as e:
                    logger.error(f"Alert check error: {e}")

            time.sleep(30)


monitor = MonitorService()
