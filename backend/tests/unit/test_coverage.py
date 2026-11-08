from datetime import date
from uuid import uuid4

from app.engine.coverage import calculate_coverage
from app.engine.types import (
    Assignment,
    AssignmentType,
    CoverAssignment,
    DayStatus,
    Employee,
    EmployeeRole,
    EntrySource,
    Process,
    RosterEntry,
)


def test_primary_work_counts() -> None:
    """Primary WORK employee counts as supply."""
    emp_id = uuid4()
    proc_id = uuid4()

    Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=uuid4(),
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY)
    entry = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )

    demand = {(str(proc_id), date(2026, 12, 15)): 1}

    coverage = calculate_coverage(
        entries=[entry],
        covers=[],
        assignments=[assignment],
        processes=[process],
        demand_grid=demand,
    )

    assert coverage["supply"][(str(proc_id), date(2026, 12, 15))] == 1
    assert coverage["shortfalls"] == {}


def test_backup_without_cover_does_not_count() -> None:
    """BACKUP assignment without cover row does NOT count."""
    emp_id = uuid4()
    proc_id = uuid4()

    Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=uuid4(),
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.BACKUP)
    entry = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )

    demand = {(str(proc_id), date(2026, 12, 15)): 1}

    coverage = calculate_coverage(
        entries=[entry],
        covers=[],
        assignments=[assignment],
        processes=[process],
        demand_grid=demand,
    )

    # No cover row, so backup doesn't count
    assert coverage["supply"].get((str(proc_id), date(2026, 12, 15)), 0) == 0
    assert (str(proc_id), date(2026, 12, 15)) in coverage["shortfalls"]


def test_backup_with_cover_counts() -> None:
    """BACKUP assignment WITH cover row counts."""
    emp_id = uuid4()
    proc_id = uuid4()

    Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=uuid4(),
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.BACKUP)
    entry = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )
    cover = CoverAssignment(
        employee_id=emp_id,
        process_id=proc_id,
        date=date(2026, 12, 15),
        source=EntrySource.GENERATED,
    )

    demand = {(str(proc_id), date(2026, 12, 15)): 1}

    coverage = calculate_coverage(
        entries=[entry],
        covers=[cover],
        assignments=[assignment],
        processes=[process],
        demand_grid=demand,
    )

    assert coverage["supply"][(str(proc_id), date(2026, 12, 15))] == 1
    assert coverage["cover_used"][(str(proc_id), date(2026, 12, 15))] == 1
    assert coverage["shortfalls"] == {}


def test_wo_does_not_count() -> None:
    """WO status does not count as supply."""
    emp_id = uuid4()
    proc_id = uuid4()

    Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=uuid4(),
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY)
    entry = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )

    demand = {(str(proc_id), date(2026, 12, 15)): 1}

    coverage = calculate_coverage(
        entries=[entry],
        covers=[],
        assignments=[assignment],
        processes=[process],
        demand_grid=demand,
    )

    assert coverage["supply"].get((str(proc_id), date(2026, 12, 15)), 0) == 0
    assert (str(proc_id), date(2026, 12, 15)) in coverage["shortfalls"]


def test_multiple_primary_employees() -> None:
    """Multiple primary employees each count as 1."""
    emp_id1 = uuid4()
    emp_id2 = uuid4()
    proc_id = uuid4()

    Employee(
        id=emp_id1,
        name="Test1",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    Employee(
        id=emp_id2,
        name="Test2",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=uuid4(),
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=2,
    )

    assignment1 = Assignment(employee_id=emp_id1, process_id=proc_id, type=AssignmentType.PRIMARY)
    assignment2 = Assignment(employee_id=emp_id2, process_id=proc_id, type=AssignmentType.PRIMARY)

    entry1 = RosterEntry(
        employee_id=emp_id1,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )
    entry2 = RosterEntry(
        employee_id=emp_id2,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )

    demand = {(str(proc_id), date(2026, 12, 15)): 2}

    coverage = calculate_coverage(
        entries=[entry1, entry2],
        covers=[],
        assignments=[assignment1, assignment2],
        processes=[process],
        demand_grid=demand,
    )

    assert coverage["supply"][(str(proc_id), date(2026, 12, 15))] == 2
    assert coverage["shortfalls"] == {}
