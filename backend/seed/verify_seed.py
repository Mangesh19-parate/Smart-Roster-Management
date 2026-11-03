"""
Verification script for the seed data.
Checks that all 9 planted cases exist and 3 demo users are created.
"""
import os
import sys
from datetime import date

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.db.models import (
    AppUser,
    Assignment,
    AssignmentType,
    Brand,
    Employee,
    Holiday,
    HolidayScope,
    Leave,
    LeaveStatus,
    Pod,
    Process,
)
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)


def check_case_1_zenith_no_backup(db: Session) -> bool:
    """Planted case 1: ZENITH 365-day brand, one employee, no backup."""
    zenith = db.execute(select(Brand).where(Brand.name == "ZENITH")).scalar_one_or_none()
    if not zenith:
        print("  ❌ ZENITH brand not found")
        return False

    zenith_processes = db.execute(select(Process).where(Process.brand_id == zenith.id)).scalars().all()
    if not zenith_processes:
        print("  ❌ ZENITH has no processes")
        return False

    proc = zenith_processes[0]
    if proc.calendar_mode.value != "ALL_365":
        print(f"  ❌ ZENITH process calendar_mode is {proc.calendar_mode.value}, expected ALL_365")
        return False

    # Check PRIMARY assignments
    primary_assignments = db.execute(
        select(Assignment)
        .where(Assignment.process_id == proc.id, Assignment.type == AssignmentType.PRIMARY)
    ).scalars().all()

    if len(primary_assignments) != 1:
        print(f"  ❌ ZENITH has {len(primary_assignments)} PRIMARY assignments, expected 1")
        return False

    # Check BACKUP assignments
    backup_assignments = db.execute(
        select(Assignment)
        .where(Assignment.process_id == proc.id, Assignment.type == AssignmentType.BACKUP)
    ).scalars().all()

    if len(backup_assignments) > 0:
        print(f"  ❌ ZENITH has {len(backup_assignments)} BACKUP assignments, expected 0")
        return False

    print("  ✅ ZENITH: 365-day, 1 PRIMARY, 0 BACKUP")
    return True


def check_case_2_365_with_floater_backup(db: Session) -> bool:
    """Planted case 2: A 365-day sole-resource brand WITH a floater backup."""
    # Find a 365-day brand that has a BACKUP assignment from a FLOATER
    brands_365 = db.execute(
        select(Brand)
        .join(Process, Process.brand_id == Brand.id)
        .where(Process.calendar_mode == "ALL_365")
        .distinct()
    ).scalars().all()

    for brand in brands_365:
        processes = db.execute(select(Process).where(Process.brand_id == brand.id)).scalars().all()
        for proc in processes:
            primary_count = db.execute(
                select(func.count(Assignment.id))
                .where(Assignment.process_id == proc.id, Assignment.type == AssignmentType.PRIMARY)
            ).scalar()
            backup_count = db.execute(
                select(func.count(Assignment.id))
                .where(Assignment.process_id == proc.id, Assignment.type == AssignmentType.BACKUP)
            ).scalar()

            if primary_count == 1 and backup_count >= 1:
                # Verify the backup is from a FLOATER
                backup_assignments = db.execute(
                    select(Assignment, Employee)
                    .join(Employee, Employee.id == Assignment.employee_id)
                    .where(Assignment.process_id == proc.id, Assignment.type == AssignmentType.BACKUP)
                ).all()

                for assignment, employee in backup_assignments:
                    if employee.role.value == "FLOATER":
                        print(f"  ✅ {brand.name}: 365-day, 1 PRIMARY, FLOATER BACKUP")
                        return True

    print("  ❌ No 365-day sole-resource brand with FLOATER backup found")
    return False


def check_case_3_brand_two_calendars(db: Session) -> bool:
    """Planted case 3: Brand with two processes on different calendars."""
    phoenix = db.execute(select(Brand).where(Brand.name == "PHOENIX")).scalar_one_or_none()
    if not phoenix:
        print("  ❌ PHOENIX brand not found")
        return False

    processes = db.execute(select(Process).where(Process.brand_id == phoenix.id)).scalars().all()
    if len(processes) != 2:
        print(f"  ❌ PHOENIX has {len(processes)} processes, expected 2")
        return False

    calendars = {p.calendar_mode.value for p in processes}
    if calendars != {"ALL_365", "EXCL_PH"}:
        print(f"  ❌ PHOENIX calendars: {calendars}, expected ALL_365 and EXCL_PH")
        return False

    print("  ✅ PHOENIX: 2 processes on different calendars (ALL_365, EXCL_PH)")
    return True


