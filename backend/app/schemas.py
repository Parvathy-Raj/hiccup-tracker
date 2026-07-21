from datetime import datetime

from pydantic import BaseModel


class LookupOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    name: str
    username: str | None = None
    email: str
    role: str
    is_active: bool = True
    department_id: int | None
    department: LookupOut | None = None

    class Config:
        from_attributes = True


class HiccupBase(BaseModel):
    date_reported: datetime
    department_id: int
    description: str
    action_taken: str | None = None
    owner: str | None = None
    status: str = "Open"


class HiccupCreate(HiccupBase):
    created_by_id: int
    category_id: int | None = None


class HiccupUpdate(BaseModel):
    status: str | None = None
    owner: str | None = None
    action_taken: str | None = None
    closing_remarks: str | None = None
    changed_by_id: int = 1


class CommentCreate(BaseModel):
    user_id: int
    body: str


class CommentOut(BaseModel):
    id: int
    body: str
    created_at: datetime
    user: UserOut

    class Config:
        from_attributes = True


class StatusHistoryOut(BaseModel):
    id: int
    old_status: str | None
    new_status: str
    changed_at: datetime
    note: str | None
    changed_by: UserOut

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class HiccupOut(HiccupBase):
    id: int
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    created_by: UserOut
    department: LookupOut
    comments: list[CommentOut] = []
    status_history: list[StatusHistoryOut] = []
    attachments: list[AttachmentOut] = []
    overdue: bool = False

    class Config:
        from_attributes = True
