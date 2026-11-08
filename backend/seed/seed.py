"""
Deterministic seed script for the Smart Roster Management System.
Creates 5 pods, 37 employees, 23 brands with processes, assignments, holidays, leaves, and demo users.
"""

import os
import sys
from datetime import date
from uuid import UUID, uuid4

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.db.models import (
    AppUser,
    Assignment,
    AssignmentType,
    Brand,
    CalendarMode,
    CoverageOverride,
    Employee,
    EmployeeRole,
    Holiday,
    HolidayScope,
    Leave,
    LeaveStatus,
    LeaveType,
    Pod,
    Process,
    Setting,
)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

settings = get_settings()

# Use service role key for admin operations
engine = create_engine(settings.database_url, pool_pre_ping=True)


def clear_all_data(db: Session) -> None:
    """Clear all data from tables in correct order (respecting FK constraints)."""
    tables = [
        "roster_approval",
        "cover_assignment",
        "roster_entry",
        "change_log",
        "roster",
        "leave",
        "holiday",
        "coverage_override",
        "assignment",
        "process",
        "brand",
        "explanation_cache",
        "setting",
        "app_user",
        "employee",
        "pod",
    ]
    for table in tables:
        db.execute(text(f'TRUNCATE TABLE "{table}" CASCADE'))
    db.commit()


def seed_pods(db: Session) -> dict[str, UUID]:
    """Create 5 pods with leads (will link employees after they're created)."""
    pods = {}
    pod_names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]
    for name in pod_names:
        pod = Pod(name=name)
        db.add(pod)
        db.flush()
        pods[name] = pod.id
    db.commit()
    return pods


