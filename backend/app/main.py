from collections import Counter, defaultdict
from datetime import datetime, timedelta
from io import BytesIO, StringIO
from pathlib import Path

import csv
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .models import Attachment, Category, Comment, Department, Hiccup, StatusHistory, User
from .schemas import CommentCreate, HiccupCreate, HiccupOut, HiccupUpdate
from .security import hash_password, verify_password
from .seed import init_db

VALID_STATUSES = ["Open", "Closed", "Escalated"]
OPEN_STATUSES = {"Open", "Escalated"}
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Hiccup Tracker API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"http://([a-zA-Z0-9.-]+|(\d{1,3}\.){3}\d{1,3}):5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


def with_related(query):
    return query.options(
        joinedload(Hiccup.department),
        joinedload(Hiccup.created_by).joinedload(User.department),
        joinedload(Hiccup.comments).joinedload(Comment.user).joinedload(User.department),
        joinedload(Hiccup.status_history).joinedload(StatusHistory.changed_by).joinedload(User.department),
        joinedload(Hiccup.attachments),
    )


def is_overdue(hiccup: Hiccup) -> bool:
    return hiccup.status in OPEN_STATUSES and hiccup.date_reported < datetime.utcnow() - timedelta(days=7)


def serialize(hiccup: Hiccup) -> HiccupOut:
    out = HiccupOut.model_validate(hiccup)
    out.overdue = is_overdue(hiccup)
    return out


def serialize_user(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "department_id": user.department_id,
        "department": {"id": user.department.id, "name": user.department.name} if user.department else None,
    }


def require_admin(db: Session, admin_user_id: int | None) -> User:
    admin = db.get(User, admin_user_id or 0)
    if not admin or admin.role != "Admin" or not admin.is_active:
        raise HTTPException(403, "Only active admins can manage users")
    return admin


def validate_status(status: str | None) -> None:
    if status and status not in VALID_STATUSES:
        raise HTTPException(400, "Status must be Open, Closed, or Escalated")


def apply_scope(query, user_id: int | None, db: Session):
    if not user_id:
        return query
    user = db.get(User, user_id)
    if not user or user.role in {"Admin", "Manager"}:
        return query
    if user.role == "Department Head" and user.department_id:
        return query.filter(Hiccup.department_id == user.department_id)
    return query.filter(Hiccup.created_by_id == user.id)


def filtered_hiccups(
    db: Session,
    user_id: int | None = None,
    created_by_id: int | None = None,
    search: str | None = None,
    month: int | None = None,
    year: int | None = None,
    department_id: int | None = None,
    status: str | None = None,
    owner: str | None = None,
    sort: str = "created_desc",
):
    query = with_related(db.query(Hiccup))
    query = apply_scope(query, user_id, db)
    if created_by_id:
        query = query.filter(Hiccup.created_by_id == created_by_id)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Hiccup.description.ilike(term), Hiccup.action_taken.ilike(term), Hiccup.owner.ilike(term)))
    if month and year:
        start = datetime(year, month, 1)
        end = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)
        query = query.filter(Hiccup.date_reported >= start, Hiccup.date_reported < end)
    if department_id:
        query = query.filter(Hiccup.department_id == department_id)
    if status:
        query = query.filter(Hiccup.status == status)
    if owner:
        query = query.filter(Hiccup.owner.ilike(f"%{owner}%"))

    if sort == "status":
        return query.order_by(Hiccup.status.asc(), Hiccup.date_reported.desc()).all()
    if sort == "date_asc":
        return query.order_by(Hiccup.date_reported.asc()).all()
    if sort == "date_desc":
        return query.order_by(Hiccup.date_reported.desc()).all()
    return query.order_by(Hiccup.created_at.desc()).all()


@app.get("/api/lookups")
def lookups(db: Session = Depends(get_db)):
    return {
        "departments": db.query(Department).order_by(Department.name).all(),
        "users": [serialize_user(user) for user in db.query(User).options(joinedload(User.department)).order_by(User.name).all()],
        "statuses": VALID_STATUSES,
    }


@app.post("/api/login")
def login(payload: dict, db: Session = Depends(get_db)):
    identifier = (payload.get("identifier") or "").strip()
    password = payload.get("password") or ""
    if not identifier or not password:
        raise HTTPException(400, "Email and password are required")

    user = db.query(User).options(joinedload(User.department)).filter(User.email == identifier.lower()).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return serialize_user(user)


