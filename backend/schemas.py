from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DepartmentBase(BaseModel):
    name: str
    manager: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssetBase(BaseModel):
    name: str
    asset_type: str
    serial_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    status: str = "active"
    location: Optional[str] = None
    assigned_to: Optional[str] = None
    employee_code: Optional[str] = None
    cost_center: Optional[str] = None
    branch: Optional[str] = None
    department_id: Optional[int] = None
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    pass


class AssetOut(AssetBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department: Optional[DepartmentOut] = None

    model_config = {"from_attributes": True}


class NeedsRequestBase(BaseModel):
    title: str
    description: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    department_id: Optional[int] = None
    asset_type: Optional[str] = None
    quantity: int = 1
    estimated_cost: Optional[str] = None
    currency: str = "USD"
    priority: str = "medium"
    status: str = "pending"
    notes: Optional[str] = None


class NeedsRequestCreate(NeedsRequestBase):
    pass


class NeedsRequestOut(NeedsRequestBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department: Optional[DepartmentOut] = None

    model_config = {"from_attributes": True}


class SupportTicketBase(BaseModel):
    title: str
    description: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    department_id: Optional[int] = None
    priority: str = "medium"
    status: str = "open"
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None


class SupportTicketCreate(SupportTicketBase):
    source: Optional[str] = "manual"


class SupportTicketOut(SupportTicketBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department: Optional[DepartmentOut] = None
    sla_hours: Optional[int] = None
    sla_due_at: Optional[datetime] = None
    sla_status: Optional[str] = None

    model_config = {"from_attributes": True}


class MailboxOut(BaseModel):
    id: int
    account_id: Optional[str] = None
    display_name: Optional[str] = None
    email: str
    domain: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    mobile_phone: Optional[str] = None
    business_phone: Optional[str] = None
    office: Optional[str] = None
    status: Optional[str] = None
    create_date: Optional[str] = None
    total_items: Optional[int] = None
    total_size_mb: Optional[int] = None
    attachment_size: Optional[str] = None
    mobile_device: Optional[str] = None
    last_logon: Optional[datetime] = None
    last_logoff: Optional[datetime] = None
    imported_at: Optional[datetime] = None
    # enriched from Employee table
    employee_code: Optional[str] = None
    name_ar: Optional[str] = None

    model_config = {"from_attributes": True}


class MailboxImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    total: int


class EmployeeOut(BaseModel):
    id: int
    employee_code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    email: Optional[str] = None
    domain: Optional[str] = None
    company: Optional[str] = None
    sector: Optional[str] = None
    hire_date: Optional[str] = None
    birth_date: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmployeeImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    total: int


class LicensedSoftwareBase(BaseModel):
    software_name: str
    department_id: Optional[int] = None
    user_name: Optional[str] = None
    quantity: int = 1
    license_renewal_date: Optional[str] = None
    notes: Optional[str] = None


class LicensedSoftwareCreate(LicensedSoftwareBase):
    pass


class LicensedSoftwareOut(LicensedSoftwareBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department: Optional[DepartmentOut] = None

    model_config = {"from_attributes": True}


class SupportAgreementOut(BaseModel):
    id: int
    title: str
    original_filename: str
    file_size: int
    uploaded_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReportStats(BaseModel):
    total_assets: int
    active_assets: int
    maintenance_assets: int
    retired_assets: int
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int
    total_departments: int
