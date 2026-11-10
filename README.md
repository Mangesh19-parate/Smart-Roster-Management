# Smart Roster Management System

A web app for operations managers to plan, generate, validate and change monthly rosters across brands, processes and pods. Built for the Datastraw internship assessment.

The roster is produced by an optimiser (OR-Tools CP-SAT) and judged by a separate, independent validator. Generation, manual edits, regeneration and suggestions all pass through the same validation, so an invalid roster cannot be produced silently.

Live demo: `<ADD URL>` (use the "Continue as Manager / Pod Lead / Employee" buttons) | Demo video: `<ADD LINK>`

## Features

- Employees, pods, pod leads, brands, processes and assignments, all editable in the UI
- Per-process operating calendars: 365 days, every day except public holidays, or Sundays and public holidays off, with weekday and date coverage overrides
- Leaves, comp-offs, company and brand holidays, weekly-off preferences
- Optimised monthly generation: coverage is a penalised slack, so impossible brands produce a flagged gap instead of an error
- Validator with mandatory errors and preference warnings, each with a cause and a suggested action
- Structural report for brands that no schedule can staff (for example 365 days, one person, no backup)
- Company, pod, brand, process and employee views on one grid, with a coverage strip
- Live edit validation, locking, and a change log
- Change handling: add leave, preview the impact, apply a ranked and pre-validated suggestion
- Fairness of Sunday and holiday work, preference-based scheduling
- Automatic regeneration after a change in minimal-change mode with a before/after diff
- CSV and Excel export
- Supabase Auth with Manager, Pod Lead and Employee roles
- Optional: pod approval and publish workflow, AI-written conflict explanations

## Tech stack

React, Vite, TypeScript, Tailwind, TanStack Query | Python 3.12, FastAPI, SQLAlchemy, OR-Tools CP-SAT | Supabase (Postgres and Auth) | pytest, Hypothesis, Vitest, Playwright | GitHub Actions | Vercel, Render.

## Setup (about 10 minutes)

Prerequisites: Python 3.12, Node 20+, a free Supabase project, Supabase CLI.

```bash
git clone <repo-url> roster-app && cd roster-app

# database
supabase link --project-ref <ref>
supabase db push

# backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp ../.env.example .env            # fill in the backend values
python -m seed.seed                # 37 employees, 23 brands, demo users
uvicorn app.main:app --reload --port 8000

# frontend (new terminal)
cd frontend
npm install
cp ../.env.example .env            # keep only the VITE_ values
npm run dev
```

Open http://localhost:5173, click "Continue as Manager", choose December 2026, click Generate.

Full runbook: [docs/SETUP.md](docs/SETUP.md).

## Environment variables (names only)

Backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `DEMO_MODE`, `DEMO_RESET_TOKEN`, `SOLVER_TIME_LIMIT_S`, `SOLVER_SEED`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_EXPLANATIONS_ENABLED`, `SEED_MONTH`.
Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_MODE`, `VITE_DEMO_PASSWORD`.

## Scripts

| Where | Command | Purpose |
|---|---|---|
| backend | `uvicorn app.main:app --reload` | Dev server (OpenAPI at `/docs`) |
| backend | `ruff check .`, `mypy --strict app` | Lint and types |
| backend | `pytest --cov=app/engine` | Tests with engine coverage |
| backend | `python -m seed.seed`, `python -m seed.verify_seed` | Seed and verify planted cases |
| frontend | `npm run dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e` | Dev, build, checks, tests |
| frontend | `npm run gen:api` | Regenerate TS types from OpenAPI |

## Folder guide

```
supabase/migrations/   SQL schema and RLS
backend/app/engine/    pure Python scheduling logic (no framework imports)
backend/app/api/       FastAPI routers
backend/app/services/  database plus engine glue
backend/seed/          deterministic seed and verification
frontend/src/          React app (grid, issues, pages, auth)
.github/workflows/     CI, keep-alive, daily demo reset
docs/                  product and engineering docs
```

## Docs