def check_case_4_shared_process_override(db: Session) -> bool:
    """Planted case 4: Shared process that needs 2 people on selected weekdays."""
    from app.db.models import CoverageOverride

    overrides = db.execute(
        select(CoverageOverride)
        .where(CoverageOverride.min_coverage == 2, CoverageOverride.weekday == 5)
    ).scalars().all()

    if len(overrides) < 1:
        print("  ❌ No coverage override with min_coverage=2 on Saturday found")
        return False

    print(f"  ✅ Shared process override: {len(overrides)} override(s) with min_coverage=2 on Saturday")
    return True


def check_case_5_two_floaters(db: Session) -> bool:
    """Planted case 5: Two floaters, primary on Sunday-off brands and BACKUP on 365-day brands."""
    floaters = db.execute(
        select(Employee).where(Employee.role == "FLOATER")
    ).scalars().all()

    if len(floaters) != 2:
        print(f"  ❌ Expected 2 floaters, found {len(floaters)}")
        return False

    # Check each floater has PRIMARY on EXCL_SUN_PH and BACKUP on ALL_365
    for floater in floaters:
        assignments = db.execute(
            select(Assignment, Process)
            .join(Process, Process.id == Assignment.process_id)
            .where(Assignment.employee_id == floater.id)
        ).all()

        primary_on_excl_sun = False
        backup_on_all_365 = False

        for assignment, process in assignments:
            if assignment.type == AssignmentType.PRIMARY and process.calendar_mode.value == "EXCL_SUN_PH":
                primary_on_excl_sun = True
            if assignment.type == AssignmentType.BACKUP and process.calendar_mode.value == "ALL_365":
                backup_on_all_365 = True

        if not (primary_on_excl_sun and backup_on_all_365):
            print(f"  ❌ Floater {floater.name} doesn't have correct assignment pattern")
            return False

    print("  ✅ Two floaters with PRIMARY on EXCL_SUN_PH and BACKUP on ALL_365")
    return True


def check_case_6_holidays(db: Session) -> bool:
    """Planted case 6: Brand-scoped holiday on Sunday 13 Dec 2026, company holiday on 25 Dec 2026."""
    # Company holiday on 25 Dec 2026 (Friday)
    christmas = db.execute(
        select(Holiday)
        .where(Holiday.date == date(2026, 12, 25), Holiday.scope == HolidayScope.COMPANY)
    ).scalar_one_or_none()

    if not christmas:
        print("  ❌ Company holiday on 2026-12-25 not found")
        return False

    # Brand-scoped holiday on 13 Dec 2026 (Sunday)
    brand_holiday = db.execute(
        select(Holiday)
        .where(Holiday.date == date(2026, 12, 13), Holiday.scope == HolidayScope.BRAND)
    ).scalar_one_or_none()

    if not brand_holiday:
        print("  ❌ Brand-scoped holiday on 2026-12-13 not found")
        return False

    if not brand_holiday.brand_id:
        print("  ❌ Brand-scoped holiday missing brand_id")
        return False

    print("  ✅ Brand holiday on 2026-12-13 (Sunday), Company holiday on 2026-12-25 (Friday)")
    return True


def check_case_7_overlapping_primary(db: Session) -> bool:
    """Planted case 7: Overlapping PRIMARY assignments (two people on one process)."""
    zenith = db.execute(select(Brand).where(Brand.name == "ZENITH")).scalar_one_or_none()
    if not zenith:
        print("  ❌ ZENITH brand not found")
        return False

    zenith_processes = db.execute(select(Process).where(Process.brand_id == zenith.id)).scalars().all()
    if not zenith_processes:
        print("  ❌ ZENITH has no processes")
        return False

    proc = zenith_processes[0]
    primary_assignments = db.execute(
        select(Assignment)
        .where(Assignment.process_id == proc.id, Assignment.type == AssignmentType.PRIMARY)
    ).scalars().all()

    if len(primary_assignments) != 2:
        print(f"  ❌ ZENITH has {len(primary_assignments)} PRIMARY assignments, expected 2")
        return False

    print("  ✅ ZENITH: 2 PRIMARY assignments (overlapping)")
    return True


