-- =============================================================================
-- PHASE 5: OUTREACH EVENTS RLS & AUTO-TOUCH CREATION TRIGGER
-- =============================================================================

-- 1. ENABLE RLS AND SET POLICIES FOR OUTREACH_EVENTS
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

-- 2. TRIGGER TO AUTO-CREATE OUTREACH_TOUCHES ROW WHEN EXTENSION LOGS A MATCHED EVENT
CREATE OR REPLACE FUNCTION public.auto_create_touch_from_outreach_event()
RETURNS TRIGGER AS $$
DECLARE
  v_subject TEXT;
  v_next_due TIMESTAMP WITH TIME ZONE;
  v_answered_days INT := 4;
BEGIN
  -- Fetch cadence settings if available
  SELECT COALESCE(answered_days, 4) INTO v_answered_days
  FROM public.cadence_settings WHERE id = 1;

  v_next_due := NOW() + (v_answered_days || ' days')::INTERVAL;

  -- Only bridge if event has a lead_id and event_type is message_sent
  IF NEW.lead_id IS NOT NULL AND NEW.event_type = 'message_sent' THEN
    v_subject := TRIM(COALESCE(NEW.payload->>'subject_line', 'No subject'));

    -- Insert into outreach_touches (sequence_number auto-computed by its trigger)
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
      0, -- trigger will auto-set to count + 1
      'answered',
      '[Auto-detected via Extension] Subject: ' || v_subject,
      NEW.created_at
    );

    -- Update lead record's next_followup_due and contacted stage
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
