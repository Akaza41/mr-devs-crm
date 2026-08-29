-- =============================================================================
-- MR.DEVS CRM: BUSINESS CONTEXT & LEAD FIELDS MIGRATION
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pain_point TEXT,
  ADD COLUMN IF NOT EXISTS current_solution TEXT,
  ADD COLUMN IF NOT EXISTS decision_maker TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_decision_maker ON public.leads(decision_maker);
