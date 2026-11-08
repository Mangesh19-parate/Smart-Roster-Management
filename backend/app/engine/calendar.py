from datetime import date

from app.engine.types import CalendarMode, CoverageOverride, Holiday, HolidayScope, Process


def is_closed(
    process: Process,
    d: date,
    holidays: list[Holiday],
    overrides: list[CoverageOverride],
) -> bool:
    """
    Determine if a process is closed on a given date.
    Returns True if closed (no demand), False if open (has demand).
    """
    # Check brand-scoped holidays first
    for h in holidays:
        if h.date == d:
            if h.scope == HolidayScope.COMPANY:
                return True
            if h.scope == HolidayScope.BRAND and h.brand_id == process.brand_id:
                return True

    # Check calendar mode
    if process.calendar_mode == CalendarMode.ALL_365:
        return False  # Never closed except holidays (handled above)
    elif process.calendar_mode == CalendarMode.EXCL_PH:
        # Closed on Sundays and public holidays (Sundays handled below)
        pass
    elif process.calendar_mode == CalendarMode.EXCL_SUN_PH:
        # Closed on Sundays and public holidays
        pass

    # Check if Sunday
    if d.weekday() == 6:  # Sunday
        if process.calendar_mode in (CalendarMode.EXCL_PH, CalendarMode.EXCL_SUN_PH):
            return True

    return False


def get_min_coverage(process: Process, d: date, overrides: list[CoverageOverride]) -> int:
    """
    Get minimum coverage for a process on a date.
    Date override beats weekday override beats default.
    """
    # Date-specific override
    for o in overrides:
        if o.process_id == process.id and o.date == d:
            return o.min_coverage

    # Weekday override
    weekday = d.weekday()  # Monday=0, Sunday=6
    for o in overrides:
        if o.process_id == process.id and o.weekday == weekday:
            return o.min_coverage

    return process.min_coverage


def required(
    process: Process,
    d: date,
    holidays: list[Holiday],
    overrides: list[CoverageOverride],
) -> int:
    """
    Calculate required coverage for a process on a date.
    Returns 0 if closed, else min_coverage after overrides.
    """
    if is_closed(process, d, holidays, overrides):
        return 0
    return get_min_coverage(process, d, overrides)
