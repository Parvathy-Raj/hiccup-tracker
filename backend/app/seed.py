from datetime import datetime, timedelta

from sqlalchemy import inspect, text

from .database import Base, SessionLocal, engine
from .models import Category, Department, Hiccup, StatusHistory, User
from .security import hash_password

DEPARTMENTS = ["Accounts", "Logistics", "Quality", "Warehouse", "Sales Admin", "Procurement"]
CATEGORIES = [
    "Delayed Dispatch",
    "Missing Documents",
    "Stock Mismatch",
    "Supplier Delay",
    "Wrong Item",
    "Quality Issue",
    "Invoice Issue",
    "Courier Issue",
    "System Entry Error",
    "Other",
]

USERS = [
    ("Stephen", "stephen", "admin@kienticsgroup.com", "Kinetics@123", "Admin", "Logistics"),
    ("Bilal Khan", "bilal", "bilal@internal.local", "Kinetics@123", "Department Head", "Warehouse"),
    ("Carla Dsouza", "carla", "carla@internal.local", "Kinetics@123", "Manager", None),
    ("Deepak Rao", "deepak", "deepak@internal.local", "Kinetics@123", "Employee", "Accounts"),
    ("Farhan Ali", "farhan", "farhan@internal.local", "Kinetics@123", "Department Head", "Procurement"),
]

SAMPLE_HICCUPS = [
    ("Logistics", "Delayed Dispatch", "Al Noor Trading", "SO-24011", "FG-1042", "Dispatch missed carrier cutoff after pick list was released late.", "Customer delivery delayed by one day.", "Pick list queue was not monitored after lunch.", "Added 3 PM dispatch queue review.", "Stephen", "Open", 2),
    ("Accounts", "Invoice Issue", "Blue Ocean LLC", "INV-8821", "", "Invoice posted with incorrect VAT treatment.", "Credit note required and payment follow-up paused.", "Tax code selected manually.", "Accounts checklist updated.", "Deepak Rao", "Closed", 9),
    ("Warehouse", "Wrong Item", "Metro Projects", "SO-24035", "FG-1190", "Picker staged alternate item with similar packaging.", "Replacement dispatch needed.", "Bin labels were faded.", "Relabeled affected aisle.", "Bilal Khan", "Closed", 14),
    ("Procurement", "Supplier Delay", "Gulf Components", "PO-5520", "RM-3301", "Supplier confirmed shipment three days after promised date.", "Production schedule moved.", "Supplier capacity issue.", "Escalated to supplier account manager.", "Farhan Ali", "Escalated", 5),
    ("Quality", "Quality Issue", "Prime Retail", "SO-24040", "FG-1012", "Customer reported damaged outer cartons.", "Return inspection opened.", "Courier handling issue suspected.", "Photos requested from customer.", "Carla Dsouza", "Open", 4),
    ("Sales Admin", "Missing Documents", "Eastline FZE", "SHIP-1192", "", "Delivery note was not attached to shipment packet.", "Customer receiving team held GRN.", "Print batch skipped final document.", "Added document check before handover.", "Stephen", "Closed", 18),
    ("Logistics", "Courier Issue", "Green Mart", "AWB-74420", "FG-1088", "Courier updated tracking as attempted while warehouse was open.", "Urgent reorder requested by customer.", "Driver route issue.", "Raised complaint with courier.", "Stephen", "Open", 7),
    ("Accounts", "System Entry Error", "Delta Build", "SO-23991", "FG-1120", "Sales order currency entered incorrectly.", "Margin report showed variance.", "Copied old customer template.", "Corrected entry and informed sales.", "Deepak Rao", "Closed", 21),
    ("Warehouse", "Stock Mismatch", "Internal", "CNT-230", "RM-1180", "Cycle count variance found in fast moving component.", "Picking paused for verification.", "Manual adjustment pending approval.", "Count submitted for approval.", "Bilal Khan", "Open", 3),
    ("Procurement", "Missing Documents", "Zenith Supply", "PO-5602", "RM-3009", "Certificate of origin missing from supplier docs.", "Customs clearance risk.", "Supplier document pack incomplete.", "Supplier asked to courier original.", "Farhan Ali", "Open", 8),
    ("Quality", "Wrong Item", "Nova Interiors", "SO-24050", "FG-1215", "Returned sample did not match approved finish.", "Replacement approval delayed.", "Supplier packed old revision.", "Blocked old revision in item master.", "Carla Dsouza", "Escalated", 1),
    ("Logistics", "Delayed Dispatch", "Crescent Foods", "SO-24055", "FG-1160", "Truck booking was missed for consolidated load.", "Delivery rolled to next route.", "Booking request not assigned.", "Added owner field to booking tracker.", "Stephen", "Open", 10),
    ("Sales Admin", "Invoice Issue", "Urban Works", "INV-8899", "", "Invoice reference did not match customer's PO.", "Payment processing delayed.", "PO copied from earlier order.", "Reissued invoice.", "Deepak Rao", "Closed", 16),
    ("Warehouse", "Courier Issue", "Bright Stores", "AWB-74900", "FG-1065", "Courier collected one carton less than manifest.", "Short delivery investigation opened.", "Manifest count not checked at dock.", "Dock count sign-off introduced.", "Bilal Khan", "Open", 6),
    ("Procurement", "Supplier Delay", "Oceanic Metals", "PO-5614", "RM-4111", "Supplier split delivery without notice.", "Partial production run only.", "Shipment consolidation failure.", "Alternative supplier quote requested.", "Farhan Ali", "Open", 13),
    ("Quality", "Quality Issue", "Al Maha", "SO-24064", "FG-1099", "Inspection found label adhesive failure.", "Batch held before dispatch.", "Wrong label stock used.", "Label stock quarantined.", "Carla Dsouza", "Closed", 23),
    ("Accounts", "Missing Documents", "Falcon MEP", "INV-8931", "", "Signed delivery note missing for invoice submission.", "Invoice submission postponed.", "Archive scan failed.", "Requested POD from customer service.", "Deepak Rao", "Open", 15),
    ("Logistics", "System Entry Error", "Internal", "SHIP-1211", "FG-1177", "Shipment weight entered in kg instead of cartons.", "Courier quote inflated.", "Unit field overlooked.", "Corrected shipment and retrained coordinator.", "Stephen", "Closed", 20),
    ("Warehouse", "Delayed Dispatch", "Palm Retail", "SO-24072", "FG-1244", "Packed order stayed in staging overnight.", "Customer escalation received.", "No final loading scan.", "Added staging sweep at shift end.", "Bilal Khan", "Open", 9),
]


