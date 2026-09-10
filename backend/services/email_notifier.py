import smtplib
import json
import os
from paths import data_path
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("email_notifier")

CONFIG_PATH = data_path("email_agent_config.json")


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
        <h1 style="color: white; margin: 0; font-size: 20px;">💻 نظام إدارة تكنولوجيا المعلومات</h1>
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
        <h1 style="color: white; margin: 0; font-size: 20px;">💻 نظام إدارة تكنولوجيا المعلومات</h1>
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
        <h1 style="color: white; margin: 0; font-size: 20px;">🔔 تنبيه أمني</h1>
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
        <h1 style="color: white; margin: 0; font-size: 20px;">💻 نظام إدارة تكنولوجيا المعلومات</h1>
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
