from datetime import date, datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class EmployeeRole(PyEnum):
    AGENT = "AGENT"
    LEAD = "LEAD"
    FLOATER = "FLOATER"


class CalendarMode(PyEnum):
    ALL_365 = "ALL_365"
    EXCL_PH = "EXCL_PH"
    EXCL_SUN_PH = "EXCL_SUN_PH"


class AssignmentType(PyEnum):
    PRIMARY = "PRIMARY"
    BACKUP = "BACKUP"


class HolidayScope(PyEnum):
    COMPANY = "COMPANY"
    BRAND = "BRAND"


class LeaveType(PyEnum):
    PLANNED = "PLANNED"
    COMP_OFF = "COMP_OFF"
    SICK = "SICK"


class LeaveStatus(PyEnum):
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"


class RosterStatus(PyEnum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    PUBLISHED = "PUBLISHED"


class DayStatus(PyEnum):
    WORK = "WORK"
    WO = "WO"
    PH = "PH"
    LEAVE = "LEAVE"
    COMP_OFF = "COMP_OFF"


class EntrySource(PyEnum):
    GENERATED = "GENERATED"
    MANUAL = "MANUAL"
    SUGGESTION = "SUGGESTION"


class UserRole(PyEnum):
    MANAGER = "MANAGER"
    POD_LEAD = "POD_LEAD"
    EMPLOYEE = "EMPLOYEE"


class ApprovalStatus(PyEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"


class Pod(Base):
    __tablename__ = "pod"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    lead_employee_id: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("employee.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    lead_employee: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[lead_employee_id], back_populates="led_pod")
    employees: Mapped[list["Employee"]] = relationship("Employee", foreign_keys="Employee.pod_id", back_populates="pod")


class Employee(Base):
    __tablename__ = "employee"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pod_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("pod.id"), nullable=False)
    role: Mapped[EmployeeRole] = mapped_column(Enum(EmployeeRole), nullable=False, default=EmployeeRole.AGENT)
    preferred_off_days: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False, default=list)
    max_consecutive_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=6)
    max_cover_per_day: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=2)
    active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    pod: Mapped["Pod"] = relationship("Employee", foreign_keys=[pod_id], back_populates="employees")
    led_pod: Mapped[Optional["Pod"]] = relationship("Pod", foreign_keys=[Pod.lead_employee_id], back_populates="lead_employee")
    assignments: Mapped[list["Assignment"]] = relationship("Assignment", back_populates="employee", cascade="all, delete-orphan")
    leaves: Mapped[list["Leave"]] = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")
    roster_entries: Mapped[list["RosterEntry"]] = relationship("RosterEntry", back_populates="employee", cascade="all, delete-orphan")
    cover_assignments: Mapped[list["CoverAssignment"]] = relationship("CoverAssignment", back_populates="employee", cascade="all, delete-orphan")
    app_user: Mapped[Optional["AppUser"]] = relationship("AppUser", back_populates="employee", uselist=False)

    __table_args__ = (
        CheckConstraint("max_consecutive_days between 1 and 14", name="ck_employee_max_consecutive_days"),
        CheckConstraint("max_cover_per_day >= 0", name="ck_employee_max_cover_per_day"),
        Index("employee_pod_idx", "pod_id"),
    )


class Brand(Base):
    __tablename__ = "brand"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    processes: Mapped[list["Process"]] = relationship("Process", back_populates="brand", cascade="all, delete-orphan")
    holidays: Mapped[list["Holiday"]] = relationship("Holiday", back_populates="brand", cascade="all, delete-orphan")


class Process(Base):
    __tablename__ = "process"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    brand_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("brand.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    calendar_mode: Mapped[CalendarMode] = mapped_column(Enum(CalendarMode), nullable=False)
    min_coverage: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    brand: Mapped["Brand"] = relationship("Process", back_populates="processes")
    assignments: Mapped[list["Assignment"]] = relationship("Assignment", back_populates="process", cascade="all, delete-orphan")
    coverage_overrides: Mapped[list["CoverageOverride"]] = relationship("CoverageOverride", back_populates="process", cascade="all, delete-orphan")
    cover_assignments: Mapped[list["CoverAssignment"]] = relationship("CoverAssignment", back_populates="process", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("min_coverage >= 0", name="ck_process_min_coverage"),
        UniqueConstraint("brand_id", "name", name="uq_process_brand_name"),
        Index("process_brand_idx", "brand_id"),
    )


class CoverageOverride(Base):
    __tablename__ = "coverage_override"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    process_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("process.id", ondelete="CASCADE"), nullable=False)
    weekday: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    min_coverage: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    process: Mapped["Process"] = relationship("CoverageOverride", back_populates="coverage_overrides")

    __table_args__ = (
        CheckConstraint("weekday between 0 and 6", name="ck_coverage_override_weekday"),
        CheckConstraint("min_coverage >= 0", name="ck_coverage_override_min_coverage"),
        CheckConstraint("(weekday is not null) <> (date is not null)", name="ck_coverage_override_weekday_xor_date"),
        Index("override_process_idx", "process_id"),
    )


