-- 035_portfolio_planning.sql
-- Portfolio Planning: phase-level effort planning per Epic.
-- boardEpicKeys are stored in localStorage (v1); these tables hold the
-- planning data that must survive across sessions and be shared across users.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists portfolio_epics (
  id         uuid primary key default gen_random_uuid(),
  epic_key   text not null,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists epic_phase_plans (
  id         uuid primary key default gen_random_uuid(),
  epic_key   text not null,
  phase      text not null check (phase in ('design','build','test','deploy','hypercare')),
  start_day  integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (epic_key, phase)
);

create table if not exists epic_phase_assignments (
  id         uuid primary key default gen_random_uuid(),
  epic_key   text not null,
  phase      text not null check (phase in ('design','build','test','deploy','hypercare')),
  member_id  text not null,
  track      text not null check (track in ('IT','BIZ')),
  days       numeric(6,1) not null check (days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (epic_key, phase, member_id)
);

-- ── updated_at triggers ────────────────────────────────────────────────────────
-- Function may already exist from prior migrations; OR REPLACE is safe.

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolio_epics_updated_at        on portfolio_epics;
drop trigger if exists epic_phase_plans_updated_at       on epic_phase_plans;
drop trigger if exists epic_phase_assignments_updated_at on epic_phase_assignments;

create trigger portfolio_epics_updated_at
  before update on portfolio_epics
  for each row execute function update_updated_at_column();

create trigger epic_phase_plans_updated_at
  before update on epic_phase_plans
  for each row execute function update_updated_at_column();

create trigger epic_phase_assignments_updated_at
  before update on epic_phase_assignments
  for each row execute function update_updated_at_column();

-- ── Row Level Security ─────────────────────────────────────────────────────────

alter table portfolio_epics        enable row level security;
alter table epic_phase_plans       enable row level security;
alter table epic_phase_assignments enable row level security;

create policy "Authenticated users only" on portfolio_epics
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users only" on epic_phase_plans
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users only" on epic_phase_assignments
  for all using (auth.role() = 'authenticated');