def ensure_user_auth_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("users"):
        return
    columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "username" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(80)"))
        if "password_hash" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
        if "is_active" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))


def backfill_user_auth(db) -> None:
    changed = False
    for user in db.query(User).all():
        if not user.username:
            user.username = user.email.split("@")[0].lower()
            changed = True
        if not user.password_hash:
            user.password_hash = hash_password("Kinetics@123")
            changed = True
        if user.is_active is None:
            user.is_active = True
            changed = True
    if changed:
        db.commit()


def remove_inventory_department(db) -> None:
    inventory = db.query(Department).filter(Department.name == "Inventory").first()
    if not inventory:
        return
    for hiccup in db.query(Hiccup).filter(Hiccup.department_id == inventory.id).all():
        db.delete(hiccup)
    for user in db.query(User).filter(User.department_id == inventory.id).all():
        db.delete(user)
    db.delete(inventory)
    db.commit()


def normalize_hiccup_statuses(db) -> None:
    changed = False
    for hiccup in db.query(Hiccup).all():
        if hiccup.status in {"In Progress", "Repeated"}:
            hiccup.status = "Open"
            hiccup.closed_at = None
            changed = True
    for item in db.query(StatusHistory).all():
        if item.old_status in {"In Progress", "Repeated"}:
            item.old_status = "Open"
            changed = True
        if item.new_status in {"In Progress", "Repeated"}:
            item.new_status = "Open"
            changed = True
    if changed:
        db.commit()


def init_db(force: bool = False) -> None:
    if force:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    ensure_user_auth_columns()
    db = SessionLocal()
    try:
        if db.query(Hiccup).first():
            backfill_user_auth(db)
            remove_inventory_department(db)
            normalize_hiccup_statuses(db)
            return
        departments = {name: Department(name=name) for name in DEPARTMENTS}
        categories = {name: Category(name=name) for name in CATEGORIES}
        db.add_all([*departments.values(), *categories.values()])
        db.flush()

        users = {}
        for name, username, email, password, role, department in USERS:
            user = User(name=name, username=username, email=email, password_hash=hash_password(password), role=role, is_active=True, department=departments.get(department))
            db.add(user)
            users[name] = user
        db.flush()

        now = datetime.utcnow()
        for row in SAMPLE_HICCUPS:
            dept, cat, customer, ref, item, desc, impact, root, action, owner, status, days_ago = row
            closed_at = now - timedelta(days=max(days_ago - 2, 0)) if status == "Closed" else None
            hiccup = Hiccup(
                date_reported=now - timedelta(days=days_ago),
                department=departments[dept],
                category=categories[cat],
                customer_supplier=customer,
                reference_number=ref,
                item_code=item,
                description=desc,
                impact=impact,
                root_cause=root,
                action_taken=action,
                owner=owner,
                status=status,
                closing_remarks="Resolved and communicated." if status == "Closed" else None,
                created_by=users.get(owner) or users["Stephen"],
                created_at=now - timedelta(days=days_ago),
                updated_at=closed_at or now - timedelta(days=max(days_ago - 1, 0)),
                closed_at=closed_at,
            )
            db.add(hiccup)
            db.flush()
            db.add(StatusHistory(hiccup=hiccup, old_status=None, new_status=status, changed_by=users["Stephen"], note="Seeded sample status"))
        db.commit()
        remove_inventory_department(db)
        normalize_hiccup_statuses(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_db(force=True)
