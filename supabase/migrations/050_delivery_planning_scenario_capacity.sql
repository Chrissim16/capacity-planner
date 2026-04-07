-- Persist Delivery Planning capacity workspace state inside scenarios so
-- baseline and named scenarios can diverge on the delivery canvas.
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS capacity_requests jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS capacity_assignments jsonb NOT NULL DEFAULT '[]';