def seed_employees(db: Session, pod_ids: dict[str, UUID]) -> dict[str, UUID]:
    """Create 37 employees: 5 leads + 32 agents across 5 pods."""
    employees = {}

    # Pod leads (1 per pod)
    leads = [
        ("Meera Patel", "Alpha", EmployeeRole.LEAD, [5, 6], 6, 2),  # Sat, Sun
        ("Rohan Singh", "Bravo", EmployeeRole.LEAD, [5, 6], 6, 2),
        ("Sana Khan", "Charlie", EmployeeRole.LEAD, [5, 6], 6, 2),
        ("Arjun Reddy", "Delta", EmployeeRole.LEAD, [5, 6], 6, 2),
        ("Priya Sharma", "Echo", EmployeeRole.LEAD, [5, 6], 6, 2),
    ]

    # Agents (32 total, distributed across pods)
    agents = [
        # Alpha pod (6 agents + 1 lead = 7 total)
        ("Amit Kumar", "Alpha", EmployeeRole.AGENT, [6], 6, 2),  # Sun
        ("Neha Gupta", "Alpha", EmployeeRole.AGENT, [5], 6, 2),  # Sat
        ("Vikram Joshi", "Alpha", EmployeeRole.AGENT, [6], 6, 2),
        ("Kavya Iyer", "Alpha", EmployeeRole.AGENT, [5], 6, 2),
        ("Rahul Verma", "Alpha", EmployeeRole.AGENT, [6], 6, 2),
        ("Pooja Nair", "Alpha", EmployeeRole.AGENT, [5], 6, 2),
        # Bravo pod (6 agents + 1 lead = 7 total)
        ("Sanjay Mehta", "Bravo", EmployeeRole.AGENT, [6], 6, 2),
        ("Divya Kapoor", "Bravo", EmployeeRole.AGENT, [5], 6, 2),
        ("Karan Malhotra", "Bravo", EmployeeRole.AGENT, [6], 6, 2),
        ("Anjali Desai", "Bravo", EmployeeRole.AGENT, [5], 6, 2),
        ("Manish Shah", "Bravo", EmployeeRole.AGENT, [6], 6, 2),
        ("Shreya Pillai", "Bravo", EmployeeRole.AGENT, [5], 6, 2),
        # Charlie pod (6 agents + 1 lead = 7 total)
        ("Aditya Rao", "Charlie", EmployeeRole.AGENT, [6], 6, 2),
        ("Sonia Menon", "Charlie", EmployeeRole.AGENT, [5], 6, 2),
        ("Gaurav Bhat", "Charlie", EmployeeRole.AGENT, [6], 6, 2),
        ("Riya Choudhary", "Charlie", EmployeeRole.AGENT, [5], 6, 2),
        ("Nikhil Agarwal", "Charlie", EmployeeRole.AGENT, [6], 6, 2),
        ("Tanvi Bansal", "Charlie", EmployeeRole.AGENT, [5], 6, 2),
        # Delta pod (6 agents + 1 lead = 7 total)
        ("Kunal Sethi", "Delta", EmployeeRole.AGENT, [6], 6, 2),
        ("Meera Jain", "Delta", EmployeeRole.AGENT, [5], 6, 2),
        ("Rohit Khanna", "Delta", EmployeeRole.AGENT, [6], 6, 2),
        ("Ayesha Oberoi", "Delta", EmployeeRole.AGENT, [5], 6, 2),
        ("Varun Chopra", "Delta", EmployeeRole.AGENT, [6], 6, 2),
        ("Isha Tandon", "Delta", EmployeeRole.AGENT, [5], 6, 2),
        # Echo pod (5 agents + 1 lead + 2 floaters = 8 total)
        ("Akash Gulati", "Echo", EmployeeRole.AGENT, [6], 6, 2),
        ("Shruti Arora", "Echo", EmployeeRole.AGENT, [5], 6, 2),
        ("Harsh Mittal", "Echo", EmployeeRole.AGENT, [6], 6, 2),
        ("Nidhi Sachdeva", "Echo", EmployeeRole.AGENT, [5], 6, 2),
        ("Rohan Batra", "Echo", EmployeeRole.AGENT, [6], 6, 2),
        # Floaters (2) - assigned to Echo pod but BACKUP on 365-day brands
        ("Float One", "Echo", EmployeeRole.FLOATER, [5, 6], 6, 3),  # Higher cover capacity
        ("Float Two", "Echo", EmployeeRole.FLOATER, [5, 6], 6, 3),
    ]

    all_employees = leads + agents

    for name, pod_name, role, pref_off, max_consec, max_cover in all_employees:
        emp = Employee(
            name=name,
            pod_id=pod_ids[pod_name],
            role=role,
            preferred_off_days=pref_off,
            max_consecutive_days=max_consec,
            max_cover_per_day=max_cover,
            active=True,
        )
        db.add(emp)
        db.flush()
        employees[name] = emp.id

    db.commit()

    # Update pod lead_employee_id
    for name, pod_name, role, _, _, _ in leads:
        pod = db.get(Pod, pod_ids[pod_name])
        pod.lead_employee_id = employees[name]

    db.commit()
    return employees


