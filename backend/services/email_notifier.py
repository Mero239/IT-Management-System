import smtplib
import json
import os
from paths import data_path
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("email_notifier")

CONFIG_PATH = data_path("email_agent_config.json")

# Inline base64 logo so it always renders regardless of mail client / hosting domain
LOGO_DATA_URI = "data:image/png;base64,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"
LOGO_IMG_TAG = (
    '<img src="' + LOGO_DATA_URI + '" alt="Mobica" '
    'style="height: 26px; width: auto; background: #ffffff; border-radius: 8px; padding: 6px 14px;" />'
)


def _load_smtp_cfg() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}


def send_password_reset_email(engineer_name: str, engineer_email: str, reset_link: str) -> bool:
    cfg = _load_smtp_cfg()
    sender = cfg.get("email", "it.support@mobica.net")
    password = cfg.get("password", "")
    if not password:
        logger.warning("SMTP password not configured — skipping password reset email")
        return False

    subject = "إعادة تعيين كلمة المرور — نظام إدارة IT"
    html_body = f"""
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: #059669; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        {LOGO_IMG_TAG}
        <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Mobica IT Support</p>
      </div>
      <div style="background: white; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">مرحباً <strong>{engineer_name}</strong>،</p>
        <p style="color: #475569; line-height: 1.6;">
          تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في نظام إدارة IT.
          اضغط على الزر أدناه لتعيين كلمة مرور جديدة.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_link}"
             style="background: #059669; color: white; text-decoration: none; padding: 14px 32px;
                    border-radius: 10px; font-size: 15px; font-weight: bold; display: inline-block;">
            🔑 إعادة تعيين كلمة المرور
          </a>
        </div>

        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
          <p style="margin: 0; color: #854d0e; font-size: 13px;">
            ⏳ هذا الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط.
          </p>
        </div>

        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin-bottom: 0;">
          إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد — لن يتغير شيء في حسابك.
          <br>الرابط: <span style="color: #059669; word-break: break-all;">{reset_link}</span>
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        IT Support System — Mobica
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"IT Support <{sender}>"
    msg["To"] = engineer_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP("Imap.worldposta.com", 587, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, [engineer_email], msg.as_string())
        server.quit()
        logger.info(f"Password reset email sent to {engineer_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {engineer_email}: {e}")
        return False


def send_otp_email(engineer_name: str, engineer_email: str, code: str) -> bool:
    cfg = _load_smtp_cfg()
    sender = cfg.get("email", "it.support@mobica.net")
    password = cfg.get("password", "")
    if not password:
        logger.warning("SMTP password not configured — skipping OTP email")
        return False

    subject = "كود التحقق (OTP) لإعادة تعيين كلمة المرور — نظام إدارة IT"
    html_body = f"""
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: #059669; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        {LOGO_IMG_TAG}
        <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Mobica IT Support</p>
      </div>
      <div style="background: white; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">مرحباً <strong>{engineer_name}</strong>،</p>
        <p style="color: #475569; line-height: 1.6;">
          تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك. استخدم الكود أدناه لإتمام العملية:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <span style="background: #f0fdf4; border: 2px dashed #059669; color: #059669; letter-spacing: 6px;
                       padding: 16px 32px; border-radius: 10px; font-size: 28px; font-weight: bold; display: inline-block;">
            {code}
          </span>
        </div>

        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
          <p style="margin: 0; color: #854d0e; font-size: 13px;">
            ⏳ هذا الكود صالح لمدة <strong>10 دقائق</strong> فقط.
          </p>
        </div>

        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin-bottom: 0;">
          إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد — لن يتغير شيء في حسابك.
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        IT Support System — Mobica
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"IT Support <{sender}>"
    msg["To"] = engineer_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP("Imap.worldposta.com", 587, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, [engineer_email], msg.as_string())
        server.quit()
        logger.info(f"OTP email sent to {engineer_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {engineer_email}: {e}")
        return False


