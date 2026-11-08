"""
Pydantic schemas for Smart Roster Management API.

Matches docs/API.md exactly.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# ============================================================================
# Enums (matching database models)
# ============================================================================


class EmployeeRole(str, Enum):
    AGENT = "AGENT"
    LEAD = "LEAD"
    FLOATER = "FLOATER"


class CalendarMode(str, Enum):
    ALL_365 = "ALL_365"
    EXCL_PH = "EXCL_PH"
    EXCL_SUN_PH = "EXCL_SUN_PH"


class AssignmentType(str, Enum):
    PRIMARY = "PRIMARY"
    BACKUP = "BACKUP"


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


class DayStatus(str, Enum):
    WORK = "WORK"
    WO = "WO"
    PH = "PH"
    LEAVE = "LEAVE"
    COMP_OFF = "COMP_OFF"


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


class SuggestionKind(str, Enum):
    ADD_COVER = "ADD_COVER"
    SHIFT_OFF = "SHIFT_OFF"
    SWAP_OFF = "SWAP_OFF"
    LOCAL_RESOLVE = "LOCAL_RESOLVE"
    REQUEST_BACKUP = "REQUEST_BACKUP"


class RegenerateMode(str, Enum):
    MINIMAL_CHANGE = "MINIMAL_CHANGE"
    FULL = "FULL"


class ChangeType(str, Enum):
    LEAVE = "LEAVE"


class ExplainSource(str, Enum):
    AI = "ai"
    TEMPLATE = "template"


# ============================================================================
# Base Models
# ============================================================================


class ErrorResponse(BaseModel):
    error: ErrorDetail


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any | None = None


# ============================================================================
# User / Auth Schemas
# ============================================================================


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    employee_id: UUID | None = None
    pod_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserResponse
    role: UserRole
    employee: dict[str, Any] | None = None
    pod: dict[str, Any] | None = None


class UserCreateRequest(BaseModel):
    email: str
    role: UserRole
    employee_id: UUID | None = None
    temp_password: str


class UserUpdateRequest(BaseModel):
    role: UserRole | None = None
    employee_id: UUID | None = None
    active: bool | None = None


# ============================================================================
# Config Schemas
# ============================================================================


class PodBase(BaseModel):
    name: str
    lead_employee_id: UUID | None = None


class PodCreate(PodBase):
    pass


class PodUpdate(BaseModel):
    name: str | None = None
    lead_employee_id: UUID | None = None


class PodResponse(PodBase):
    id: UUID
    lead_employee_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmployeeBase(BaseModel):
    name: str
    pod_id: UUID
    role: EmployeeRole = EmployeeRole.AGENT
    preferred_off_days: list[int] = Field(default_factory=list)
    max_consecutive_days: int = Field(default=6, ge=1, le=14)
    max_cover_per_day: int = Field(default=2, ge=0)


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: str | None = None
    pod_id: UUID | None = None
    role: EmployeeRole | None = None
    preferred_off_days: list[int] | None = None
    max_consecutive_days: int | None = Field(default=None, ge=1, le=14)
    max_cover_per_day: int | None = Field(default=None, ge=0)
    active: bool | None = None


class EmployeeResponse(EmployeeBase):
    id: UUID
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BrandBase(BaseModel):
    name: str
    active: bool = True


class BrandCreate(BrandBase):
    pass


class BrandUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


class BrandResponse(BrandBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProcessBase(BaseModel):
    brand_id: UUID
    name: str
    calendar_mode: CalendarMode
    min_coverage: int = Field(default=1, ge=0)


class ProcessCreate(ProcessBase):
    pass


class ProcessUpdate(BaseModel):
    name: str | None = None
    calendar_mode: CalendarMode | None = None
    min_coverage: int | None = Field(default=None, ge=0)


class ProcessResponse(ProcessBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CoverageOverrideBase(BaseModel):
    process_id: UUID
    weekday: int | None = Field(default=None, ge=0, le=6)
    override_date: Optional[date] = Field(default=None, alias="date")
    min_coverage: int = Field(ge=0)

    @field_validator("weekday", "override_date")
    @classmethod
    def check_weekday_xor_date(cls, v: int | None, info: Any) -> int | None:
        if info.field_name == "weekday" and v is not None:
            if info.data.get("override_date") is not None:
                raise ValueError("Exactly one of weekday or date must be provided")
        return v


class CoverageOverrideCreate(CoverageOverrideBase):
    pass


class CoverageOverrideResponse(CoverageOverrideBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class OverridesPutRequest(BaseModel):
    overrides: list[CoverageOverrideCreate]


class AssignmentBase(BaseModel):
    employee_id: UUID
    process_id: UUID
    type: AssignmentType = AssignmentType.PRIMARY


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    employee_id: UUID | None = None
    process_id: UUID | None = None
    type: AssignmentType | None = None


class CoverageOverrideDirectCreate(BaseModel):
    process_id: UUID
    weekday: int | None = Field(default=None, ge=0, le=6)
    override_date: Optional[date] = Field(default=None, alias="date")
    min_coverage: int = Field(default=1, ge=0)

    class Config:
        populate_by_name = True


class AssignmentResponse(AssignmentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HolidayBase(BaseModel):
    date: date
    name: str
    scope: HolidayScope = HolidayScope.COMPANY
    brand_id: UUID | None = None

    @field_validator("brand_id")
    @classmethod
    def check_brand_id(cls, v: UUID | None, info: Any) -> UUID | None:
        scope = info.data.get("scope")
        if scope == HolidayScope.BRAND and v is None:
            raise ValueError("brand_id required when scope is BRAND")
        if scope == HolidayScope.COMPANY and v is not None:
            raise ValueError("brand_id forbidden when scope is COMPANY")
        return v


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SettingsBase(BaseModel):
    weekly_rest_days: int = Field(default=1, ge=1, le=7)
    max_consecutive_days: int = Field(default=6, ge=1, le=14)
    week_start: str = "MON"
    solver_weights: dict[str, int] = Field(
        default_factory=lambda: {
            "short_total": 10000,
            "entries_changed": 50,
            "cover_assignments": 20,
            "pref_off_missed": 5,
            "fairness_spread": 15,
            "spare_coverage": 2,
        }
    )


class SettingsResponse(SettingsBase):
    pass


# ============================================================================
# Leave Schemas
# ============================================================================


class LeaveBase(BaseModel):
    employee_id: UUID
    start_date: date
    end_date: date
    type: LeaveType

    @field_validator("end_date")
    @classmethod
    def check_end_after_start(cls, v: date, info: Any) -> date:
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date must be >= start_date")
        return v


class LeaveCreate(LeaveBase):
    pass


class LeaveUpdate(BaseModel):
    status: LeaveStatus | None = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class LeaveResponse(LeaveBase):
    id: UUID
    status: LeaveStatus
    note: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImpactResponse(BaseModel):
    new_issues: list[IssueResponse]
    resolved_issues: list[IssueResponse]
    affected_brands: list[str]


class LeaveCreateResponse(BaseModel):
    leave: LeaveResponse
    impact: ImpactResponse


class LeavePreviewRequest(LeaveBase):
    pass


class LeavePreviewResponse(BaseModel):
    impact: ImpactResponse


# ============================================================================
# Roster Schemas
# ============================================================================


class RosterGenerateRequest(BaseModel):
    keep_locked: bool = True
    time_limit_s: float | None = None


class RosterGenerateResponse(BaseModel):
    roster: RosterResponse
    issues: list[IssueResponse]
    stats: RosterStats


class RosterStats(BaseModel):
    status: str  # OPTIMAL | FEASIBLE
    objective: int
    best_bound: int
    gaps_total: int
    gaps_unresolved_by_reason: dict[str, int]
    solve_ms: int


class RosterFetchRequest(BaseModel):
    view: str | None = None  # company | pod | brand | process | employee
    id: UUID | None = None


class RosterEntryBase(BaseModel):
    employee_id: UUID
    date: date
    status: DayStatus
    locked: bool = False
    source: EntrySource = EntrySource.GENERATED


class PodSummary(BaseModel):
    id: UUID
    name: str


class EmployeeSummary(BaseModel):
    id: UUID
    name: str
    pod_id: UUID
    pod: PodSummary | None = None
    role: EmployeeRole | str = EmployeeRole.AGENT


class RosterEntryResponse(RosterEntryBase):
    id: UUID
    roster_id: UUID
    employee: EmployeeSummary | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CoverAssignmentBase(BaseModel):
    employee_id: UUID
    process_id: UUID
    date: date
    source: EntrySource = EntrySource.GENERATED


class CoverAssignmentResponse(CoverAssignmentBase):
    id: UUID
    roster_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DemandResponse(BaseModel):
    process_id: UUID
    date: date
    required: int


class CoverageResponse(BaseModel):
    process_id: UUID
    date: date
    required: int
    supplied: int
    cover_used: int
    shortfall: int
    status: str  # fully_covered | gap | at_minimum


class ApprovalResponse(BaseModel):
    id: UUID
    roster_id: UUID
    pod_id: UUID
    status: ApprovalStatus
    comment: str | None = None
    decided_by: UUID | None = None
    decided_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RosterResponse(BaseModel):
    id: UUID
    month: str
    status: RosterStatus
    generated_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    entries: list[RosterEntryResponse] = Field(default_factory=list)
    covers: list[CoverAssignmentResponse] = Field(default_factory=list)
    employees: list[EmployeeSummary] = Field(default_factory=list)
    demand: list[DemandResponse] = Field(default_factory=list)
    coverage: list[CoverageResponse] = Field(default_factory=list)
    approvals: list[ApprovalResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class RosterValidateRequest(BaseModel):
    entries: list[RosterEntryBase] | None = None
    covers: list[CoverAssignmentBase] | None = None


class RosterValidateResponse(BaseModel):
    issues: list[IssueResponse]
    summary: dict[str, int]


class IssueResponse(BaseModel):
    id: str
    rule: RuleID
    severity: IssueSeverity
    structural: bool
    brand_id: UUID | None = None
    process_id: UUID | None = None
    employee_id: UUID | None = None
    pod_id: UUID | None = None
    issue_date: date | None = Field(default=None, alias="date")
    message: str
    cause: str
    suggestion_hint: str | None = None


class EntryEditRequest(BaseModel):
    employee_id: UUID
    date: date
    status: DayStatus
    locked: bool | None = None


class EntryEditResponse(BaseModel):
    entry: RosterEntryResponse
    issues: list[IssueResponse]
    impact: ImpactResponse


class CoverRequest(BaseModel):
    employee_id: UUID
    process_id: UUID
    date: date


class CoverResponse(BaseModel):
    cover: CoverAssignmentResponse
    issues: list[IssueResponse]


class LockRequest(BaseModel):
    employee_id: UUID | None = None
    from_: Optional[date] = Field(default=None, alias="from")
    to: Optional[date] = None
    locked: bool


class LockResponse(BaseModel):
    updated: int


class FairnessRow(BaseModel):
    employee_id: UUID
    employee_name: str
    pod_name: str
    total_work_days: int
    sunday_work_days: int
    holiday_work_days: int
    preferred_off_missed: int
    fairness_score: float


# ============================================================================
# Changes / Suggestions Schemas
# ============================================================================


class ChangeAnalyzeRequest(BaseModel):
    type: ChangeType = ChangeType.LEAVE
    employee_id: UUID
    start_date: date
    end_date: date


class SuggestionAction(BaseModel):
    type: str  # "SET_ENTRY" | "ADD_COVER" | "REMOVE_COVER" | "SET_LOCK"
    employee_id: UUID | None = None
    process_id: UUID | None = None
    action_date: Optional[date] = Field(default=None, alias="date")
    status: DayStatus | None = None
    locked: bool | None = None


class SuggestionResponse(BaseModel):
    id: str
    kind: SuggestionKind
    description: str
    fixes: list[IssueResponse]
    may_break: list[IssueResponse]
    entries_changed: int
    fairness_delta: float
    actions: list[SuggestionAction]


class ChangeAnalyzeResponse(BaseModel):
    impact: ImpactResponse
    suggestions: list[SuggestionResponse]


class SuggestionApplyResponse(BaseModel):
    applied: bool
    issues: list[IssueResponse]
    impact: ImpactResponse


# ============================================================================
# Regenerate Schemas
# ============================================================================


class RosterRegenerateRequest(BaseModel):
    mode: RegenerateMode = RegenerateMode.MINIMAL_CHANGE
    save: bool = False


class DiffEntry(BaseModel):
    employee_id: UUID
    date: date
    before: DayStatus | None
    after: DayStatus | None
    locked: bool


class DiffCover(BaseModel):
    employee_id: UUID
    process_id: UUID
    date: date
    before: bool
    after: bool


class RosterRegenerateResponse(BaseModel):
    diff: RosterDiff
    issues_before: list[IssueResponse]
    issues_after: list[IssueResponse]
    stats: RosterStats


class RosterDiff(BaseModel):
    entries: list[DiffEntry] = Field(default_factory=list)
    covers: list[DiffCover] = Field(default_factory=list)


# ============================================================================
# Approval Schemas (Tier B)
# ============================================================================


class ApprovalDecisionRequest(BaseModel):
    decision: ApprovalStatus
    comment: str | None = None


class ApprovalDecisionResponse(BaseModel):
    approval: ApprovalResponse


class RosterPublishResponse(BaseModel):
    roster: RosterResponse


class RosterAmendRequest(BaseModel):
    changes: list[EntryEditRequest]
    reason: str


class RosterAmendResponse(BaseModel):
    applied: list[EntryEditResponse]
    issues: list[IssueResponse]


# ============================================================================
# Explanation Schemas (Tier B)
# ============================================================================


class ExplainRequest(BaseModel):
    month: str
    issue_id: str


class ExplainResponse(BaseModel):
    explanation: str
    source: ExplainSource


# ============================================================================
# Utility Schemas
# ============================================================================


class HealthResponse(BaseModel):
    status: str
    db: str


class ChangeLogResponse(BaseModel):
    id: UUID
    roster_id: UUID
    actor_id: UUID | None = None
    action: str
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    reason: str | None = None
    published_change: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DemoResetResponse(BaseModel):
    reseeded: bool


# Forward references
IssueResponse.model_rebuild()
RosterResponse.model_rebuild()
RosterGenerateResponse.model_rebuild()
ChangeAnalyzeResponse.model_rebuild()
RosterRegenerateResponse.model_rebuild()