def seed_brands_and_processes(db: Session) -> tuple[dict[str, UUID], dict[str, UUID]]:
    """Create 23 brands with their processes."""
    brands = {}
    processes = {}

    # 18 single-resource brands (78% of 23)
    single_resource_brands = [
        ("ZENITH", "ALL_365"),  # Planted case 1: no backup
        ("AURA", "ALL_365"),
        ("NOVA", "ALL_365"),
        ("PULSE", "ALL_365"),
        ("QUANTUM", "ALL_365"),
        ("RADIANT", "ALL_365"),
        ("SOLAR", "ALL_365"),
        ("TITAN", "ALL_365"),
        ("VEGA", "ALL_365"),
        ("APEX", "EXCL_PH"),
        ("BLOOM", "EXCL_PH"),
        ("CREST", "EXCL_PH"),
        ("DAWN", "EXCL_PH"),
        ("EMBER", "EXCL_PH"),
        ("FLARE", "EXCL_PH"),
        ("GLOW", "EXCL_SUN_PH"),
        ("HAVEN", "EXCL_SUN_PH"),
        ("IVORY", "EXCL_SUN_PH"),
    ]

    # 5 multi-employee brands
    multi_resource_brands = [
        ("ORION", ["CS", "ACC", "Retention"], "ALL_365"),  # 3 employees
        ("PHOENIX", ["CS", "NDR"], "EXCL_PH"),  # 3 employees (2 cal modes) - Planted case 3
        ("QUASAR", ["CS", "ACC"], "ALL_365"),  # 3 employees
        ("STELLAR", ["CS", "Retention", "NDR"], "EXCL_SUN_PH"),  # 3 employees
        ("UNITY", ["CS", "ACC"], "ALL_365"),  # 2 employees
    ]

    # Create all brands and their processes
    for brand_name, cal_mode in single_resource_brands:
        brand = Brand(name=brand_name, active=True)
        db.add(brand)
        db.flush()
        brands[brand_name] = brand.id

        proc = Process(
            brand_id=brand.id,
            name="CS",
            calendar_mode=CalendarMode(cal_mode),
            min_coverage=1,
        )
        db.add(proc)
        db.flush()
        processes[f"{brand_name}_CS"] = proc.id

    for brand_name, process_names, cal_mode in multi_resource_brands:
        brand = Brand(name=brand_name, active=True)
        db.add(brand)
        db.flush()
        brands[brand_name] = brand.id

        for proc_name in process_names:
            proc = Process(
                brand_id=brand.id,
                name=proc_name,
                calendar_mode=CalendarMode(cal_mode),
                min_coverage=1,
            )
            db.add(proc)
            db.flush()
            processes[f"{brand_name}_{proc_name}"] = proc.id

    db.commit()

    # Coverage override for shared process (Planted case 4)
    # Find a process that needs 2 people on selected weekdays
    # We'll add override to one of the multi-brand processes
    orion_cs = processes.get("ORION_CS")
    if orion_cs:
        override = CoverageOverride(
            process_id=orion_cs,
            weekday=5,  # Saturday
            min_coverage=2,
        )
        db.add(override)

    phoenix_cs = processes.get("PHOENIX_CS")
    if phoenix_cs:
        override = CoverageOverride(
            process_id=phoenix_cs,
            weekday=5,  # Saturday
            min_coverage=2,
        )
        db.add(override)

    db.commit()
    return brands, processes


