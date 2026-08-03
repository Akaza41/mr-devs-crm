-- =============================================================================
-- PHASE 3A: LEAD RESEARCH SCORING & SALES LEADERBOARD METRICS
-- =============================================================================

-- 1. ADD RESEARCH FIELDS TO LEADS TABLE
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS research_notes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS researched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS researched_at TIMESTAMP WITH TIME ZONE;

-- Index for fast research score & leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leads_research_score ON public.leads(research_score DESC);

-- 2. TRIGGER TO AUTOMATICALLY COMPUTE RESEARCH_SCORE (+25 PER VALID FIELD >15 CHARS)
CREATE OR REPLACE FUNCTION public.calc_lead_research_score()
RETURNS TRIGGER AS $$
DECLARE
  score INT := 0;
  notes JSONB;
  w TEXT;
  s TEXT;
  c TEXT;
  o TEXT;
BEGIN
  notes := COALESCE(NEW.research_notes, '{}'::jsonb);
  w := TRIM(COALESCE(notes->>'weaknesses', ''));
  s := TRIM(COALESCE(notes->>'strengths', ''));
  c := TRIM(COALESCE(notes->>'competitors', ''));
  o := TRIM(COALESCE(notes->>'opportunity', ''));

  IF length(w) >= 15 THEN score := score + 25; END IF;
  IF length(s) >= 15 THEN score := score + 25; END IF;
  IF length(c) >= 15 THEN score := score + 25; END IF;
  IF length(o) >= 15 THEN score := score + 25; END IF;

  NEW.research_score := score;

  -- Auto-update researched_at & researched_by if notes modified
  IF (OLD IS NULL OR OLD.research_notes IS DISTINCT FROM NEW.research_notes) THEN
    NEW.researched_at := NOW();
    IF auth.uid() IS NOT NULL THEN
      NEW.researched_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_calc_lead_research_score ON public.leads;
CREATE TRIGGER trigger_calc_lead_research_score
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_lead_research_score();

-- Backfill existing leads to trigger research_score computation
UPDATE public.leads SET research_score = 0 WHERE research_score IS NULL;

-- 3. EXTEND GET_TEAM_METRICS RPC FOR LEADERBOARD & INDIVIDUAL STATS
CREATE OR REPLACE FUNCTION public.get_team_metrics(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT,
  leads_assigned BIGINT,
  leads_contacted BIGINT,
  leads_converted BIGINT,
  conversion_rate NUMERIC,
  avg_research_score NUMERIC,
  total_actions BIGINT,
  last_active TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.role,
    COUNT(DISTINCT l.id)::BIGINT AS leads_assigned,
    COUNT(DISTINCT CASE WHEN l.contacted = 'Yes' OR l.stage IN ('Contacted', 'Interested', 'Converted', 'Lost') THEN l.id END)::BIGINT AS leads_contacted,
    COUNT(DISTINCT CASE WHEN l.stage = 'Converted' THEN l.id END)::BIGINT AS leads_converted,
    ROUND(
      COALESCE(
        (COUNT(DISTINCT CASE WHEN l.stage = 'Converted' THEN l.id END)::NUMERIC / 
         NULLIF(COUNT(DISTINCT CASE WHEN l.contacted = 'Yes' OR l.stage IN ('Contacted', 'Interested', 'Converted', 'Lost') THEN l.id END), 0)::NUMERIC) * 100, 
        0
      ), 
      1
    ) AS conversion_rate,
    ROUND(COALESCE(AVG(l.research_score), 0), 1) AS avg_research_score,
    COUNT(DISTINCT a.id)::BIGINT AS total_actions,
    MAX(a.created_at) AS last_active
  FROM public.profiles p
  LEFT JOIN public.leads l ON l.assigned_to = p.id
  LEFT JOIN public.activity_logs a ON a.user_id = p.id
  WHERE (p_user_id IS NULL OR p.id = p_user_id) AND p.status = 'active'
  GROUP BY p.id, p.full_name, p.email, p.avatar_url, p.role
  ORDER BY conversion_rate DESC, leads_converted DESC, avg_research_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
