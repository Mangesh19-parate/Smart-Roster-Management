from collections.abc import Iterator
from datetime import date, timedelta


def monday_of_week(d: date) -> date:
    """Return the Monday of the week containing date d (Monday = 0)."""
    return d - timedelta(days=d.weekday())


def sunday_of_week(d: date) -> date:
    """Return the Sunday of the week containing date d."""
    return d + timedelta(days=(6 - d.weekday()))


def week_bounds(d: date) -> tuple[date, date]:
    """Return (Monday, Sunday) of the week containing date d."""
    return monday_of_week(d), sunday_of_week(d)


def weeks_in_month(month_start: date, month_end: date) -> list[tuple[date, date]]:
    """
    Return list of (week_start, week_end) for all Mon-Sun weeks that intersect
    the given month range.
    """
    weeks = []
    current = monday_of_week(month_start)
    while current <= month_end:
        week_start = current
        week_end = sunday_of_week(current)
        weeks.append((week_start, week_end))
        current = week_end + timedelta(days=1)
    return weeks


def is_full_week_in_month(
    week_start: date,
    week_end: date,
    month_start: date,
    month_end: date,
) -> bool:
    """Check if a Mon-Sun week is fully contained within the month."""
    return week_start >= month_start and week_end <= month_end


def days_in_range(start: date, end: date) -> Iterator[date]:
    """Yield all dates from start to end inclusive."""
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def month_start_end(year: int, month: int) -> tuple[date, date]:
    """Return (first_day, last_day) of the given month."""
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    first = date(year, month, 1)
    last = next_month - timedelta(days=1)
    return first, last


def parse_month(month_str: str) -> tuple[date, date]:
    """Parse 'YYYY-MM' string to (month_start, month_end)."""
    year, month = map(int, month_str.split("-"))
    return month_start_end(year, month)


def format_month(d: date) -> str:
    """Format date as 'YYYY-MM'."""
    return d.strftime("%Y-%m")


def add_months(d: date, months: int) -> date:
    """Add months to a date, handling year rollover."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    days_in_month = [
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ][month - 1]
    day = min(d.day, days_in_month)
    return date(year, month, day)