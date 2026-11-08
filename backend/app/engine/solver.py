"""
OR-Tools CP-SAT Solver for Smart Roster Management.

This module implements the scheduling solver using OR-Tools CP-SAT.
It creates variables, adds hard constraints, and optimizes the objective
with coverage as penalized slack.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date

from ortools.sat.python import cp_model  # type: ignore[attr-defined]

from app.engine.availability import build_blocked_days
from app.engine.calendar import is_closed
from app.engine.coverage import calculate_coverage
from app.engine.demand import build_demand_grid
from app.engine.types import (
    AssignmentType,
    CoverAssignment,
    DayStatus,
    EntrySource,
    Problem,
    RosterEntry,
    SolverResult,
)


@dataclass(frozen=True)
class SolverConfig:
    """Solver configuration."""

    max_time_seconds: float = 15.0
    num_workers: int = 1
    random_seed: int = 42
    log_search_progress: bool = False


class RosterSolver:
    """CP-SAT based roster solver."""

    def __init__(self, problem: Problem, config: SolverConfig | None = None):
        self.problem = problem
        self.config = config or SolverConfig()
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

        # Indexes
        self._emp_ids = [str(e.id) for e in problem.employees if e.active]
        self._proc_ids = [str(p.id) for p in problem.processes]
        self._dates = list(self._date_range())

        # Variables
        self._work: dict[tuple[str, date], cp_model.IntVar] = {}
        self._cover: dict[tuple[str, str, date], cp_model.IntVar] = {}
        self._shortfall: dict[tuple[str, date], cp_model.IntVar] = {}

        # Previous roster for minimal change mode
        self._prev_entries: dict[tuple[str, date], RosterEntry] | None = None
        self._prev_covers: dict[tuple[str, str, date], CoverAssignment] | None = None

    def _date_range(self) -> list[date]:
        """Get all dates in the month."""
        dates = []
        d = self.problem.month_start
        while d <= self.problem.month_end:
            dates.append(d)
            from datetime import timedelta

            d += timedelta(days=1)
        return dates

    def set_previous_roster(
        self,
        entries: list[RosterEntry],
        covers: list[CoverAssignment],
    ) -> None:
        """Set previous roster for minimal-change mode."""
        self._prev_entries = {(str(e.employee_id), e.date): e for e in entries}
        self._prev_covers = {(str(c.employee_id), str(c.process_id), c.date): c for c in covers}

    def build(self) -> None:
        """Build the complete CP-SAT model."""
        self._create_variables()
        self._add_hard_constraints()
        self._add_objective()

    def _create_variables(self) -> None:
        """Create decision variables."""
        blocked = build_blocked_days(self.problem)

        # Work variables: 1 if employee works on date, 0 otherwise
        for emp_id in self._emp_ids:
            for d in self._dates:
                var_name = f"work_{emp_id}_{d.isoformat()}"
                if (emp_id, d) in blocked:
                    # Force to 0 (not working) on blocked days (approved leave, comp-off)
                    self._work[(emp_id, d)] = self.model.NewConstant(0)
                else:
                    self._work[(emp_id, d)] = self.model.NewBoolVar(var_name)

        # Cover variables: 1 if backup employee covers process on date
        # Only for BACKUP assignments
        for assignment in self.problem.assignments:
            if assignment.type != AssignmentType.BACKUP:
                continue
            emp_id = str(assignment.employee_id)
            proc_id = str(assignment.process_id)
            for d in self._dates:
                var_name = f"cover_{emp_id}_{proc_id}_{d.isoformat()}"
                self._cover[(emp_id, proc_id, d)] = self.model.NewBoolVar(var_name)

        # Shortfall variables: how many people short of required coverage
        demand_grid = build_demand_grid(self.problem)
        for (proc_id, d), req in demand_grid.items():
            if req > 0:
                var_name = f"shortfall_{proc_id}_{d.isoformat()}"
                self._shortfall[(proc_id, d)] = self.model.NewIntVar(0, req, var_name)

    def _add_hard_constraints(self) -> None:
        """Add all hard constraints."""
        self._add_locked_entries()
        self._add_closed_days()
        self._add_max_consecutive_days()
        self._add_weekly_rest_days()
        self._add_cover_capacity()
        self._add_cover_only_on_work_days()
        self._add_shortfall_definition()

    def _add_locked_entries(self) -> None:
        """Fix locked entries from previous roster, preserving their actual status."""
        if not self._prev_entries:
            return
        for (emp_id, d), entry in self._prev_entries.items():
            if entry.locked and emp_id in self._emp_ids:
                if entry.status == DayStatus.WORK:
                    self.model.Add(self._work[(emp_id, d)] == 1)
                else:
                    self.model.Add(self._work[(emp_id, d)] == 0)

    def _add_closed_days(self) -> None:
        """No work on closed days for any process employee is assigned to."""
        for emp_id in self._emp_ids:
            # Get primary processes for this employee
            primary_procs = [
                str(a.process_id)
                for a in self.problem.assignments
                if str(a.employee_id) == emp_id and a.type == AssignmentType.PRIMARY
            ]
            if not primary_procs:
                continue

            for d in self._dates:
                # Check if ALL primary processes are closed
                all_closed = True
                for proc_id in primary_procs:
                    process = next(
                        (p for p in self.problem.processes if str(p.id) == proc_id), None
                    )
                    if process and not is_closed(
                        process, d, self.problem.holidays, self.problem.coverage_overrides
                    ):
                        all_closed = False
                        break
                if all_closed:
                    # Force WO (not working)
                    self.model.Add(self._work[(emp_id, d)] == 0)

    def _add_max_consecutive_days(self) -> None:
        """Max consecutive working days constraint."""
        max_consec = self.problem.settings.get("max_consecutive_days", 6)
        for emp_id in self._emp_ids:
            for i in range(len(self._dates) - max_consec):
                window = self._dates[i : i + max_consec + 1]
                # Sum of work in any window of (max_consec + 1) days <= max_consec
                self.model.Add(sum(self._work[(emp_id, d)] for d in window) <= max_consec)

    def _add_weekly_rest_days(self) -> None:
        """At least weekly_rest_days rest days per Mon-Sun week."""
        weekly_rest = self.problem.settings.get("weekly_rest_days", 1)
        from app.engine.lib.dates import days_in_range, monday_of_week, sunday_of_week

        current_monday = monday_of_week(self.problem.month_start)
        month_end_sunday = sunday_of_week(self.problem.month_end)

        while current_monday <= month_end_sunday:
            week_end = sunday_of_week(current_monday)
            week_dates = [
                d
                for d in days_in_range(current_monday, week_end)
                if self.problem.month_start <= d <= self.problem.month_end
            ]
            if len(week_dates) >= 4:
                for emp_id in self._emp_ids:
                    # Rest days = days in week - work days
                    work_vars = [self._work[(emp_id, d)] for d in week_dates]
                    self.model.Add(sum(work_vars) <= len(week_dates) - weekly_rest)
            current_monday = week_end + __import__("datetime").timedelta(days=1)

    def _add_cover_capacity(self) -> None:
        """Backup cover cannot exceed max_cover_per_day."""
        for emp in self.problem.employees:
            if not emp.active:
                continue
            emp_id = str(emp.id)
            max_cover = emp.max_cover_per_day
            for d in self._dates:
                cover_vars = [
                    self._cover[(emp_id, proc_id, d)]
                    for proc_id in self._proc_ids
                    if (emp_id, proc_id, d) in self._cover
                ]
                if cover_vars:
                    self.model.Add(sum(cover_vars) <= max_cover)

    def _add_cover_only_on_work_days(self) -> None:
        """Cover only possible if backup employee is working."""
        for (emp_id, _proc_id, d), cover_var in self._cover.items():
            self.model.Add(cover_var <= self._work[(emp_id, d)])

    def _add_shortfall_definition(self) -> None:
        """Shortfall = max(0, required - supply)."""
        for (proc_id, d), req in build_demand_grid(self.problem).items():
            if req == 0:
                continue

            shortfall_var = self._shortfall.get((proc_id, d))
            if shortfall_var is None:
                continue

            # Supply = primary workers + covers
            supply_vars = []

            # Primary assignments
            for assignment in self.problem.assignments:
                if (
                    str(assignment.process_id) == proc_id
                    and assignment.type == AssignmentType.PRIMARY
                ):
                    emp_id = str(assignment.employee_id)
                    if (emp_id, d) in self._work:
                        supply_vars.append(self._work[(emp_id, d)])

            # Backup covers
            for cover_key, cover_var in self._cover.items():
                if cover_key[1] == proc_id and cover_key[2] == d:
                    supply_vars.append(cover_var)

            if supply_vars:
                total_supply = self.model.NewIntVar(
                    0, len(supply_vars), f"supply_{proc_id}_{d.isoformat()}"
                )
                self.model.Add(total_supply == sum(supply_vars))
                # shortfall >= req - supply
                self.model.Add(shortfall_var >= req - total_supply)
                # shortfall >= 0 (enforced by domain)
            else:
                # No eligible supply available; shortfall equals required coverage
                self.model.Add(shortfall_var >= req)

    def _add_objective(self) -> None:
        """Add the optimization objective."""
        weights = self.problem.settings.get("solver_weights", {})
        short_total_w = weights.get("short_total", 10000)
        entries_changed_w = weights.get("entries_changed", 50)
        cover_assignments_w = weights.get("cover_assignments", 20)
        pref_off_missed_w = weights.get("pref_off_missed", 5)
        fairness_spread_w = weights.get("fairness_spread", 15)

        objective_terms = []

        # 1. Minimize total shortfall (highest priority)
        for shortfall_var in self._shortfall.values():
            objective_terms.append(shortfall_var * short_total_w)

        # 2. Minimize changes from previous roster (minimal change mode)
        if self._prev_entries:
            for (emp_id, d), prev_entry in self._prev_entries.items():
                if emp_id not in self._emp_ids:
                    continue
                if prev_entry.locked:
                    continue
                # Penalty if current assignment differs from previous
                diff_var = self.model.NewBoolVar(f"diff_{emp_id}_{d.isoformat()}")
                if prev_entry.status == DayStatus.WORK:
                    # Was working, now not working
                    self.model.Add(diff_var >= 1 - self._work[(emp_id, d)])
                else:
                    # Was not working, now working
                    self.model.Add(diff_var >= self._work[(emp_id, d)])
                objective_terms.append(diff_var * entries_changed_w)

        # 3. Minimize cover assignments
        for cover_var in self._cover.values():
            objective_terms.append(cover_var * cover_assignments_w)

        # 4. Penalize working on preferred off days
        for emp in self.problem.employees:
            if not emp.active:
                continue
            emp_id = str(emp.id)
            for pref_day in emp.preferred_off_days:
                for d in self._dates:
                    if d.weekday() == pref_day and (emp_id, d) in self._work:
                        objective_terms.append(self._work[(emp_id, d)] * pref_off_missed_w)

        # 5. Workload balancing: minimize workload spread across active employees
        if len(self._emp_ids) > 1 and len(self._dates) > 0:
            max_work = self.model.NewIntVar(0, len(self._dates), "max_work_days")
            min_work = self.model.NewIntVar(0, len(self._dates), "min_work_days")
            for emp_id in self._emp_ids:
                emp_work_total = sum(self._work[(emp_id, d)] for d in self._dates)
                self.model.Add(max_work >= emp_work_total)
                self.model.Add(min_work <= emp_work_total)
            objective_terms.append((max_work - min_work) * fairness_spread_w)

        # Sunday/holiday work penalty
        for emp in self.problem.employees:
            if not emp.active:
                continue
            emp_id = str(emp.id)
            for d in self._dates:
                is_sunday = d.weekday() == 6
                is_ph = any(
                    h.date == d and h.scope.value == "COMPANY" for h in self.problem.holidays
                )
                if is_sunday or is_ph:
                    if (emp_id, d) in self._work:
                        half_spread = fairness_spread_w // 2 + 1
                        objective_terms.append(self._work[(emp_id, d)] * half_spread)

        # 6. Spare coverage penalty (people working when not needed)
        # Only penalize if supply > required (handled via shortfall being 0)
        # This is implicitly handled by cover_assignments penalty

        self.model.Minimize(sum(objective_terms))

    def solve(self) -> SolverResult:
        """Solve the model and return result."""
        # Configure solver
        self.solver.parameters.max_time_in_seconds = self.config.max_time_seconds
        self.solver.parameters.num_search_workers = self.config.num_workers
        self.solver.parameters.random_seed = self.config.random_seed
        self.solver.parameters.log_search_progress = self.config.log_search_progress

        start_time = time.time()
        status = self.solver.Solve(self.model)
        solve_ms = int((time.time() - start_time) * 1000)

        # Map solver status
        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "UNKNOWN",
        }
        status_str = status_map.get(status, "UNKNOWN")

        # Do not access solution variables if solver did not find a feasible/optimal solution
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return SolverResult(
                entries=[],
                covers=[],
                status=status_str,
                objective=0,
                best_bound=0,
                solve_ms=solve_ms,
                gaps_total=0,
                gaps_unresolved_by_reason=(
                    {"solver_infeasible": 1} if status == cp_model.INFEASIBLE else {}
                ),
            )

        # Extract solution
        entries = []
        covers = []

        for emp_id in self._emp_ids:
            for d in self._dates:
                # If entry was locked from previous roster, preserve its status and lock flag
                if self._prev_entries and (emp_id, d) in self._prev_entries:
                    prev_entry = self._prev_entries[(emp_id, d)]
                    if prev_entry.locked:
                        entries.append(
                            RosterEntry(
                                employee_id=__import__("uuid").UUID(emp_id),
                                date=d,
                                status=prev_entry.status,
                                locked=True,
                                source=prev_entry.source,
                            )
                        )
                        continue

                if self.solver.Value(self._work[(emp_id, d)]) == 1:
                    entries.append(
                        RosterEntry(
                            employee_id=__import__("uuid").UUID(emp_id),
                            date=d,
                            status=DayStatus.WORK,
                            locked=False,
                            source=EntrySource.GENERATED,
                        )
                    )
                else:
                    # Check if WO, PH, LEAVE, COMP_OFF
                    blocked = build_blocked_days(self.problem)
                    status_day = DayStatus.WO
                    if (emp_id, d) in blocked:
                        # Determine specific blocked status
                        emp = next(e for e in self.problem.employees if str(e.id) == emp_id)
                        for leave in self.problem.leaves:
                            if leave.employee_id == emp.id and leave.status == "APPROVED":
                                if leave.start_date <= d <= leave.end_date:
                                    if leave.type == "COMP_OFF":
                                        status_day = DayStatus.COMP_OFF
                                    else:
                                        status_day = DayStatus.LEAVE
                                    break
                    else:
                        # Check for holidays
                        for h in self.problem.holidays:
                            if h.date == d:
                                if h.scope.value == "COMPANY" or (
                                    h.scope.value == "BRAND"
                                    and any(
                                        str(a.process_id) == str(p.id)
                                        for a in self.problem.assignments
                                        for p in self.problem.processes
                                        if str(a.employee_id) == emp_id
                                        and a.type == AssignmentType.PRIMARY
                                        and p.brand_id == h.brand_id
                                    )
                                ):
                                    status_day = DayStatus.PH
                                    break
                    entries.append(
                        RosterEntry(
                            employee_id=__import__("uuid").UUID(emp_id),
                            date=d,
                            status=status_day,
                            locked=False,
                            source=EntrySource.GENERATED,
                        )
                    )

        for (emp_id, proc_id, d), cover_var in self._cover.items():
            if self.solver.Value(cover_var) == 1:
                covers.append(
                    CoverAssignment(
                        employee_id=__import__("uuid").UUID(emp_id),
                        process_id=__import__("uuid").UUID(proc_id),
                        date=d,
                        source=EntrySource.GENERATED,
                    )
                )

        # Calculate gaps
        demand_grid = build_demand_grid(self.problem)
        coverage = calculate_coverage(
            entries, covers, self.problem.assignments, self.problem.processes, demand_grid
        )
        shortfalls = coverage["shortfalls"]
        gaps_total = sum(shortfalls.values())

        gaps_by_reason: dict[str, int] = {}
        for (proc_id, d), gap in shortfalls.items():
            if gap > 0:
                process = next(p for p in self.problem.processes if str(p.id) == proc_id)
                reason = f"{process.name}_{d.isoformat()}"
                gaps_by_reason[reason] = gaps_by_reason.get(reason, 0) + gap

        # Compute objective and best bound
        objective_val = int(self.solver.ObjectiveValue())
        best_bound_val = int(self.solver.BestObjectiveBound())

        return SolverResult(
            entries=entries,
            covers=covers,
            status=status_str,
            objective=objective_val,
            best_bound=best_bound_val,
            solve_ms=solve_ms,
            gaps_total=gaps_total,
            gaps_unresolved_by_reason=gaps_by_reason,
        )


def solve_roster(problem: Problem, config: SolverConfig | None = None) -> SolverResult:
    """Convenience function to solve a roster problem."""
    solver = RosterSolver(problem, config)
    solver.build()
    return solver.solve()


def solve_roster_with_previous(
    problem: Problem,
    prev_entries: list[RosterEntry],
    prev_covers: list[CoverAssignment],
    config: SolverConfig | None = None,
) -> SolverResult:
    """Solve with minimal-change mode using previous roster."""
    solver = RosterSolver(problem, config)
    solver.set_previous_roster(prev_entries, prev_covers)
    solver.build()
    return solver.solve()