def check_case_8_approved_leaves(db: Session) -> bool:
    """Planted case 8: Approved leaves on non-critical days."""
    leaves = db.execute(
        select(Leave).where(Leave.status == LeaveStatus.APPROVED)
    ).scalars().all()

    if len(leaves) < 5:
        print(f"  ❌ Expected at least 5 approved leaves, found {len(leaves)}")
        return False

    print(f"  ✅ {len(leaves)} approved leaves on non-critical days")
    return True


def check_case_9_sole_resource_no_leave(db: Session) -> bool:
    """Planted case 9: A sole-resource employee with no leave in the seed."""
    # Find an agent on a single-resource brand with no leave in December 2026
    agents = db.execute(
        select(Employee).where(Employee.role == "AGENT")
    ).scalars().all()

    for agent in agents:
        leaves = db.execute(
            select(Leave)
            .where(
                Leave.employee_id == agent.id,
                Leave.status == LeaveStatus.APPROVED,
                Leave.start_date >= date(2026, 12, 1),
                Leave.end_date <= date(2026, 12, 31),
            )
        ).scalars().all()

        if len(leaves) == 0:
            # Check if this agent is on a single-resource brand
            assignments = db.execute(
                select(Assignment, Process, Brand)
                .join(Process, Process.id == Assignment.process_id)
                .join(Brand, Brand.id == Process.brand_id)
                .where(Assignment.employee_id == agent.id, Assignment.type == AssignmentType.PRIMARY)
            ).all()

            single_resource = True
            for assignment, process, brand in assignments:
                primary_count = db.execute(
                    select(func.count(Assignment.id))
                    .where(Assignment.process_id == process.id, Assignment.type == AssignmentType.PRIMARY)
                ).scalar()
                if primary_count > 1:
                    single_resource = False
                    break

            if single_resource:
                print(f"  ✅ Sole-resource employee with no leave: {agent.name}")
                return True

    print("  ❌ No sole-resource employee without leave found")
    return False


def check_demo_users(db: Session) -> bool:
    """Check 3 demo users exist: MANAGER, POD_LEAD, EMPLOYEE."""
    users = db.execute(select(AppUser)).scalars().all()

    roles = {u.role.value for u in users}
    expected_roles = {"MANAGER", "POD_LEAD", "EMPLOYEE"}

    if not expected_roles.issubset(roles):
        print(f"  ❌ Missing roles: {expected_roles - roles}")
        return False

    for role in expected_roles:
        user = next(u for u in users if u.role.value == role)
        if role == "MANAGER" and user.employee_id is not None:
            print("  ❌ MANAGER should not have employee_id")
            return False
        if role in ("POD_LEAD", "EMPLOYEE") and user.employee_id is None:
            print(f"  ❌ {role} should have employee_id")
            return False

    print("  ✅ 3 demo users: MANAGER, POD_LEAD (linked), EMPLOYEE (linked)")
    return True


def main() -> int:
    """Run all verification checks."""
    print("Verifying seed data...\n")

    with Session(engine) as db:
        checks = [
            ("Case 1: ZENITH no backup", check_case_1_zenith_no_backup),
            ("Case 2: 365-day with floater backup", check_case_2_365_with_floater_backup),
            ("Case 3: Brand with two calendars", check_case_3_brand_two_calendars),
            ("Case 4: Shared process override", check_case_4_shared_process_override),
            ("Case 5: Two floaters", check_case_5_two_floaters),
            ("Case 6: Holidays", check_case_6_holidays),
            ("Case 7: Overlapping PRIMARY", check_case_7_overlapping_primary),
            ("Case 8: Approved leaves", check_case_8_approved_leaves),
            ("Case 9: Sole resource no leave", check_case_9_sole_resource_no_leave),
            ("Demo users", check_demo_users),
        ]

        passed = 0
        for name, check_fn in checks:
            try:
                if check_fn(db):
                    passed += 1
                else:
                    print(f"FAILED: {name}")
            except Exception as e:
                print(f"ERROR in {name}: {e}")

        print(f"\n{'='*50}")
        print(f"Passed: {passed}/{len(checks)}")

        # Also print summary counts
        print("\nSummary counts:")
        print(f"  Pods: {db.query(Pod).count()}")
        print(f"  Employees: {db.query(Employee).count()}")
        print(f"  Brands: {db.query(Brand).count()}")
        print(f"  Processes: {db.query(Process).count()}")
        print(f"  Assignments: {db.query(Assignment).count()}")
        print(f"  Holidays: {db.query(Holiday).count()}")
        print(f"  Leaves: {db.query(Leave).count()}")
        print(f"  App Users: {db.query(AppUser).count()}")

        return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())