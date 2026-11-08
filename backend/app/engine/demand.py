from datetime import date

from app.engine.lib.dates import days_in_range
from app.engine.types import CoverageOverride, Holiday, Problem, Process


def build_demand_grid(problem: Problem) -> dict[tuple[str, date], int]:
    """
    Build demand grid: (process_id_str, date) -> required coverage.
    """
    demand = {}
    for process in problem.processes:
        for d in days_in_range(problem.month_start, problem.month_end):
            req = required(process, d, problem.holidays, problem.coverage_overrides)
            if req > 0:
                demand[(str(process.id), d)] = req
    return demand


def required(
    process: Process,
    d: date,
    holidays: list[Holiday],
    overrides: list[CoverageOverride],
) -> int:
    """Calculate required coverage for a process on a date."""
    from app.engine.calendar import get_min_coverage, is_closed

    if is_closed(process, d, holidays, overrides):
        return 0
    return get_min_coverage(process, d, overrides)


def get_brand_demand(
    brand_id: str,
    demand_grid: dict[tuple[str, date], int],
    processes: list[Process],
) -> dict[date, int]:
    """Get total demand for a brand on each date."""
    brand_process_ids = {str(p.id) for p in processes if str(p.brand_id) == brand_id}
    brand_demand: dict[date, int] = {}
    for (pid, d), req in demand_grid.items():
        if pid in brand_process_ids:
            brand_demand[d] = brand_demand.get(d, 0) + req
    return brand_demand


def get_process_demand(
    process_id: str,
    demand_grid: dict[tuple[str, date], int],
) -> dict[date, int]:
    """Get demand for a specific process on each date."""
    return {d: req for (pid, d), req in demand_grid.items() if pid == process_id}
