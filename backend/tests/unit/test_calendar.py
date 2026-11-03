from datetime import date
from uuid import uuid4

from app.engine.calendar import get_min_coverage, is_closed, required
from app.engine.types import (
    CalendarMode,
    CoverageOverride,
    Holiday,
    HolidayScope,
    Process,
)


def make_process(calendar_mode: CalendarMode, brand_id: str = "brand-1") -> Process:
    return Process(
        id=uuid4(),
        brand_id=uuid4(),
        name="CS",
        calendar_mode=calendar_mode,
        min_coverage=1,
    )


def test_all_365_open_except_holidays() -> None:
    """ALL_365: open every day except holidays."""
    proc = make_process(CalendarMode.ALL_365)
    christmas = Holiday(date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None)
    holidays = [christmas]
    overrides = []

    # Regular day
    assert is_closed(proc, date(2026, 12, 24), holidays, overrides) is False
    assert required(proc, date(2026, 12, 24), holidays, overrides) == 1

    # Sunday
    assert is_closed(proc, date(2026, 12, 27), holidays, overrides) is False
    assert required(proc, date(2026, 12, 27), holidays, overrides) == 1

    # Holiday
    assert is_closed(proc, date(2026, 12, 25), holidays, overrides) is True
    assert required(proc, date(2026, 12, 25), holidays, overrides) == 0

    # Sunday that is also a holiday
    sunday_holiday = Holiday(date=date(2026, 12, 27), name="Sunday Holiday", scope=HolidayScope.COMPANY, brand_id=None)
    holidays2 = [sunday_holiday]
    assert is_closed(proc, date(2026, 12, 27), holidays2, overrides) is True
    assert required(proc, date(2026, 12, 27), holidays2, overrides) == 0


def test_excl_ph_closed_sundays_and_holidays() -> None:
    """EXCL_PH: closed on Sundays and public holidays."""
    proc = make_process(CalendarMode.EXCL_PH)
    christmas = Holiday(date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None)
    holidays = [christmas]
    overrides = []

    # Regular weekday
    assert is_closed(proc, date(2026, 12, 24), holidays, overrides) is False
    assert required(proc, date(2026, 12, 24), holidays, overrides) == 1

    # Sunday
    assert is_closed(proc, date(2026, 12, 27), holidays, overrides) is True
    assert required(proc, date(2026, 12, 27), holidays, overrides) == 0

    # Holiday (Friday)
    assert is_closed(proc, date(2026, 12, 25), holidays, overrides) is True
    assert required(proc, date(2026, 12, 25), holidays, overrides) == 0

    # Sunday that is also a holiday
    sunday_holiday = Holiday(date=date(2026, 12, 27), name="Sunday Holiday", scope=HolidayScope.COMPANY, brand_id=None)
    holidays2 = [sunday_holiday]
    assert is_closed(proc, date(2026, 12, 27), holidays2, overrides) is True
    assert required(proc, date(2026, 12, 27), holidays2, overrides) == 0


def test_excl_sun_ph_closed_sundays_and_holidays() -> None:
    """EXCL_SUN_PH: closed on Sundays and public holidays."""
    proc = make_process(CalendarMode.EXCL_SUN_PH)
    christmas = Holiday(date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None)
    holidays = [christmas]
    overrides = []

    # Regular weekday
    assert is_closed(proc, date(2026, 12, 24), holidays, overrides) is False
    assert required(proc, date(2026, 12, 24), holidays, overrides) == 1

    # Sunday
    assert is_closed(proc, date(2026, 12, 27), holidays, overrides) is True
    assert required(proc, date(2026, 12, 27), holidays, overrides) == 0

    # Holiday (Friday)
    assert is_closed(proc, date(2026, 12, 25), holidays, overrides) is True
    assert required(proc, date(2026, 12, 25), holidays, overrides) == 0

    # Sunday that is also a holiday
    sunday_holiday = Holiday(date=date(2026, 12, 27), name="Sunday Holiday", scope=HolidayScope.COMPANY, brand_id=None)
    holidays2 = [sunday_holiday]
    assert is_closed(proc, date(2026, 12, 27), holidays2, overrides) is True
    assert required(proc, date(2026, 12, 27), holidays2, overrides) == 0


def test_brand_holiday_does_not_close_other_brands() -> None:
    """Brand-scoped holiday only closes that brand."""
    brand_id_1 = uuid4()
    brand_id_2 = uuid4()
    proc1 = make_process(CalendarMode.ALL_365)
    proc1 = Process(id=proc1.id, brand_id=brand_id_1, name=proc1.name, calendar_mode=proc1.calendar_mode, min_coverage=proc1.min_coverage)
    proc2 = make_process(CalendarMode.ALL_365)
    proc2 = Process(id=proc2.id, brand_id=brand_id_2, name=proc2.name, calendar_mode=proc2.calendar_mode, min_coverage=proc2.min_coverage)

    brand_holiday = Holiday(
        date=date(2026, 12, 13),
        name="Brand Day",
        scope=HolidayScope.BRAND,
        brand_id=brand_id_1,
    )
    holidays = [brand_holiday]
    overrides = []

    # Should close proc1 (same brand)
    assert is_closed(proc1, date(2026, 12, 13), holidays, overrides) is True

    # Should NOT close proc2 (different brand)
    assert is_closed(proc2, date(2026, 12, 13), holidays, overrides) is False


def test_date_override_beats_weekday_override() -> None:
    """Date-specific override beats weekday override."""
    proc = make_process(CalendarMode.ALL_365)
    overrides = [
        CoverageOverride(process_id=proc.id, weekday=5, date=None, min_coverage=2),  # Saturday = 2
        CoverageOverride(process_id=proc.id, weekday=None, date=date(2026, 12, 19), min_coverage=3),  # Specific Saturday = 3
    ]

    # Regular Saturday (weekday 5)
    assert get_min_coverage(proc, date(2026, 12, 12), overrides) == 2

    # Specific Saturday with date override
    assert get_min_coverage(proc, date(2026, 12, 19), overrides) == 3


def test_weekday_override_beats_default() -> None:
    """Weekday override beats default min_coverage."""
    proc = make_process(CalendarMode.ALL_365)
    overrides = [
        CoverageOverride(process_id=proc.id, weekday=5, date=None, min_coverage=2),
    ]

    # Saturday (weekday 5)
    assert get_min_coverage(proc, date(2026, 12, 12), overrides) == 2

    # Sunday (weekday 6) - no override
    assert get_min_coverage(proc, date(2026, 12, 13), overrides) == 1