def seed_assignments(db: Session, employees: dict[str, UUID], processes: dict[str, UUID]) -> None:
    """Create assignments linking employees to processes."""
    # Single-resource brands: 1 PRIMARY each (18 brands)
    # We'll assign the first 18 agents to these
    single_brand_processes = [
        k
        for k in processes.keys()
        if not any(m in k for m in ["ORION", "PHOENIX", "QUASAR", "STELLAR", "UNITY"])
    ]

    agent_names = [
        k
        for k in employees.keys()
        if k
        not in [
            "Meera Patel",
            "Rohan Singh",
            "Sana Khan",
            "Arjun Reddy",
            "Priya Sharma",
            "Float One",
            "Float Two",
        ]
    ]

    # Assign 18 agents to 18 single-resource brands
    for i, proc_key in enumerate(single_brand_processes):
        if i < len(agent_names):
            assignment = Assignment(
                employee_id=employees[agent_names[i]],
                process_id=processes[proc_key],
                type=AssignmentType.PRIMARY,
            )
            db.add(assignment)

    # Multi-resource brands
    # ORION: 3 employees on CS, ACC, Retention
    orion_emps = ["Amit Kumar", "Neha Gupta", "Vikram Joshi"]
    for emp_name in orion_emps:
        for proc_suffix in ["CS", "ACC", "Retention"]:
            proc_key = f"ORION_{proc_suffix}"
            if proc_key in processes:
                assignment = Assignment(
                    employee_id=employees[emp_name],
                    process_id=processes[proc_key],
                    type=AssignmentType.PRIMARY,
                )
                db.add(assignment)

    # PHOENIX: 3 employees on CS, NDR (different calendars) - Planted case 3
    phoenix_emps = ["Kavya Iyer", "Rahul Verma", "Pooja Nair"]
    for emp_name in phoenix_emps:
        for proc_suffix in ["CS", "NDR"]:
            proc_key = f"PHOENIX_{proc_suffix}"
            if proc_key in processes:
                assignment = Assignment(
                    employee_id=employees[emp_name],
                    process_id=processes[proc_key],
                    type=AssignmentType.PRIMARY,
                )
                db.add(assignment)

    # QUASAR: 3 employees on CS, ACC
    quasar_emps = ["Sanjay Mehta", "Divya Kapoor", "Karan Malhotra"]
    for emp_name in quasar_emps:
        for proc_suffix in ["CS", "ACC"]:
            proc_key = f"QUASAR_{proc_suffix}"
            if proc_key in processes:
                assignment = Assignment(
                    employee_id=employees[emp_name],
                    process_id=processes[proc_key],
                    type=AssignmentType.PRIMARY,
                )
                db.add(assignment)

    # STELLAR: 3 employees on CS, Retention, NDR
    stellar_emps = ["Anjali Desai", "Manish Shah", "Shreya Pillai"]
    for emp_name in stellar_emps:
        for proc_suffix in ["CS", "Retention", "NDR"]:
            proc_key = f"STELLAR_{proc_suffix}"
            if proc_key in processes:
                assignment = Assignment(
                    employee_id=employees[emp_name],
                    process_id=processes[proc_key],
                    type=AssignmentType.PRIMARY,
                )
                db.add(assignment)

    # UNITY: 2 employees on CS, ACC
    unity_emps = ["Aditya Rao", "Sonia Menon"]
    for emp_name in unity_emps:
        for proc_suffix in ["CS", "ACC"]:
            proc_key = f"UNITY_{proc_suffix}"
            if proc_key in processes:
                assignment = Assignment(
                    employee_id=employees[emp_name],
                    process_id=processes[proc_key],
                    type=AssignmentType.PRIMARY,
                )
                db.add(assignment)

    # Floaters as BACKUP on 365-day brands (Planted case 2 & 5)
    floaters = ["Float One", "Float Two"]
    all_365_processes = [
        k for k in processes.keys() if "ALL_365" in k and proc_key_exists(db, processes[k])
    ]
    # Add floaters as backup to some 365-day brands
    for i, floater_name in enumerate(floaters):
        # Assign to first few 365-day brands as BACKUP
        for j in range(min(5, len(all_365_processes))):
            proc_key = all_365_processes[(i * 5 + j) % len(all_365_processes)]
            assignment = Assignment(
                employee_id=employees[floater_name],
                process_id=processes[proc_key],
                type=AssignmentType.BACKUP,
            )
            db.add(assignment)

    # Overlapping PRIMARY assignments (Planted case 7) - two people on one process
    # Add a second PRIMARY to ZENITH_CS
    zenith_cs = processes.get("ZENITH_CS")
    if zenith_cs and len(agent_names) > 18:
        assignment = Assignment(
            employee_id=employees[agent_names[18]],
            process_id=zenith_cs,
            type=AssignmentType.PRIMARY,
        )
        db.add(assignment)

    db.commit()


def proc_key_exists(db: Session, process_id: UUID) -> bool:
    """Check if process has calendar_mode ALL_365."""
    from app.db.models import CalendarMode, Process

    proc = db.get(Process, process_id)
    return proc and proc.calendar_mode == CalendarMode.ALL_365


def seed_holidays(db: Session, brands: dict[str, UUID]) -> None:
    """Create company and brand holidays for December 2026."""
    # Company holidays
    company_holidays = [
        (date(2026, 12, 25), "Christmas Day"),  # Friday
        (date(2026, 12, 26), "Boxing Day"),  # Saturday
    ]
    for hol_date, name in company_holidays:
        holiday = Holiday(date=hol_date, name=name, scope=HolidayScope.COMPANY)
        db.add(holiday)

    # Brand-scoped holiday on Sunday 13 Dec 2026 (Planted case 6)
    # Pick first brand for brand-scoped holiday
    first_brand_id = list(brands.values())[0]
    brand_holiday = Holiday(
        date=date(2026, 12, 13),
        name="Brand Foundation Day",
        scope=HolidayScope.BRAND,
        brand_id=first_brand_id,
    )
    db.add(brand_holiday)

    db.commit()


