from datetime import date
from uuid import uuid4

from app.engine.demand import build_demand_grid
from app.engine.types import (
    CalendarMode,
    CoverageOverride,
    Holiday,
    HolidayScope,
    Problem,
    Process,
)


def test_build_demand_grid_basic() -> None:
    """Test basic demand grid construction."""
    brand_id = uuid4()
    proc_id = uuid4()

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=1,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[],
        settings={},
    )

    demand = build_demand_grid(problem)

    # Should have 31 days * 1 process = 31 entries
    assert len(demand) == 31

    # All days should have demand 1
    for (pid, _d), req in demand.items():
        assert pid == str(proc_id)
        assert req == 1


def test_demand_grid_excludes_closed_days() -> None:
    """Demand grid should have 0 for closed days (not included)."""
    brand_id = uuid4()
    proc_id = uuid4()

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.EXCL_SUN_PH,
        min_coverage=1,
    )

    christmas = Holiday(
        date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[],
        holidays=[christmas],
        leaves=[],
        settings={},
    )

    demand = build_demand_grid(problem)

    # December 2026: 31 days, 4 Sundays (6, 13, 20, 27), 1 holiday (25)
    # Sundays: 6, 13, 20, 27 - closed
    # 25 Dec (Friday) - closed
    # Total closed: 5 days
    # Open days: 26
    assert len(demand) == 26

    # Verify specific closed days not in demand
    for d in [
        date(2026, 12, 6),
        date(2026, 12, 13),
        date(2026, 12, 20),
        date(2026, 12, 25),
        date(2026, 12, 27),
    ]:
        assert (str(proc_id), d) not in demand


def test_demand_grid_with_override() -> None:
    """Demand grid respects coverage overrides."""
    brand_id = uuid4()
    proc_id = uuid4()

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=1,
    )

    overrides = [
        CoverageOverride(process_id=proc_id, weekday=5, date=None, min_coverage=2),  # Saturdays = 2
    ]

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=overrides,
        assignments=[],
        holidays=[],
        leaves=[],
        settings={},
    )

    demand = build_demand_grid(problem)

    # Saturdays in Dec 2026: 5, 12, 19, 26
    for d in [date(2026, 12, 5), date(2026, 12, 12), date(2026, 12, 19), date(2026, 12, 26)]:
        assert demand[(str(proc_id), d)] == 2

    # Other days = 1
    for d in [date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3)]:
        assert demand[(str(proc_id), d)] == 1