def send_otp_admin_notice(engineer_name: str, engineer_email: str, admin_email: str) -> bool:
    """Notify the admin whenever an engineer/viewer requests a password reset OTP."""
    cfg = _load_smtp_cfg()
    sender = cfg.get("email", "it.support@mobica.net")
    password = cfg.get("password", "")
    if not password:
        logger.warning("SMTP password not configured — skipping OTP admin notice")
        return False

    subject = f"تنبيه: طلب إعادة تعيين كلمة مرور — {engineer_name}"
    html_body = f"""
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: #b45309; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        {LOGO_IMG_TAG}
        <h1 style="color: white; margin: 10px 0 0 0; font-size: 18px;">🔔 تنبيه أمني</h1>
        <p style="color: #fde68a; margin: 8px 0 0 0; font-size: 14px;">Mobica IT Support</p>
      </div>
      <div style="background: white; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <p style="color: #475569; line-height: 1.6;">
          المستخدم <strong>{engineer_name}</strong> ({engineer_email}) طلب إعادة تعيين كلمة المرور،
          وتم إرسال كود تحقق (OTP) إلى بريده الإلكتروني مباشرة.
        </p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin-bottom: 0;">
          هذه رسالة إعلامية فقط — لا حاجة لأي إجراء منك. إذا لم يكن الطلب متوقعًا، راجع حساب المستخدم من صفحة إدارة المهندسين.
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        IT Support System — Mobica
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"IT Support <{sender}>"
    msg["To"] = admin_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP("Imap.worldposta.com", 587, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, [admin_email], msg.as_string())
        server.quit()
        logger.info(f"OTP admin notice sent to {admin_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP admin notice to {admin_email}: {e}")
        return False


STATUS_LABELS_AR = {"open": "مفتوحة", "in_progress": "قيد التنفيذ", "resolved": "محلولة", "closed": "مغلقة"}


def send_ticket_status_update_email(requester_name: str, requester_email: str, ticket_id: int, ticket_title: str, new_status: str, resolution: str = "") -> bool:
    cfg = _load_smtp_cfg()
    sender = cfg.get("email", "it.support@mobica.net")
    password = cfg.get("password", "")
    if not password or not requester_email:
        return False

    status_label = STATUS_LABELS_AR.get(new_status, new_status)
    subject = f"[تذكرة #{ticket_id}] تحديث الحالة: {status_label}"

    resolution_block = ""
    if resolution:
        resolution_block = f"""
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0; color: #166534; font-weight: bold; font-size: 13px;">خطوات الحل</p>
          <p style="margin: 0; color: #166534; font-size: 14px; white-space: pre-line;">{resolution}</p>
        </div>
        """

    html_body = f"""
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: #059669; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        {LOGO_IMG_TAG}
      </div>
      <div style="background: white; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">مرحباً <strong>{requester_name or ''}</strong>،</p>
        <p style="color: #475569;">تم تحديث حالة تذكرتك:</p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #334155; font-weight: bold; font-size: 14px;">🎫 تذكرة رقم #{ticket_id}</p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;">{ticket_title}</p>
          <span style="display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: bold;">
            {status_label}
          </span>
        </div>
        {resolution_block}
        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          لو محتاج أي تواصل إضافي بخصوص التذكرة دي، رد على الإيميل ده.
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        IT Support System — Mobica
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"IT Support <{sender}>"
    msg["To"] = requester_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP("Imap.worldposta.com", 587, timeout=15)
        server.ehlo(); server.starttls(); server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, [requester_email], msg.as_string())
        server.quit()
        logger.info(f"Status update email sent to {requester_email} for ticket #{ticket_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send status update email to {requester_email}: {e}")
        return False


def send_csat_request_email(requester_name: str, requester_email: str, ticket_id: int, ticket_title: str, rate_url: str) -> bool:
    cfg = _load_smtp_cfg()
    sender = cfg.get("email", "it.support@mobica.net")
    password = cfg.get("password", "")
    if not password or not requester_email:
        return False

    subject = f"[Ticket #{ticket_id}] Rate your experience"
    stars = "".join(
        f'<a href="{rate_url}&rating={i}" style="text-decoration:none; font-size: 34px; margin: 0 4px; color: #f59e0b;">★</a>'
        for i in range(1, 6)
    )

    html_body = f"""
    <div dir="ltr" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: #059669; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        {LOGO_IMG_TAG}
      </div>
      <div style="background: white; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 16px; color: #1e293b;">Hello <strong>{requester_name or ''}</strong>,</p>
        <p style="color: #475569;">
          Your ticket <strong>#{ticket_id}</strong> ("{ticket_title}") has been resolved — how was your experience with us?
        </p>
        <div style="margin: 24px 0;">{stars}</div>
        <p style="color: #94a3b8; font-size: 13px;">Click the number of stars that reflects your rating (1 = lowest, 5 = highest)</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
          Need further assistance? Contact IT Support — ext. 526
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        IT Support System — Mobica
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"IT Support <{sender}>"
    msg["To"] = requester_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP("Imap.worldposta.com", 587, timeout=15)
        server.ehlo(); server.starttls(); server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, [requester_email], msg.as_string())
        server.quit()
        logger.info(f"CSAT request email sent to {requester_email} for ticket #{ticket_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send CSAT request email to {requester_email}: {e}")
        return False


def send_assignment_email(engineer_name: str, engineer_email: str, ticket_id: int, ticket_title: str, requester_name: str = "") -> bool:
    cfg = _load_smtp_cfg()
    sender = cfg.get("email", "it.support@mobica.net")
    password = cfg.get("password", "")
    if not password:
        logger.warning("SMTP password not configured — skipping email")
        return False

    subject = f"[تذكرة #{ticket_id}] تم تحويل تذكرة دعم فني إليك"

    html_body = f"""
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: #059669; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        {LOGO_IMG_TAG}
      </div>
      <div style="background: white; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">مرحباً <strong>{engineer_name}</strong>،</p>
        <p style="color: #475569;">تم تحويل تذكرة دعم فني إليك وتحتاج إلى متابعتك:</p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #166534; font-weight: bold; font-size: 14px;">
            🎫 تذكرة رقم #{ticket_id}
          </p>
          <p style="margin: 0; color: #166534; font-size: 15px;">{ticket_title}</p>
          {f'<p style="margin: 8px 0 0 0; color: #15803d; font-size: 13px;">من: {requester_name}</p>' if requester_name else ''}
        </div>

        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          يرجى مراجعة التذكرة في أقرب وقت ممكن والتواصل مع مقدم الطلب.
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">
        IT Support System — Mobica
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"IT Support <{sender}>"
    msg["To"] = engineer_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        server = smtplib.SMTP("Imap.worldposta.com", 587, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(sender, password)
        server.sendmail(sender, [engineer_email], msg.as_string())
        server.quit()
        logger.info(f"Email sent to {engineer_email} for ticket #{ticket_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {engineer_email}: {e}")
        return False
