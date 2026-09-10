from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from datetime import datetime, timedelta

# Max resolution time per ticket priority, in hours.
SLA_HOURS_BY_PRIORITY = {"critical": 4, "high": 24, "medium": 72, "low": 168}


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    manager = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("Asset", back_populates="department")
    requests = relationship("NeedsRequest", back_populates="department")
    tickets = relationship("SupportTicket", back_populates="department")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    asset_type = Column(String(50), nullable=False)  # hardware, software, network, other
    serial_number = Column(String(100), unique=True, nullable=True)
    brand = Column(String(100))
    model = Column(String(100))
    purchase_date = Column(String(50))
    warranty_expiry = Column(String(50))
    status = Column(String(50), default="active")  # active, inactive, maintenance, retired
    location = Column(String(200))
    assigned_to = Column(String(200))
    employee_code = Column(String(100))
    cost_center = Column(String(100))
    branch = Column(String(100))
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="assets")


class NeedsRequest(Base):
    __tablename__ = "needs_requests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    requester_name = Column(String(200))
    requester_email = Column(String(200))
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    asset_type = Column(String(50))
    quantity = Column(Integer, default=1)
    estimated_cost = Column(String(100))
    currency = Column(String(10), default="USD")
    priority = Column(String(50), default="medium")  # low, medium, high, critical
    status = Column(String(50), default="pending")   # pending, approved, rejected, fulfilled
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="requests")


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    requester_name = Column(String(200))
    requester_email = Column(String(200))
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    priority = Column(String(50), default="medium")      # low, medium, high, critical
    status = Column(String(50), default="open")          # open, in_progress, resolved, closed
    assigned_to = Column(String(200))
    resolution = Column(Text)
    source = Column(String(50), default="manual")        # manual, email
    source_email_id = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="tickets")
    comments = relationship("TicketComment", back_populates="ticket", order_by="TicketComment.created_at")

    @property
    def sla_hours(self) -> int:
        return SLA_HOURS_BY_PRIORITY.get(self.priority, 72)

    @property
    def sla_due_at(self):
        if not self.created_at:
            return None
        return self.created_at + timedelta(hours=self.sla_hours)

    @property
    def sla_status(self) -> str:
        """on_time | at_risk | breached | met — computed from priority + timestamps, not stored."""
        due = self.sla_due_at
        if not due:
            return "on_time"
        if self.status in ("resolved", "closed"):
            finished_at = self.updated_at or self.created_at
            return "breached" if finished_at > due else "met"
        now = datetime.utcnow()
        if now > due:
            return "breached"
        total_seconds = self.sla_hours * 3600
        remaining = (due - now).total_seconds()
        if total_seconds and remaining / total_seconds <= 0.2:
            return "at_risk"
        return "on_time"


class ITEngineer(Base):
    __tablename__ = "it_engineers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    employee_code = Column(String(50), nullable=True, index=True)
    role = Column(String(100), default="IT Engineer")
    active = Column(String(10), default="true")
    # permission_level: admin | engineer | viewer
    permission_level = Column(String(20), default="engineer")
    password_hash = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Mailbox(Base):
    """Exchange/O365 mailbox directory imported from Excel report."""
    __tablename__ = "mailboxes"
    id = Column(Integer, primary_key=True, index=True)
    account_id     = Column(String(50),  nullable=True, index=True)
    account_name   = Column(String(200), nullable=True)
    display_name   = Column(String(200), nullable=True)
    email          = Column(String(200), unique=True, nullable=False, index=True)
    domain         = Column(String(100), nullable=True, index=True)
    first_name     = Column(String(100), nullable=True)
    last_name      = Column(String(100), nullable=True)
    department     = Column(String(200), nullable=True)
    job_title      = Column(String(200), nullable=True)
    mobile_phone   = Column(String(50),  nullable=True)
    business_phone = Column(String(50),  nullable=True)
    office         = Column(String(100), nullable=True)
    status         = Column(String(10),  nullable=True, index=True)  # "active" | "inactive"
    create_date    = Column(String(20),  nullable=True)
    total_items    = Column(Integer,     nullable=True)
    total_size_mb  = Column(Integer,     nullable=True)
    attachment_size = Column(String(100), nullable=True)
    mobile_device  = Column(String(5),   nullable=True)   # "true" | "false"
    last_logon     = Column(DateTime,    nullable=True)
    last_logoff    = Column(DateTime,    nullable=True)
    imported_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())


class Employee(Base):
    """Company-wide employee directory (imported from Excel)."""
    __tablename__ = "employees"
    id            = Column(Integer,     primary_key=True, index=True)
    employee_code = Column(String(50),  nullable=True, index=True)
    name          = Column(String(200), nullable=True)   # derived from email username
    name_ar       = Column(String(300), nullable=True)   # Arabic full name from HR file
    email         = Column(String(200), unique=True, nullable=True, index=True)
    domain        = Column(String(100), nullable=True)
    company       = Column(String(200), nullable=True)   # الشركة
    sector        = Column(String(300), nullable=True)   # الوعاء / القطاع
    hire_date     = Column(String(20),  nullable=True)   # تاريخ التعيين
    birth_date    = Column(String(20),  nullable=True)   # تاريخ الميلاد
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())


class TicketComment(Base):
    __tablename__ = "ticket_comments"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    author_name = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    # type: "comment" = user comment, "activity" = system event (status change, assign, etc.)
    type = Column(String(20), default="comment")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("SupportTicket", back_populates="comments")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    engineer_name = Column(String(200), nullable=False)
    engineer_email = Column(String(200), nullable=False)
    ticket_id = Column(Integer, nullable=False)
    ticket_title = Column(String(500), nullable=False)
    message = Column(String(500))
    is_read = Column(String(5), default="false")   # "true" | "false"
    email_sent = Column(String(5), default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    engineer_id = Column(Integer, ForeignKey("it_engineers.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(100), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(String(5), default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PasswordResetOTP(Base):
    """One-time password codes for the engineer/viewer self-service reset flow."""
    __tablename__ = "password_reset_otps"
    id = Column(Integer, primary_key=True, index=True)
    engineer_id = Column(Integer, ForeignKey("it_engineers.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(String(5), default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SupportAgreement(Base):
    """IT support agreement / SLA documents (PDF files) uploaded by admins."""
    __tablename__ = "support_agreements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    stored_filename = Column(String(300), nullable=False)     # name on disk
    original_filename = Column(String(300), nullable=False)   # name shown to users
    file_size = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(500), unique=True, nullable=False)
    subject = Column(String(500))
    sender = Column(String(200))
    ticket_id = Column(Integer, nullable=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())


class LicensedSoftware(Base):
    """Licensed software register: software name, department, assigned user, license renewal date."""
    __tablename__ = "licensed_software"
    id = Column(Integer, primary_key=True, index=True)
    software_name = Column(String(200), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    user_name = Column(String(200), nullable=True)
    quantity = Column(Integer, default=1)
    license_renewal_date = Column(String(20), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department")
