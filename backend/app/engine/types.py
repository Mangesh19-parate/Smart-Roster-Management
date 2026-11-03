from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any
from uuid import UUID


class DayStatus(str, Enum):
    WORK = "WORK"
    WO = "WO"
    PH = "PH"
    LEAVE = "LEAVE"
    COMP_OFF = "COMP_OFF"


class CalendarMode(str, Enum):
    ALL_365 = "ALL_365"
    EXCL_PH = "EXCL_PH"
    EXCL_SUN_PH = "EXCL_SUN_PH"


class AssignmentType(str, Enum):
    PRIMARY = "PRIMARY"
    BACKUP = "BACKUP"


class EmployeeRole(str, Enum):
    AGENT = "AGENT"
    LEAD = "LEAD"
    FLOATER = "FLOATER"


class HolidayScope(str, Enum):
    COMPANY = "COMPANY"
    BRAND = "BRAND"


class LeaveType(str, Enum):
    PLANNED = "PLANNED"
    COMP_OFF = "COMP_OFF"
    SICK = "SICK"


class LeaveStatus(str, Enum):
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"


class RosterStatus(str, Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    PUBLISHED = "PUBLISHED"


class EntrySource(str, Enum):
    GENERATED = "GENERATED"
    MANUAL = "MANUAL"
    SUGGESTION = "SUGGESTION"


class UserRole(str, Enum):
    MANAGER = "MANAGER"
    POD_LEAD = "POD_LEAD"
    EMPLOYEE = "EMPLOYEE"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"


class IssueSeverity(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class RuleID(str, Enum):
    COV_ZERO = "COV_ZERO"
    COV_BELOW_MIN = "COV_BELOW_MIN"
    WO_MISSING = "WO_MISSING"
    CONSEC_MAX = "CONSEC_MAX"
    CAPACITY_EXCEEDED = "CAPACITY_EXCEEDED"
    STRUCT_NO_BACKUP = "STRUCT_NO_BACKUP"
    STRUCT_HEADCOUNT = "STRUCT_HEADCOUNT"
    ASSIGN_MISSING = "ASSIGN_MISSING"
    COMPOFF_UNUSED = "COMPOFF_UNUSED"
    PREF_OFF_MISSED = "PREF_OFF_MISSED"
    FAIRNESS_SPREAD = "FAIRNESS_SPREAD"
    POD_OFF_CLUSTER = "POD_OFF_CLUSTER"


@dataclass(frozen=True)
class Employee:
    id: UUID
    name: str
    pod_id: UUID
    role: str
    preferred_off_days: list[int]
    max_consecutive_days: int
    max_cover_per_day: int
    active: bool


@dataclass(frozen=True)
class Pod:
    id: UUID
    name: str
    lead_employee_id: UUID | None


@dataclass(frozen=True)
class Brand:
    id: UUID
    name: str
    active: bool


@dataclass(frozen=True)
class Process:
    id: UUID
    brand_id: UUID
    name: str
    calendar_mode: CalendarMode
    min_coverage: int


@dataclass(frozen=True)
class CoverageOverride:
    process_id: UUID
    weekday: int | None
    date: date | None
    min_coverage: int


@dataclass(frozen=True)
class Assignment:
    employee_id: UUID
    process_id: UUID
    type: AssignmentType


@dataclass(frozen=True)
class Holiday:
    date: date
    name: str
    scope: HolidayScope
    brand_id: UUID | None


@dataclass(frozen=True)
class Leave:
    employee_id: UUID
    start_date: date
    end_date: date
    type: LeaveType
    status: LeaveStatus


@dataclass(frozen=True)
class RosterEntry:
    employee_id: UUID
    date: date
    status: DayStatus
    locked: bool
    source: EntrySource


@dataclass(frozen=True)
class CoverAssignment:
    employee_id: UUID
    process_id: UUID
    date: date
    source: EntrySource


@dataclass(frozen=True)
class Issue:
    id: str
    rule: RuleID
    severity: IssueSeverity
    structural: bool
    brand_id: UUID | None
    process_id: UUID | None
    employee_id: UUID | None
    pod_id: UUID | None
    date: date | None
    message: str
    cause: str
    suggestion_hint: str | None = None


@dataclass(frozen=True)
class Problem:
    month_start: date
    month_end: date
    employees: list[Employee]
    pods: list[Pod]
    brands: list[Brand]
    processes: list[Process]
    coverage_overrides: list[CoverageOverride]
    assignments: list[Assignment]
    holidays: list[Holiday]
    leaves: list[Leave]
    settings: dict[str, Any]
    demand_grid: dict[tuple[str, date], int] | None = None


@dataclass(frozen=True)
class SolverResult:
    entries: list[RosterEntry]
    covers: list[CoverAssignment]
    status: str
    objective: int
    best_bound: int
    solve_ms: int
    gaps_total: int
    gaps_unresolved_by_reason: dict[str, int]


@dataclass(frozen=True)
class Settings:
    weekly_rest_days: int = 1
    max_consecutive_days: int = 6
    week_start: str = "MON"
    solver_weights: dict[str, int] = field(default_factory=lambda: {
        "short_total": 10000,
        "entries_changed": 50,
        "cover_assignments": 20,
        "pref_off_missed": 5,
        "fairness_spread": 15,
        "spare_coverage": 2,
    })