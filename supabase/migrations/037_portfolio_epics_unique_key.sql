-- Migration 037: Add unique constraint on portfolio_epics.epic_key
-- Required so we can upsert by epic_key when saving board membership.

ALTER TABLE portfolio_epics
  ADD CONSTRAINT portfolio_epics_epic_key_unique UNIQUE (epic_key);
