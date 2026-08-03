-- =============================================================================
-- PHASE 2C: USER DEACTIVATION (STATUS COLUMN), IS_ACTIVE_USER HELPER & RLS
-- =============================================================================

-- 1. ADD STATUS COLUMN TO PROFILES TABLE
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'suspended')) DEFAULT 'active';

-- Backfill null status to active
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;

-- 2. HELPER FUNCTION TO CHECK IF USER IS ACTIVE
CREATE OR REPLACE FUNCTION is_active_user(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. RLS UPDATE POLICIES FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id AND is_active_user(auth.uid()))
  WITH CHECK (auth.uid() = id AND is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (is_admin_or_manager(auth.uid()) AND is_active_user(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()) AND is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Profiles read policy" ON public.profiles;
CREATE POLICY "Profiles read policy" ON public.profiles
  FOR SELECT
  USING (is_active_user(auth.uid()));

-- 4. UPDATE LEADS RLS POLICY WITH IS_ACTIVE_USER CHECK
DROP POLICY IF EXISTS "Leads access policy" ON public.leads;
CREATE POLICY "Leads access policy" ON public.leads
  FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      is_admin_or_manager(auth.uid()) OR
      assigned_to = auth.uid() OR
      created_by = auth.uid() OR
      assigned_to IS NULL
    )
  );

-- 5. UPDATE CHAT MESSAGES RLS POLICY WITH IS_ACTIVE_USER CHECK
DROP POLICY IF EXISTS "Read chat messages" ON public.chat_messages;
CREATE POLICY "Read chat messages" ON public.chat_messages
  FOR SELECT USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Insert chat messages" ON public.chat_messages;
CREATE POLICY "Insert chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (is_active_user(auth.uid()) AND sender_id = auth.uid());

-- 6. UPDATE OUTREACH EVENTS RLS POLICY WITH IS_ACTIVE_USER CHECK
DROP POLICY IF EXISTS "Outreach events policy" ON public.outreach_events;
CREATE POLICY "Outreach events policy" ON public.outreach_events
  FOR ALL USING (
    is_active_user(auth.uid()) AND (
      is_admin_or_manager(auth.uid()) OR user_id = auth.uid()
    )
  );

-- 7. UPDATE PENDING INVITES RLS POLICY WITH IS_ACTIVE_USER CHECK
DROP POLICY IF EXISTS "Pending invites admin/manager policy" ON public.pending_invites;
CREATE POLICY "Pending invites admin/manager policy" ON public.pending_invites
  FOR ALL
  USING (is_active_user(auth.uid()) AND is_admin_or_manager(auth.uid()))
  WITH CHECK (is_active_user(auth.uid()) AND is_admin_or_manager(auth.uid()));
