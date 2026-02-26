-- Add BAU reserve and process team assignments to business_contacts.

ALTER TABLE public.business_contacts
  ADD COLUMN IF NOT EXISTS bau_reserve_days  integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS process_team_ids  text[]  DEFAULT '{}';
