from datetime import date
from uuid import uuid4

from app.engine.rules.preference import FairnessSpreadRule, PodOffClusterRule, PrefOffMissedRule
from app.engine.types import (
    DayStatus,
    Employee,
    EmployeeRole,
    EntrySource,
    Holiday,
    HolidayScope,
    Problem,
    RosterEntry,
)


def test_pref_off_missed_warning() -> None:
    """PREF_OFF_MISSED when employee works on preferred off day."""
    emp_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Test Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],  # Sunday
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[],
        settings={},
    )

    # Employee works on Sunday (Dec 6)
    entries = {
        (str(emp_id), date(2026, 12, 6)): RosterEntry(
            employee_id=emp_id,
            date=date(2026, 12, 6),
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        ),
    }

    rule = PrefOffMissedRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 1
    assert issues[0].rule.value == "PREF_OFF_MISSED"
    assert issues[0].severity.value == "WARNING"


def test_pref_off_not_missed_when_not_working() -> None:
    """PREF_OFF_MISSED not triggered when not working on preferred day."""
    emp_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Test Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],  # Sunday
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[],
        settings={},
    )

    # Employee has WO on Sunday
    entries = {
        (str(emp_id), date(2026, 12, 6)): RosterEntry(
            employee_id=emp_id,
            date=date(2026, 12, 6),
            status=DayStatus.WO,
            locked=False,
            source=EntrySource.GENERATED,
        ),
    }

    rule = PrefOffMissedRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 0


def test_fairness_spread_warning() -> None:
    """FAIRNESS_SPREAD when Sunday/holiday work spread > 2."""
    pod_id = uuid4()

    emp1 = Employee(
        id=uuid4(),
        name="Emp1",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp2 = Employee(
        id=uuid4(),
        name="Emp2",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp3 = Employee(
        id=uuid4(),
        name="Emp3",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[emp1, emp2, emp3],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[
            Holiday(
                date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None
            )
        ],
        leaves=[],
        settings={},
    )

    # Emp1 works 4 Sundays/holidays, Emp2 works 1, Emp3 works 0
    # Spread = 4 - 0 = 4 > 2
    entries = {}
    # Dec 6, 13, 20, 27 are Sundays; Dec 25 is holiday (Friday)
    for d in [date(2026, 12, 6), date(2026, 12, 13), date(2026, 12, 20), date(2026, 12, 25)]:
        entries[(str(emp1.id), d)] = RosterEntry(
            employee_id=emp1.id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    entries[(str(emp2.id), date(2026, 12, 6))] = RosterEntry(
        employee_id=emp2.id,
        date=date(2026, 12, 6),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )
    # Emp3 works none

    rule = FairnessSpreadRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) >= 1
    assert issues[0].rule.value == "FAIRNESS_SPREAD"
    assert issues[0].severity.value == "WARNING"


def test_fairness_spread_ok_when_balanced() -> None:
    """FAIRNESS_SPREAD not triggered when spread <= 2."""
    pod_id = uuid4()

    emp1 = Employee(
        id=uuid4(),
        name="Emp1",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp2 = Employee(
        id=uuid4(),
        name="Emp2",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[emp1, emp2],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[
            Holiday(
                date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None
            )
        ],
        leaves=[],
        settings={},
    )

    # Both work 2 Sundays/holidays - spread = 0
    entries = {}
    for d in [date(2026, 12, 6), date(2026, 12, 13)]:
        entries[(str(emp1.id), d)] = RosterEntry(
            employee_id=emp1.id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
        entries[(str(emp2.id), d)] = RosterEntry(
            employee_id=emp2.id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = FairnessSpreadRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 0


def test_pod_off_cluster_warning() -> None:
    """POD_OFF_CLUSTER when >50% of pod off on same day."""
    pod_id = uuid4()

    emp1 = Employee(
        id=uuid4(),
        name="Emp1",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp2 = Employee(
        id=uuid4(),
        name="Emp2",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp3 = Employee(
        id=uuid4(),
        name="Emp3",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp4 = Employee(
        id=uuid4(),
        name="Emp4",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    from app.engine.types import Pod

    pod = Pod(id=pod_id, name="Test Pod", lead_employee_id=None)

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[emp1, emp2, emp3, emp4],
        pods=[pod],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[],
        settings={},
    )

    # 3 out of 4 off on same day (>50%)
    entries = {}
    for emp in [emp1, emp2, emp3]:
        entries[(str(emp.id), date(2026, 12, 15))] = RosterEntry(
            employee_id=emp.id,
            date=date(2026, 12, 15),
            status=DayStatus.WO,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # emp4 works
    entries[(str(emp4.id), date(2026, 12, 15))] = RosterEntry(
        employee_id=emp4.id,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )

    rule = PodOffClusterRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 1
    assert issues[0].rule.value == "POD_OFF_CLUSTER"
    assert issues[0].severity.value == "WARNING"
    assert "3/4" in issues[0].message


def test_pod_off_cluster_ok_when_balanced() -> None:
    """POD_OFF_CLUSTER not triggered when <=50% off."""
    pod_id = uuid4()

    emp1 = Employee(
        id=uuid4(),
        name="Emp1",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp2 = Employee(
        id=uuid4(),
        name="Emp2",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp3 = Employee(
        id=uuid4(),
        name="Emp3",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    emp4 = Employee(
        id=uuid4(),
        name="Emp4",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    from app.engine.types import Pod

    pod = Pod(id=pod_id, name="Test Pod", lead_employee_id=None)

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[emp1, emp2, emp3, emp4],
        pods=[pod],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[],
        settings={},
    )

    # 2 out of 4 off (=50%, not >50%)
    entries = {}
    for emp in [emp1, emp2]:
        entries[(str(emp.id), date(2026, 12, 15))] = RosterEntry(
            employee_id=emp.id,
            date=date(2026, 12, 15),
            status=DayStatus.WO,
            locked=False,
            source=EntrySource.GENERATED,
        )
    for emp in [emp3, emp4]:
        entries[(str(emp.id), date(2026, 12, 15))] = RosterEntry(
            employee_id=emp.id,
            date=date(2026, 12, 15),
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = PodOffClusterRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 0
