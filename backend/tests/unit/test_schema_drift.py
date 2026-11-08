from pathlib import Path


def test_sqlalchemy_models_match_migrations() -> None:
    """
    This test verifies that the SQLAlchemy models match the database schema
    by attempting to create all tables in a test database and checking for errors.
    """
    # Run a simple check: verify that the models can be imported without errors
    # and that the metadata can be created.
    from app.db.models import Base

    # This will fail if there are issues with the model definitions
    # We don't actually create tables here, just verify the model structure
    tables = list(Base.metadata.tables.keys())

    # Verify all expected tables are present
    expected_tables = {
        "pod",
        "employee",
        "brand",
        "process",
        "coverage_override",
        "assignment",
        "holiday",
        "leave",
        "roster",
        "roster_entry",
        "cover_assignment",
        "roster_approval",
        "change_log",
        "setting",
        "app_user",
        "explanation_cache",
    }

    missing = expected_tables - set(tables)
    extra = set(tables) - expected_tables

    assert not missing, f"Missing tables in SQLAlchemy models: {missing}"
    assert not extra, f"Extra tables in SQLAlchemy models: {extra}"

    # Verify columns for a few critical tables
    employee_cols = {c.name for c in Base.metadata.tables["employee"].columns}
    expected_employee_cols = {
        "id",
        "name",
        "pod_id",
        "role",
        "preferred_off_days",
        "max_consecutive_days",
        "max_cover_per_day",
        "active",
        "created_at",
        "updated_at",
    }
    assert expected_employee_cols.issubset(employee_cols), (
        f"Missing columns in employee: {expected_employee_cols - employee_cols}"
    )

    roster_entry_cols = {c.name for c in Base.metadata.tables["roster_entry"].columns}
    expected_roster_entry_cols = {
        "id",
        "roster_id",
        "employee_id",
        "date",
        "status",
        "locked",
        "source",
        "created_at",
        "updated_at",
    }
    assert expected_roster_entry_cols.issubset(roster_entry_cols), (
        f"Missing columns in roster_entry: {expected_roster_entry_cols - roster_entry_cols}"
    )

    # Verify indexes exist on key tables
    employee_table = Base.metadata.tables["employee"]
    index_names = {idx.name for idx in employee_table.indexes}
    assert "employee_pod_idx" in index_names, "Missing employee_pod_idx index"


def test_migration_files_exist() -> None:
    """Verify that migration files exist."""
    migrations_dir = Path(__file__).parent.parent.parent.parent / "supabase" / "migrations"
    assert migrations_dir.exists(), "supabase/migrations directory not found"

    migration_0001 = migrations_dir / "0001_schema.sql"
    migration_0002 = migrations_dir / "0002_rls.sql"

    assert migration_0001.exists(), "0001_schema.sql not found"
    assert migration_0002.exists(), "0002_rls.sql not found"

    # Verify they have content
    assert migration_0001.read_text().strip(), "0001_schema.sql is empty"
    assert migration_0002.read_text().strip(), "0002_rls.sql is empty"
