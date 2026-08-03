-- =============================================================================
-- FIX CHAT RLS RECURSION (CHAT CHANNELS, MEMBERS, AND MESSAGES)
-- =============================================================================

-- 1. CHAT CHANNELS RLS (Fix infinite recursion between chat_channels and channel_members)
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read chat channels" ON public.chat_channels;
CREATE POLICY "Read chat channels" ON public.chat_channels
  FOR SELECT USING (
    is_active_user(auth.uid())
  );

DROP POLICY IF EXISTS "Insert chat channels" ON public.chat_channels;
CREATE POLICY "Insert chat channels" ON public.chat_channels
  FOR INSERT WITH CHECK (
    is_active_user(auth.uid())
  );

-- 2. CHANNEL MEMBERS RLS (Fix infinite recursion by removing self-referencing EXISTS)
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read channel members" ON public.channel_members;
CREATE POLICY "Read channel members" ON public.channel_members
  FOR SELECT USING (
    is_active_user(auth.uid())
  );

DROP POLICY IF EXISTS "Insert channel members" ON public.channel_members;
CREATE POLICY "Insert channel members" ON public.channel_members
  FOR INSERT WITH CHECK (
    is_active_user(auth.uid())
  );

-- 3. CHAT MESSAGES RLS (Direct active user check for fast & reliable inserts/selects)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read chat messages" ON public.chat_messages;
CREATE POLICY "Read chat messages" ON public.chat_messages
  FOR SELECT USING (
    is_active_user(auth.uid())
  );

DROP POLICY IF EXISTS "Insert chat messages" ON public.chat_messages;
CREATE POLICY "Insert chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    is_active_user(auth.uid()) AND
    sender_id = auth.uid()
  );

-- Ensure global #general channel exists
INSERT INTO public.chat_channels (name, type)
SELECT 'general', 'team'
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_channels WHERE name = 'general' AND type = 'team'
);