@app.post("/api/departments")
def create_department(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Department name is required")
    department = Department(name=name)
    db.add(department)
    db.commit()
    return {"id": department.id, "name": department.name}


@app.post("/api/users")
def create_user(payload: dict, db: Session = Depends(get_db)):
    require_admin(db, payload.get("admin_user_id"))
    name = (payload.get("name") or "").strip()
    username = (payload.get("username") or "").strip().lower()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not name or not username or not email or not password:
        raise HTTPException(400, "Name, username, email, and password are required")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.query(User).filter(or_(User.email == email, User.username == username)).first():
        raise HTTPException(409, "A user with this username or email already exists")
    user = User(
        name=name,
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=payload.get("role") or "Employee",
        is_active=True,
        department_id=payload.get("department_id") or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.patch("/api/users/{user_id}")
def update_user(user_id: int, payload: dict, db: Session = Depends(get_db)):
    admin = require_admin(db, payload.get("admin_user_id"))
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and payload.get("is_active") is False:
        raise HTTPException(400, "Admins cannot deactivate their own account")

    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Name is required")
        user.name = name
    if "username" in payload:
        username = (payload.get("username") or "").strip().lower()
        if not username:
            raise HTTPException(400, "Username is required")
        if db.query(User).filter(User.username == username, User.id != user.id).first():
            raise HTTPException(409, "A user with this username already exists")
        user.username = username
    if "email" in payload:
        email = (payload.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(400, "Email is required")
        if db.query(User).filter(User.email == email, User.id != user.id).first():
            raise HTTPException(409, "A user with this email already exists")
        user.email = email
    if "role" in payload:
        user.role = payload.get("role") or "Employee"
    if "department_id" in payload:
        user.department_id = payload.get("department_id") or None
    if "is_active" in payload:
        user.is_active = bool(payload.get("is_active"))

    db.commit()
    return serialize_user(db.query(User).options(joinedload(User.department)).filter(User.id == user.id).one())


@app.post("/api/users/{user_id}/reset-password")
def reset_user_password(user_id: int, payload: dict, db: Session = Depends(get_db)):
    require_admin(db, payload.get("admin_user_id"))
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    password = payload.get("password") or ""
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    user.password_hash = hash_password(password)
    db.commit()
    return {"ok": True}


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, admin_user_id: int = Query(...), db: Session = Depends(get_db)):
    admin = require_admin(db, admin_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "Admins cannot delete their own account")

    db.query(Hiccup).filter(Hiccup.created_by_id == user.id).update({Hiccup.created_by_id: admin.id})
    db.query(Comment).filter(Comment.user_id == user.id).update({Comment.user_id: admin.id})
    db.query(StatusHistory).filter(StatusHistory.changed_by_id == user.id).update({StatusHistory.changed_by_id: admin.id})
    db.query(Attachment).filter(Attachment.uploaded_by_id == user.id).update({Attachment.uploaded_by_id: admin.id})
    db.delete(user)
    db.commit()
    return {"ok": True}


@app.patch("/api/users/{user_id}/profile")
def update_own_profile(user_id: int, payload: dict, db: Session = Depends(get_db)):
    if payload.get("current_user_id") != user_id:
        raise HTTPException(403, "Users can only update their own profile")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(404, "User not found")

    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Name is required")
        user.name = name
    if "email" in payload:
        email = (payload.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(400, "Email is required")
        if db.query(User).filter(User.email == email, User.id != user.id).first():
            raise HTTPException(409, "A user with this email already exists")
        user.email = email
    if "password" in payload and payload.get("password"):
        password = payload.get("password")
        if len(password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        user.password_hash = hash_password(password)

    db.commit()
    return serialize_user(db.query(User).options(joinedload(User.department)).filter(User.id == user.id).one())


@app.get("/api/hiccups", response_model=list[HiccupOut])
def list_hiccups(
    user_id: int | None = None,
    created_by_id: int | None = None,
    search: str | None = None,
    month: int | None = None,
    year: int | None = None,
    department_id: int | None = None,
    status: str | None = None,
    owner: str | None = None,
    sort: str = "created_desc",
    db: Session = Depends(get_db),
):
    return [serialize(h) for h in filtered_hiccups(db, user_id, created_by_id, search, month, year, department_id, status, owner, sort)]


@app.post("/api/hiccups", response_model=HiccupOut)
def create_hiccup(payload: HiccupCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    validate_status(data.get("status"))
    if not data.get("category_id"):
        data["category_id"] = default_category_id(db)
    hiccup = Hiccup(**data)
    if hiccup.status == "Closed":
        hiccup.closed_at = datetime.utcnow()
    db.add(hiccup)
    db.flush()
    db.add(StatusHistory(hiccup_id=hiccup.id, old_status=None, new_status=hiccup.status, changed_by_id=payload.created_by_id, note="Created"))
    db.commit()
    return serialize(with_related(db.query(Hiccup)).filter(Hiccup.id == hiccup.id).one())


@app.get("/api/hiccups/{hiccup_id}", response_model=HiccupOut)
def get_hiccup(hiccup_id: int, db: Session = Depends(get_db)):
    hiccup = with_related(db.query(Hiccup)).filter(Hiccup.id == hiccup_id).first()
    if not hiccup:
        raise HTTPException(404, "Hiccup not found")
    return serialize(hiccup)


@app.patch("/api/hiccups/{hiccup_id}", response_model=HiccupOut)
def update_hiccup(hiccup_id: int, payload: HiccupUpdate, db: Session = Depends(get_db)):
    hiccup = db.get(Hiccup, hiccup_id)
    if not hiccup:
        raise HTTPException(404, "Hiccup not found")
    data = payload.model_dump(exclude_unset=True)
    validate_status(data.get("status"))
    old_status = hiccup.status
    changed_by_id = data.pop("changed_by_id", 1)
    for key, value in data.items():
        setattr(hiccup, key, value)
    if "status" in data and data["status"] != old_status:
        hiccup.closed_at = datetime.utcnow() if data["status"] == "Closed" else None
        db.add(StatusHistory(hiccup_id=hiccup.id, old_status=old_status, new_status=data["status"], changed_by_id=changed_by_id, note="Status updated"))
    hiccup.updated_at = datetime.utcnow()
    db.commit()
    return serialize(with_related(db.query(Hiccup)).filter(Hiccup.id == hiccup.id).one())


@app.post("/api/hiccups/{hiccup_id}/comments")
def add_comment(hiccup_id: int, payload: CommentCreate, db: Session = Depends(get_db)):
    if not db.get(Hiccup, hiccup_id):
        raise HTTPException(404, "Hiccup not found")
    db.add(Comment(hiccup_id=hiccup_id, user_id=payload.user_id, body=payload.body))
    db.commit()
    return {"ok": True}


@app.post("/api/hiccups/{hiccup_id}/attachments")
def upload_attachment(hiccup_id: int, user_id: int = Query(1), file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not db.get(Hiccup, hiccup_id):
        raise HTTPException(404, "Hiccup not found")
    safe_name = f"{hiccup_id}_{int(datetime.utcnow().timestamp())}_{file.filename}"
    path = UPLOAD_DIR / safe_name
    path.write_bytes(file.file.read())
    db.add(Attachment(hiccup_id=hiccup_id, filename=file.filename, stored_path=str(path), uploaded_by_id=user_id))
    db.commit()
    return {"filename": file.filename}


def closing_days(rows: list[Hiccup]) -> float:
    closed = [(h.closed_at - h.date_reported).days for h in rows if h.closed_at]
    return round(sum(closed) / len(closed), 1) if closed else 0


def monthly_rows(db: Session, month: int, year: int):
    return filtered_hiccups(db, month=month, year=year)


def rows_between(db: Session, start: datetime, end: datetime):
    return with_related(db.query(Hiccup)).filter(Hiccup.date_reported >= start, Hiccup.date_reported < end).order_by(Hiccup.date_reported.desc()).all()


def dashboard_scope(db: Session, period: str | None, month: int | None, quarter: int | None, year: int | None):
    now = datetime.utcnow()
    selected_period = period or "month"
    selected_year = year or now.year

    if selected_period == "all":
        return filtered_hiccups(db), "All records", None, selected_year

    if selected_period == "year":
        start = datetime(selected_year, 1, 1)
        end = datetime(selected_year + 1, 1, 1)
        return rows_between(db, start, end), str(selected_year), None, selected_year

    if selected_period == "quarter":
        selected_quarter = min(max(quarter or ((now.month - 1) // 3 + 1), 1), 4)
        start_month = (selected_quarter - 1) * 3 + 1
        start = datetime(selected_year, start_month, 1)
        end = datetime(selected_year + (selected_quarter == 4), 1 if selected_quarter == 4 else start_month + 3, 1)
        return rows_between(db, start, end), f"Q{selected_quarter} {selected_year}", selected_quarter, selected_year

    selected_month = month or now.month
    return monthly_rows(db, selected_month, selected_year), f"{selected_month:02d}/{selected_year}", selected_month, selected_year


def default_category_id(db: Session) -> int:
    value = db.query(Category).filter(Category.name == "Other").first() or db.query(Category).first()
    if not value:
        value = Category(name="Other")
        db.add(value)
        db.flush()
    return value.id


def summary_payload(rows: list[Hiccup], month: int | None = None, year: int | None = None):
    dept = Counter(h.department.name for h in rows)
    status = Counter(h.status for h in rows)
    total = len(rows)
    closed = status.get("Closed", 0)
    open_count = total - closed
    summary_text = generate_rule_based_summary(total, closed, open_count, dept, closing_days(rows), month, year)
    return {
        "month": month,
        "year": year,
        "total": total,
        "open": open_count,
        "closed": closed,
        "department_counts": dict(dept),
        "status_counts": dict(status),
        "average_closing_days": closing_days(rows),
        "suggested_summary": summary_text,
    }


def generate_rule_based_summary(total, closed, open_count, dept, avg_days, month, year):
    top_dept = dept.most_common(1)[0][0] if dept else "no department"
    period = f"{month:02d}/{year}" if month and year else "all available records"
    return (
        f"For {period}, the team recorded {total} hiccups. "
        f"{closed} were closed and {open_count} remain open or in progress. "
        f"The highest volume came from {top_dept}. "
        f"Average closing time is {avg_days} days. Management attention should focus on overdue open items and escalated issues."
    )


def generate_ai_summary_placeholder(summary: dict) -> str:
    """Replace this with an OpenAI or internal AI API call when credentials are available."""
    return summary["suggested_summary"]


def selected_month_year(month: int | None, year: int | None):
    now = datetime.utcnow()
    return month or now.month, year or now.year


@app.get("/api/dashboard")
def dashboard(period: str | None = None, month: int | None = None, quarter: int | None = None, year: int | None = None, db: Session = Depends(get_db)):
    rows, scope_label, selected_value, selected_year = dashboard_scope(db, period, month, quarter, year)
    total = len(rows)
    status_counts = Counter(h.status for h in rows)
    overdue = sum(1 for h in rows if is_overdue(h))
    trend = defaultdict(int)
    trend_start = datetime(selected_year, 1, 1)
    trend_end = datetime(selected_year + 1, 1, 1)
    for h in db.query(Hiccup).filter(Hiccup.date_reported >= trend_start, Hiccup.date_reported < trend_end).all():
        trend[h.date_reported.strftime("%Y-%m")] += 1
    return {
        "cards": {
            "total": total,
            "open": sum(1 for h in rows if h.status in OPEN_STATUSES),
            "closed": status_counts.get("Closed", 0),
            "overdue": overdue,
            "average_closing_days": closing_days(rows),
        },
        "by_department": dict(Counter(h.department.name for h in rows)),
        "by_status": dict(status_counts),
        "monthly_trend": dict(sorted(trend.items())),
        "scope": {"period": period or "month", "value": selected_value, "year": selected_year, "label": scope_label},
    }


@app.get("/api/monthly-summary")
def monthly_summary(month: int | None = None, year: int | None = None, db: Session = Depends(get_db)):
    month, year = selected_month_year(month, year)
    return summary_payload(monthly_rows(db, month, year), month, year)


@app.get("/api/monthly-summary/email")
def monthly_email(month: int | None = None, year: int | None = None, db: Session = Depends(get_db)):
    month, year = selected_month_year(month, year)
    summary = summary_payload(monthly_rows(db, month, year), month, year)
    subject_period = f"{month:02d}/{year}"
    body = f"""Subject: Hiccup Summary - {subject_period}

Dear Team,

{summary["suggested_summary"]}

Open vs Closed: {summary["open"]} open / {summary["closed"]} closed
Average Closing Time: {summary["average_closing_days"]} days

Regards,
Operations Team"""
    return {"email": body}


def rows_for_export(rows: list[Hiccup]):
    headers = ["Sr No.", "Date", "Department (where hiccup came)", "Person Sent", "Describe the Situation/Occurrence", "How it was Resolved or Action Taken"]
    data = [
        [index + 1, h.date_reported.strftime("%d.%m.%y"), h.department.name, h.owner or "", h.description, h.action_taken or ""]
        for index, h in enumerate(rows)
    ]
    return headers, data


def hiccup_report_workbook(rows: list[Hiccup], title: str):
    headers, data = rows_for_export(rows)
    wb = Workbook()
    ws = wb.active
    ws.title = "Hiccup Report"
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws.cell(row=1, column=1, value=title)
    ws.cell(row=1, column=1).font = Font(bold=True, size=14, color="FFFFFF")
    ws.cell(row=1, column=1).alignment = Alignment(horizontal="center", vertical="center")
    ws.cell(row=1, column=1).fill = PatternFill("solid", fgColor="102845")
    ws.row_dimensions[1].height = 24
    ws.append(headers)
    for row in data:
        ws.append(row)

    header_fill = PatternFill("solid", fgColor="172033")
    header_font = Font(bold=True, color="FFFFFF")
    border = Border(
        left=Side(style="thin", color="9AA6B5"),
        right=Side(style="thin", color="9AA6B5"),
        top=Side(style="thin", color="9AA6B5"),
        bottom=Side(style="thin", color="9AA6B5"),
    )
    for cell in ws[2]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border
    for row in ws.iter_rows(min_row=3, max_row=ws.max_row, max_col=len(headers)):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = border
    for row_index in range(3, ws.max_row + 1):
        ws.row_dimensions[row_index].height = 46
    widths = [10, 14, 28, 18, 62, 50]
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + index)].width = width
    ws.freeze_panes = "A3"
    ws.auto_filter.ref = f"A2:F{max(ws.max_row, 2)}"
    return wb


def workbook_response(workbook: Workbook, filename: str):
    stream = BytesIO()
    workbook.save(stream)
    return Response(
        stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/export/hiccups.csv")
def export_hiccups_csv(
    user_id: int | None = None,
    created_by_id: int | None = None,
    search: str | None = None,
    month: int | None = None,
    year: int | None = None,
    department_id: int | None = None,
    status: str | None = None,
    owner: str | None = None,
    sort: str = "created_desc",
    db: Session = Depends(get_db),
):
    rows = filtered_hiccups(db, user_id, created_by_id, search, month, year, department_id, status, owner, sort)
    headers, data = rows_for_export(rows)
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(data)
    return Response(buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=hiccups.csv"})


@app.get("/api/export/hiccups.xlsx")
def export_hiccups_xlsx(
    user_id: int | None = None,
    created_by_id: int | None = None,
    search: str | None = None,
    month: int | None = None,
    year: int | None = None,
    department_id: int | None = None,
    status: str | None = None,
    owner: str | None = None,
    sort: str = "created_desc",
    db: Session = Depends(get_db),
):
    rows = filtered_hiccups(db, user_id, created_by_id, search, month, year, department_id, status, owner, sort)
    wb = hiccup_report_workbook(rows, "Hiccup Report")
    return workbook_response(wb, "hiccups.xlsx")


@app.get("/api/export/monthly-summary.csv")
def export_summary_csv(month: int | None = None, year: int | None = None, db: Session = Depends(get_db)):
    month, year = selected_month_year(month, year)
    summary = summary_payload(monthly_rows(db, month, year), month, year)
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Metric", "Value"])
    for key in ["total", "open", "closed", "average_closing_days", "suggested_summary"]:
        writer.writerow([key, summary[key]])
    writer.writerow([])
    writer.writerow(["Department", "Count"])
    writer.writerows(summary["department_counts"].items())
    return Response(buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=monthly_summary.csv"})


@app.get("/api/export/monthly-summary.xlsx")
def export_summary_xlsx(month: int | None = None, year: int | None = None, db: Session = Depends(get_db)):
    month, year = selected_month_year(month, year)
    rows = monthly_rows(db, month, year)
    title = f"Hiccup Report - {month:02d}/{year}"
    wb = hiccup_report_workbook(rows, title)
    return workbook_response(wb, f"hiccup_report_{month:02d}_{year}.xlsx")


@app.get("/api/export/monthly-summary.html")
def export_summary_html(month: int | None = None, year: int | None = None, db: Session = Depends(get_db)):
    month, year = selected_month_year(month, year)
    summary = summary_payload(monthly_rows(db, month, year), month, year)
    title = f"Hiccup Summary {month:02d}/{year}"
    html = f"""<!doctype html><html><head><title>Summary</title><style>body{{font-family:Arial;margin:32px;color:#1f2937}}table{{border-collapse:collapse;width:100%;margin:16px 0}}td,th{{border:1px solid #d1d5db;padding:8px;text-align:left}}h1{{font-size:24px}}</style></head><body><h1>{title}</h1><p>{summary["suggested_summary"]}</p><table><tr><th>Total</th><th>Open</th><th>Closed</th><th>Avg closing days</th></tr><tr><td>{summary["total"]}</td><td>{summary["open"]}</td><td>{summary["closed"]}</td><td>{summary["average_closing_days"]}</td></tr></table><h2>Departments</h2><table>{"".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k,v in summary["department_counts"].items())}</table></body></html>"""
    return Response(html, media_type="text/html")
