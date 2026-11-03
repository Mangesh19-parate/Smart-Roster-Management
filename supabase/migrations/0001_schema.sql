create type employee_role   as enum ('AGENT','LEAD','FLOATER');
create type calendar_mode   as enum ('ALL_365','EXCL_PH','EXCL_SUN_PH');
create type assignment_type as enum ('PRIMARY','BACKUP');
create type holiday_scope   as enum ('COMPANY','BRAND');
create type leave_type      as enum ('PLANNED','COMP_OFF','SICK');
create type leave_status    as enum ('APPROVED','PENDING','REJECTED');
create type roster_status   as enum ('DRAFT','IN_REVIEW','PUBLISHED');
create type day_status      as enum ('WORK','WO','PH','LEAVE','COMP_OFF');
create type entry_source    as enum ('GENERATED','MANUAL','SUGGESTION');
create type user_role       as enum ('MANAGER','POD_LEAD','EMPLOYEE');
create type approval_status as enum ('PENDING','APPROVED','CHANGES_REQUESTED');

create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table pod (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lead_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table employee (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pod_id uuid not null references pod(id),
  role employee_role not null default 'AGENT',
  preferred_off_days smallint[] not null default '{}',
  max_consecutive_days smallint not null default 6 check (max_consecutive_days between 1 and 14),
  max_cover_per_day smallint not null default 2 check (max_cover_per_day >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table pod add constraint pod_lead_fk
  foreign key (lead_employee_id) references employee(id) deferrable initially deferred;
create index employee_pod_idx on employee(pod_id);

create table brand (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table process (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brand(id) on delete cascade,
  name text not null,
  calendar_mode calendar_mode not null,
  min_coverage smallint not null default 1 check (min_coverage >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);
create index process_brand_idx on process(brand_id);

create table coverage_override (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references process(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  date date,
  min_coverage smallint not null check (min_coverage >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((weekday is not null) <> (date is not null))
);
create index override_process_idx on coverage_override(process_id);

create table assignment (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employee(id) on delete cascade,
  process_id uuid not null references process(id) on delete cascade,
  type assignment_type not null default 'PRIMARY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, process_id)
);
create index assignment_process_idx on assignment(process_id);

create table holiday (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  scope holiday_scope not null default 'COMPANY',
  brand_id uuid references brand(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'BRAND') = (brand_id is not null)),
  unique nulls not distinct (date, scope, brand_id)
);

create table leave (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employee(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type leave_type not null,
  status leave_status not null default 'APPROVED',
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_employee_idx on leave(employee_id, start_date, end_date);

create table roster (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status roster_status not null default 'DRAFT',
  generated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roster_entry (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references roster(id) on delete cascade,
  employee_id uuid not null references employee(id) on delete cascade,
  date date not null,
  status day_status not null,
  locked boolean not null default false,
  source entry_source not null default 'GENERATED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_id, employee_id, date)
);
create index entry_roster_date_idx on roster_entry(roster_id, date);
create index entry_employee_idx on roster_entry(employee_id);

create table cover_assignment (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references roster(id) on delete cascade,
  employee_id uuid not null references employee(id) on delete cascade,
  process_id uuid not null references process(id) on delete cascade,
  date date not null,
  source entry_source not null default 'GENERATED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_id, employee_id, process_id, date)
);

create table roster_approval (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references roster(id) on delete cascade,
  pod_id uuid not null references pod(id) on delete cascade,
  status approval_status not null default 'PENDING',
  comment text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_id, pod_id)
);

create table change_log (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references roster(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  before jsonb,
  after jsonb,
  reason text,
  published_change boolean not null default false,
  created_at timestamptz not null default now()
);
create index change_log_roster_idx on change_log(roster_id, created_at desc);

create table setting (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role user_role not null,
  employee_id uuid references employee(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role = 'MANAGER' or employee_id is not null)
);

create table explanation_cache (
  issue_hash text primary key,
  text text not null,
  source text not null check (source in ('ai','template')),
  created_at timestamptz not null default now()
);

-- updated_at triggers on every table that has the column
do $$ declare t text; begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'updated_at' loop
    execute format('create trigger trg_%s_updated before update on %I
                    for each row execute function set_updated_at()', t, t);
  end loop;
end $$;