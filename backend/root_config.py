# The single "root" account — identified by email, not a database-editable
# flag, so no admin can grant themselves (or anyone else) root by mutating a
# row. It sits above 'admin': it's protected from being edited, demoted,
# deactivated, or deleted by any other admin, and it bypasses the ticket
# deletion restriction (see routes/tickets.py DELETE_TICKETS_ALLOWED_EMAIL).
ROOT_EMAIL = "abo.hagar309@gmail.com"


def is_root(engineer) -> bool:
    return bool(engineer and (engineer.email or "").strip().lower() == ROOT_EMAIL)


def is_root_email(email: str) -> bool:
    return bool(email) and email.strip().lower() == ROOT_EMAIL