[PRD](docs/PRD.md) | [Design](docs/DESIGN.md) | [Architecture](docs/ARCHITECTURE.md) | [Database](docs/DATABASE.md) | [API](docs/API.md) | [Auth](docs/AUTH.md) | [Plan](docs/PLAN.md) | [Setup](docs/SETUP.md) | [Features](docs/FEATURES.md) | [MCP](docs/MCP.md) | [Integrations](docs/INTEGRATIONS.md) | [Testing](docs/TESTING.md) | [Debugging](docs/DEBUGGING.md) | [Agent rules](AGENTS.md)

## Assumptions

Listed in full in PRD section 0 (A1–A14). Key ones: Monday to Sunday weeks, at least one rest day per full week, at most six consecutive working days, backups count only through explicit cover assignments, working a public holiday earns a comp-off, preferences are soft and coverage is hard, and the solver may leave a gap rather than fail.

## Tell us how you think

> These are the planned answers. Re-read each one against the code after the build and edit whatever changed.

**1. How did you model employees, brands, processes, pods and their relationships?**
Brands own processes. Employees belong to one pod and connect to processes through an assignment marked PRIMARY or BACKUP. A process carries its calendar mode and minimum coverage, and overrides handle special days. This keeps a brand's operating calendar (demand) separate from an employee's daily status (supply); coverage is the comparison of the two. It is a relational schema with constraints in Postgres, so bad data is rejected at the database.

**2. How does the system generate a roster and decide whether it satisfies the constraints?**
It builds a demand grid, then CP-SAT assigns work and rest days. Rest days, consecutive-day limits, leave, closed days and locks are hard constraints. Coverage is slack in the objective, so the solver always returns the best roster it can. A separate validator, which shares no logic with the solver, then judges the result and produces the issue list. The validator, not the solver, decides whether a roster is valid, and a brute-force checker in the tests cross-checks it.

**3. How did you handle single-resource brands versus brands with multiple employees?**
Same model. A sole-resource brand is a process with one PRIMARY assignment, so any rest day creates a gap unless a backup covers it. Multi-employee brands gain flexibility because rest days can be staggered. The structural check treats the sole-resource case on a 365-day calendar specially, because it fails by construction without a backup.

**4. What happens when an employee who manages all processes for a brand is unavailable on a required day?**
The validator raises `COV_ZERO` for each affected process with the cause ("sole resource on approved leave, no backup"). The suggestions engine proposes ranked fixes: add cover from a backup or floater who is free that day, shift a nearby rest day, swap, or run a local re-solve. Each is applied to a copy and re-validated first, so the manager sees what it fixes and what it might break.

**5. How does the system handle conflicting requirements or insufficient staffing?**
Mandatory constraints are errors and preferences are warnings. When they conflict, coverage wins and the violated preference is reported. If no schedule can meet a requirement, the gap stays in the roster with a stated cause, and structural problems are listed separately so the manager knows scheduling cannot fix them and headcount or backup is needed.

**6. What did you automate and what stays under human control?**
Automated: demand calculation, rest-day placement, coverage checks, cover suggestions, impact preview, regeneration proposals. Human-controlled: applying a suggestion, locking, approving leave, accepting a regeneration, pod approval and publishing. A wrong roster affects people's lives, so the system proposes and the manager decides. An LLM is used only to explain issues, never to assign shifts.

**7. If the company doubled its team and brand count, what would you change?**
Run solves as background jobs with progress polling, decompose the model by pod, add an incremental validator (full validation is fine at this size), virtualise the grid, cache demand per process and month, and move the solver to its own service.

**8. With one more week, what would you improve first?**
Shift windows and per-person capacity, because those create the next class of real conflicts. Then carry-in from the previous month, a comparison of alternative plans, notifications for published changes, and fairness across months rather than within one.

## Known limitations

- Weeks cut by a month boundary have limited rest-day checking, with no carry-in from the previous month (A11).
- No shift timings; a day is a full working day.
- The demo has public logins and resets daily.
- The free backend can take up to about 50 seconds to wake after idle time.
- CP-SAT returns the best solution found within the time limit, which may not be provably optimal; the response reports its status.
