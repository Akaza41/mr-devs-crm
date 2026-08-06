-- =============================================================================
-- MR.DEVS CRM: CONSOLIDATED MIGRATION (PHASE 3C, PHASE 4B, AND PHASE 5)
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/rojqcqxyspgfcnywkbxn/sql/new)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PHASE 4B: GROUP CHANNELS, @MENTIONS, AND UNREAD TRACKING
-- ─────────────────────────────────────────────────────────────────────────────

-- Extend chat_channels type to include 'group'
ALTER TABLE public.chat_channels 
  DROP CONSTRAINT IF EXISTS chat_channels_type_check;

ALTER TABLE public.chat_channels 
  ADD CONSTRAINT chat_channels_type_check 
  CHECK (type IN ('team', 'lead_thread', 'direct', 'group'));

-- Add mentioned_user_ids to chat_messages
ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_chat_messages_mentions 
  ON public.chat_messages USING GIN (mentioned_user_ids);

-- Add last_read_at to channel_members
ALTER TABLE public.channel_members 
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Function to fetch unread mentions
CREATE OR REPLACE FUNCTION public.get_unread_mentions(p_user_id UUID)
RETURNS TABLE (
  message_id UUID,
  channel_id UUID,
  channel_name TEXT,
  channel_type TEXT,
  sender_id UUID,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS message_id,
    m.channel_id,
    c.name AS channel_name,
    c.type AS channel_type,
    m.sender_id,
    COALESCE(p.full_name, p.email) AS sender_name,
    p.avatar_url AS sender_avatar,
    m.content,
    m.created_at
  FROM public.chat_messages m
  JOIN public.chat_channels c ON c.id = m.channel_id
  JOIN public.profiles p ON p.id = m.sender_id
  LEFT JOIN public.channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = p_user_id
  WHERE p_user_id = ANY(m.mentioned_user_ids)
    AND m.sender_id != p_user_id
    AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PHASE 3C: MULTI-CHANNEL OUTREACH TOUCHES, CADENCE SETTINGS & SEQUENCING
-- ─────────────────────────────────────────────────────────────────────────────

-- Create outreach_touches table
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

-- Indexes for outreach_touches
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

-- Extend leads table with next_followup_due
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS next_followup_due TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_leads_next_followup_due ON public.leads(next_followup_due);

-- Extend projects table with default_channels
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS default_channels TEXT[] DEFAULT ARRAY['call', 'gmail', 'linkedin'];

-- Create cadence_settings table
CREATE TABLE IF NOT EXISTS public.cadence_settings (
  id INT PRIMARY KEY DEFAULT 1,
  no_answer_days INT NOT NULL DEFAULT 2,
  voicemail_days INT NOT NULL DEFAULT 2,
  answered_days INT NOT NULL DEFAULT 4,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial cadence_settings row
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PHASE 5: OUTREACH EVENTS RLS & AUTO-TOUCH TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on outreach_events
ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select outreach events" ON public.outreach_events;
CREATE POLICY "Authenticated users can select outreach events"
  ON public.outreach_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert outreach events" ON public.outreach_events;
CREATE POLICY "Authenticated users can insert outreach events"
  ON public.outreach_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Auto-create outreach_touches row when extension logs a matched event
CREATE OR REPLACE FUNCTION public.auto_create_touch_from_outreach_event()
RETURNS TRIGGER AS $$
DECLARE
  v_subject TEXT;
  v_next_due TIMESTAMP WITH TIME ZONE;
  v_answered_days INT := 4;
BEGIN
  SELECT COALESCE(answered_days, 4) INTO v_answered_days
  FROM public.cadence_settings WHERE id = 1;

  v_next_due := NOW() + (v_answered_days || ' days')::INTERVAL;

  IF NEW.lead_id IS NOT NULL AND NEW.event_type = 'message_sent' THEN
    v_subject := TRIM(COALESCE(NEW.payload->>'subject_line', 'No subject'));

    INSERT INTO public.outreach_touches (
      lead_id,
      user_id,
      channel,
      sequence_number,
      outcome,
      notes,
      created_at
    ) VALUES (
      NEW.lead_id,
      NEW.user_id,
      NEW.channel,
      0,
      'answered',
      '[Auto-detected via Extension] Subject: ' || v_subject,
      NEW.created_at
    );

    UPDATE public.leads
    SET 
      contacted = 'Yes',
      next_followup_due = v_next_due,
      updated_at = NOW()
    WHERE id = NEW.lead_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_create_touch_from_outreach_event ON public.outreach_events;
CREATE TRIGGER trigger_auto_create_touch_from_outreach_event
  AFTER INSERT ON public.outreach_events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_touch_from_outreach_event();
