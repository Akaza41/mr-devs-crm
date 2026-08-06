-- =============================================================================
-- PHASE 3C: MULTI-CHANNEL FOLLOW-UP SEQUENCING SCHEMA MIGRATION
-- =============================================================================

-- 1. OUTREACH TOUCHES TABLE
CREATE TABLE IF NOT EXISTS public.outreach_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel TEXT CHECK (channel IN ('call', 'gmail', 'linkedin', 'instagram', 'whatsapp', 'other')),
  sequence_number INTEGER NOT NULL,
  outcome TEXT CHECK (outcome IN ('no_answer', 'answered', 'replied', 'not_interested', 'voicemail')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_outreach_touches_lead_id ON public.outreach_touches(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_touches_user_id ON public.outreach_touches(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_touches_created_at ON public.outreach_touches(created_at DESC);

-- Trigger to auto-increment sequence_number per lead
CREATE OR REPLACE FUNCTION public.set_outreach_touch_sequence_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence_number IS NULL OR NEW.sequence_number <= 0 THEN
    NEW.sequence_number := (
      SELECT COALESCE(COUNT(*), 0) + 1 
      FROM public.outreach_touches 
      WHERE lead_id = NEW.lead_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_outreach_touch_sequence_number ON public.outreach_touches;
CREATE TRIGGER trigger_set_outreach_touch_sequence_number
  BEFORE INSERT ON public.outreach_touches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_outreach_touch_sequence_number();

-- Enable RLS on outreach_touches
ALTER TABLE public.outreach_touches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select outreach touches" ON public.outreach_touches;
CREATE POLICY "Authenticated users can select outreach touches"
  ON public.outreach_touches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert outreach touches" ON public.outreach_touches;
CREATE POLICY "Authenticated users can insert outreach touches"
  ON public.outreach_touches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. EXTEND LEADS TABLE WITH NEXT_FOLLOWUP_DUE
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS next_followup_due TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_leads_next_followup_due ON public.leads(next_followup_due);

-- 3. EXTEND PROJECTS TABLE WITH DEFAULT_CHANNELS
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS default_channels TEXT[] DEFAULT ARRAY['call', 'gmail', 'linkedin'];

-- 4. CADENCE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.cadence_settings (
  id INT PRIMARY KEY DEFAULT 1,
  no_answer_days INT NOT NULL DEFAULT 2,
  voicemail_days INT NOT NULL DEFAULT 2,
  answered_days INT NOT NULL DEFAULT 4,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial row
INSERT INTO public.cadence_settings (id, no_answer_days, voicemail_days, answered_days)
VALUES (1, 2, 2, 4)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on cadence_settings
ALTER TABLE public.cadence_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select cadence settings" ON public.cadence_settings;
CREATE POLICY "Authenticated users can select cadence settings"
  ON public.cadence_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can update cadence settings" ON public.cadence_settings;
CREATE POLICY "Authenticated users can update cadence settings"
  ON public.cadence_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
