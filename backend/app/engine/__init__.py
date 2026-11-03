from app.engine.availability import build_blocked_days, get_employee_blocked_days, is_blocked
from app.engine.calendar import get_min_coverage, is_closed, required
from app.engine.coverage import calculate_coverage, get_coverage_summary, get_supply_for_process
from app.engine.demand import build_demand_grid, get_brand_demand, get_process_demand
from app.engine.feasibility import AssignMissingRule, StructHeadcountRule, StructNoBackupRule
from app.engine.rules.coverage import CovBelowMinRule, CovZeroRule
from app.engine.rules.employee import (
    CapacityExceededRule,
    CompOffUnusedRule,
    ConsecMaxRule,
    WOMissingRule,
)
from app.engine.rules.preference import FairnessSpreadRule, PodOffClusterRule, PrefOffMissedRule
from app.engine.types import (
    ApprovalStatus,
    Assignment,
    AssignmentType,
    Brand,
    CalendarMode,
    CoverageOverride,
    CoverAssignment,
    DayStatus,
    Employee,
    EntrySource,
    Holiday,
    HolidayScope,
    Issue,
    IssueSeverity,
    Leave,
    LeaveStatus,
    LeaveType,
    Pod,
    Problem,
    Process,
    RosterEntry,
    RosterStatus,
    RuleID,
    Settings,
    SolverResult,
    UserRole,
)
from app.engine.validator import Rule, Validator, make_issue_id

__all__ = [
    # Types
    "Employee", "Pod", "Brand", "Process", "CoverageOverride", "Assignment",
    "Holiday", "Leave", "RosterEntry", "CoverAssignment", "Issue", "Problem",
    "SolverResult", "Settings",
    "DayStatus", "CalendarMode", "AssignmentType", "HolidayScope",
    "LeaveType", "LeaveStatus", "RosterStatus", "EntrySource",
    "UserRole", "ApprovalStatus", "IssueSeverity", "RuleID",
    # Calendar & Demand
    "is_closed", "get_min_coverage", "required",
    "build_demand_grid", "get_brand_demand", "get_process_demand",
    # Availability
    "build_blocked_days", "is_blocked", "get_employee_blocked_days",
    # Coverage
    "calculate_coverage", "get_supply_for_process", "get_coverage_summary",
    # Validator
    "Rule", "Validator", "make_issue_id",
    # Structural
    "StructNoBackupRule", "StructHeadcountRule", "AssignMissingRule",
    # Rules
    "CovZeroRule", "CovBelowMinRule",
    "WOMissingRule", "ConsecMaxRule", "CapacityExceededRule", "CompOffUnusedRule",
    "PrefOffMissedRule", "FairnessSpreadRule", "PodOffClusterRule",
]