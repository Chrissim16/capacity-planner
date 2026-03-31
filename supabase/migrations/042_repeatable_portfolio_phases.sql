-- 042: Allow multiple instances of the same portfolio phase per epic.

ALTER TABLE epic_phase_plans
  ADD COLUMN IF NOT EXISTS phase_instance_id text,
  ADD COLUMN IF NOT EXISTS phase_order integer;

UPDATE epic_phase_plans
SET
  phase_instance_id = COALESCE(phase_instance_id, phase),
  phase_order = COALESCE(phase_order, 0)
WHERE phase_instance_id IS NULL OR phase_order IS NULL;

ALTER TABLE epic_phase_plans
  ALTER COLUMN phase_instance_id SET NOT NULL,
  ALTER COLUMN phase_order SET NOT NULL;

ALTER TABLE epic_phase_assignments
  ADD COLUMN IF NOT EXISTS phase_instance_id text;

UPDATE epic_phase_assignments
SET phase_instance_id = COALESCE(phase_instance_id, phase)
WHERE phase_instance_id IS NULL;

ALTER TABLE epic_phase_assignments
  ALTER COLUMN phase_instance_id SET NOT NULL;

ALTER TABLE epic_phase_plans
  DROP CONSTRAINT IF EXISTS epic_phase_plans_epic_key_phase_key;

ALTER TABLE epic_phase_assignments
  DROP CONSTRAINT IF EXISTS epic_phase_assignments_epic_key_phase_member_id_key;

ALTER TABLE epic_phase_plans
  ADD CONSTRAINT epic_phase_plans_epic_key_phase_instance_id_key UNIQUE (epic_key, phase_instance_id);

ALTER TABLE epic_phase_assignments
  ADD CONSTRAINT epic_phase_assignments_epic_key_phase_instance_member_key UNIQUE (epic_key, phase_instance_id, member_id);

CREATE INDEX IF NOT EXISTS epic_phase_plans_epic_key_phase_order_idx
  ON epic_phase_plans (epic_key, phase, phase_order);