class Assignment(Base):
    __tablename__ = "assignment"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    process_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("process.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[AssignmentType] = mapped_column(Enum(AssignmentType), nullable=False, default=AssignmentType.PRIMARY)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employee: Mapped["Employee"] = relationship("Assignment", back_populates="assignments")
    process: Mapped["Process"] = relationship("Assignment", back_populates="assignments")

    __table_args__ = (
        UniqueConstraint("employee_id", "process_id", name="uq_assignment_employee_process"),
        Index("assignment_process_idx", "process_id"),
    )


class Holiday(Base):
    __tablename__ = "holiday"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    scope: Mapped[HolidayScope] = mapped_column(Enum(HolidayScope), nullable=False, default=HolidayScope.COMPANY)
    brand_id: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("brand.id", ondelete="CASCADE"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    brand: Mapped[Optional["Brand"]] = relationship("Holiday", back_populates="holidays")

    __table_args__ = (
        CheckConstraint("(scope = 'BRAND') = (brand_id is not null)", name="ck_holiday_scope_brand"),
        UniqueConstraint("date", "scope", "brand_id", name="uq_holiday_date_scope_brand", postgresql_nulls_not_distinct=True),
    )


class Leave(Base):
    __tablename__ = "leave"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[LeaveType] = mapped_column(Enum(LeaveType), nullable=False)
    status: Mapped[LeaveStatus] = mapped_column(Enum(LeaveStatus), nullable=False, default=LeaveStatus.APPROVED)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("auth.users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employee: Mapped["Employee"] = relationship("Leave", back_populates="leaves")

    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_leave_end_after_start"),
        Index("leave_employee_idx", "employee_id", "start_date", "end_date"),
    )


class Roster(Base):
    __tablename__ = "roster"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    month: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    status: Mapped[RosterStatus] = mapped_column(Enum(RosterStatus), nullable=False, default=RosterStatus.DRAFT)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("auth.users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    entries: Mapped[list["RosterEntry"]] = relationship("RosterEntry", back_populates="roster", cascade="all, delete-orphan")
    cover_assignments: Mapped[list["CoverAssignment"]] = relationship("CoverAssignment", back_populates="roster", cascade="all, delete-orphan")
    approvals: Mapped[list["RosterApproval"]] = relationship("RosterApproval", back_populates="roster", cascade="all, delete-orphan")
    change_logs: Mapped[list["ChangeLog"]] = relationship("ChangeLog", back_populates="roster", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("month ~ '^\\d{4}-(0[1-9]|1[0-2])$'", name="ck_roster_month_format"),
    )


class RosterEntry(Base):
    __tablename__ = "roster_entry"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    roster_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("roster.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[DayStatus] = mapped_column(Enum(DayStatus), nullable=False)
    locked: Mapped[bool] = mapped_column(nullable=False, default=False)
    source: Mapped[EntrySource] = mapped_column(Enum(EntrySource), nullable=False, default=EntrySource.GENERATED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    roster: Mapped["Roster"] = relationship("RosterEntry", back_populates="entries")
    employee: Mapped["Employee"] = relationship("RosterEntry", back_populates="roster_entries")

    __table_args__ = (
        UniqueConstraint("roster_id", "employee_id", "date", name="uq_roster_entry_roster_employee_date"),
        Index("entry_roster_date_idx", "roster_id", "date"),
        Index("entry_employee_idx", "employee_id"),
    )


class CoverAssignment(Base):
    __tablename__ = "cover_assignment"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    roster_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("roster.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("employee.id", ondelete="CASCADE"), nullable=False)
    process_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("process.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[EntrySource] = mapped_column(Enum(EntrySource), nullable=False, default=EntrySource.GENERATED)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    roster: Mapped["Roster"] = relationship("CoverAssignment", back_populates="cover_assignments")
    employee: Mapped["Employee"] = relationship("CoverAssignment", back_populates="cover_assignments")
    process: Mapped["Process"] = relationship("CoverAssignment", back_populates="cover_assignments")

    __table_args__ = (
        UniqueConstraint("roster_id", "employee_id", "process_id", "date", name="uq_cover_assignment_roster_emp_proc_date"),
    )


class RosterApproval(Base):
    __tablename__ = "roster_approval"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    roster_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("roster.id", ondelete="CASCADE"), nullable=False)
    pod_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("pod.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(Enum(ApprovalStatus), nullable=False, default=ApprovalStatus.PENDING)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("auth.users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    roster: Mapped["Roster"] = relationship("RosterApproval", back_populates="approvals")
    pod: Mapped["Pod"] = relationship("RosterApproval", backref="approvals")

    __table_args__ = (
        UniqueConstraint("roster_id", "pod_id", name="uq_roster_approval_roster_pod"),
    )


class ChangeLog(Base):
    __tablename__ = "change_log"

    id: Mapped[UUID] = mapped_column(PG_UUID, primary_key=True, default=uuid4)
    roster_id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("roster.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("auth.users.id"), nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    before: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_change: Mapped[bool] = mapped_column(nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    roster: Mapped["Roster"] = relationship("ChangeLog", back_populates="change_logs")

    __table_args__ = (
        Index("change_log_roster_idx", "roster_id", "created_at", postgresql_using="btree", postgresql_ops={"created_at": "DESC"}),
    )


class Setting(Base):
    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AppUser(Base):
    __tablename__ = "app_user"

    id: Mapped[UUID] = mapped_column(PG_UUID, ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    employee_id: Mapped[UUID | None] = mapped_column(PG_UUID, ForeignKey("employee.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employee: Mapped[Optional["Employee"]] = relationship("AppUser", back_populates="app_user", uselist=False)

    __table_args__ = (
        CheckConstraint("role = 'MANAGER' or employee_id is not null", name="ck_app_user_role_employee"),
    )


class ExplanationCache(Base):
    __tablename__ = "explanation_cache"

    issue_hash: Mapped[str] = mapped_column(String, primary_key=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("source in ('ai','template')", name="ck_explanation_cache_source"),
    )