def seed_leaves(db: Session, employees: dict[str, UUID]) -> None:
    """Create approved leaves for demo (Planted case 8)."""
    # Add some approved leaves on non-critical days
    leaves_data = [
        ("Amit Kumar", date(2026, 12, 2), date(2026, 12, 2), LeaveType.PLANNED),
        ("Neha Gupta", date(2026, 12, 9), date(2026, 12, 9), LeaveType.PLANNED),
        ("Vikram Joshi", date(2026, 12, 16), date(2026, 12, 16), LeaveType.PLANNED),
        ("Sanjay Mehta", date(2026, 12, 3), date(2026, 12, 4), LeaveType.PLANNED),  # 2 days
        ("Divya Kapoor", date(2026, 12, 10), date(2026, 12, 10), LeaveType.PLANNED),
        ("Karan Malhotra", date(2026, 12, 17), date(2026, 12, 17), LeaveType.PLANNED),
        # Sole-resource employee with no leave (Planted case 9) - reserved for live demo
        # We'll leave one agent without leave
    ]

    for emp_name, start, end, ltype in leaves_data:
        if emp_name in employees:
            leave = Leave(
                employee_id=employees[emp_name],
                start_date=start,
                end_date=end,
                type=ltype,
                status=LeaveStatus.APPROVED,
            )
            db.add(leave)

    db.commit()


def seed_settings(db: Session) -> None:
    """Create default settings."""
    settings_data = [
        ("weekly_rest_days", 1),
        ("max_consecutive_days", 6),
        ("week_start", "MON"),
        (
            "solver_weights",
            {
                "short_total": 10000,
                "entries_changed": 50,
                "cover_assignments": 20,
                "pref_off_missed": 5,
                "fairness_spread": 15,
                "spare_coverage": 2,
            },
        ),
    ]

    for key, value in settings_data:
        setting = Setting(key=key, value=value)
        db.add(setting)

    db.commit()


def seed_demo_users(db: Session, employees: dict[str, UUID]) -> None:
    """Create demo users for Manager, Pod Lead, Employee."""
    # Note: In real setup, these would be created via Supabase Auth Admin API
    # Here we just create the app_user records (auth.users would be created separately)

    # Manager user (no employee_id)
    manager_user = AppUser(
        id=uuid4(),  # Would match auth.users.id
        email="manager@demo.com",
        role="MANAGER",
        employee_id=None,
    )
    db.add(manager_user)

    # Pod Lead user (linked to Meera Patel - Alpha lead)
    pod_lead_user = AppUser(
        id=uuid4(),
        email="podlead@demo.com",
        role="POD_LEAD",
        employee_id=employees.get("Meera Patel"),
    )
    db.add(pod_lead_user)

    # Employee user (linked to a sole-resource agent - first agent)
    agent_names = [
        k
        for k in employees.keys()
        if k
        not in [
            "Meera Patel",
            "Rohan Singh",
            "Sana Khan",
            "Arjun Reddy",
            "Priya Sharma",
            "Float One",
            "Float Two",
        ]
    ]
    demo_employee_name = agent_names[0] if agent_names else "Amit Kumar"
    employee_user = AppUser(
        id=uuid4(),
        email="employee@demo.com",
        role="EMPLOYEE",
        employee_id=employees.get(demo_employee_name),
    )
    db.add(employee_user)

    db.commit()


def main() -> None:
    """Main seed function."""
    print("Starting seed...")

    with Session(engine) as db:
        print("Clearing existing data...")
        clear_all_data(db)

        print("Seeding pods...")
        pod_ids = seed_pods(db)

        print("Seeding employees...")
        employees = seed_employees(db, pod_ids)

        print("Seeding brands and processes...")
        brands, processes = seed_brands_and_processes(db)

        print("Seeding assignments...")
        seed_assignments(db, employees, processes)

        print("Seeding holidays...")
        seed_holidays(db, brands)

        print("Seeding leaves...")
        seed_leaves(db, employees)

        print("Seeding settings...")
        seed_settings(db)

        print("Seeding demo users...")
        seed_demo_users(db, employees)

        print("Seed completed successfully!")

        # Print summary
        print("\nSummary:")
        print(f"  Pods: {db.query(Pod).count()}")
        print(f"  Employees: {db.query(Employee).count()}")
        print(f"  Brands: {db.query(Brand).count()}")
        print(f"  Processes: {db.query(Process).count()}")
        print(f"  Assignments: {db.query(Assignment).count()}")
        print(f"  Holidays: {db.query(Holiday).count()}")
        print(f"  Leaves: {db.query(Leave).count()}")
        print(f"  App Users: {db.query(AppUser).count()}")


if __name__ == "__main__":
    main()
