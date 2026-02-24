-- ============================================================
-- 011_business_contacts.sql
-- Business contact capacity tables
-- ============================================================

-- Business contacts (Finance Controllers, UAT leads, process owners, etc.)
CREATE TABLE IF NOT EXISTS public.business_contacts (
  id                    text        PRIMARY KEY,
  name                  text        NOT NULL,
  title                 text,
  department            text,
  email                 text,
  country_id            text        NOT NULL,      -- references countries(id) logic-level
  working_days_per_week integer     DEFAULT 5,
  working_hours_per_day integer     DEFAULT 8,
  project_ids           text[]      DEFAULT '{}',
  notes                 text,
  archived              boolean     DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Time off for business contacts (separate from IT team time_off)
CREATE TABLE IF NOT EXISTS public.business_time_off (
  id          text        PRIMARY KEY,
  contact_id  text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  type        text        NOT NULL DEFAULT 'holiday' CHECK (type IN ('holiday', 'other')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bto_contact ON public.business_time_off (contact_id);
CREATE INDEX IF NOT EXISTS idx_bto_dates   ON public.business_time_off (start_date, end_date);

-- Phase-level commitments for business contacts
CREATE TABLE IF NOT EXISTS public.business_assignments (
  id          text            PRIMARY KEY,
  contact_id  text            NOT NULL,
  project_id  text            NOT NULL,
  phase_id    text,                               -- NULL for project-level (no phases)
  quarter     text,                               -- "Q2 2026"; required when phase_id IS NULL
  days        numeric         NOT NULL CHECK (days >= 0),
  notes       text,
  created_at  timestamptz     NOT NULL DEFAULT now(),
  updated_at  timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ba_contact ON public.business_assignments (contact_id);
CREATE INDEX IF NOT EXISTS idx_ba_project ON public.business_assignments (project_id);
CREATE INDEX IF NOT EXISTS idx_ba_phase   ON public.business_assignments (phase_id) WHERE phase_id IS NOT NULL;

-- Row Level Security
ALTER TABLE public.business_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_time_off     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_assignments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage business_contacts"
  ON public.business_contacts FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage business_time_off"
  ON public.business_time_off FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage business_assignments"
  ON public.business_assignments FOR ALL
  USING (auth.role() = 'authenticated');
