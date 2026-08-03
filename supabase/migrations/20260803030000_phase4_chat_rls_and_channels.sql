-- =============================================================================
-- PHASE 4: REALTIME TEAM CHAT (RLS POLICIES, GLOBAL #GENERAL CHANNEL & TRIGGERS)
-- =============================================================================

-- 1. CHAT CHANNELS RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read chat channels" ON public.chat_channels;
CREATE POLICY "Read chat channels" ON public.chat_channels
  FOR SELECT USING (
    is_active_user(auth.uid()) AND (
      is_admin_or_manager(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE channel_members.channel_id = chat_channels.id
        AND channel_members.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Insert chat channels" ON public.chat_channels;
CREATE POLICY "Insert chat channels" ON public.chat_channels
  FOR INSERT WITH CHECK (
    is_active_user(auth.uid())
  );

-- 2. CHANNEL MEMBERS RLS
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read channel members" ON public.channel_members;
CREATE POLICY "Read channel members" ON public.channel_members
  FOR SELECT USING (
    is_active_user(auth.uid()) AND (
      is_admin_or_manager(auth.uid()) OR
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Insert channel members" ON public.channel_members;
CREATE POLICY "Insert channel members" ON public.channel_members
  FOR INSERT WITH CHECK (
    is_active_user(auth.uid())
  );

-- 3. CHAT MESSAGES RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read chat messages" ON public.chat_messages;
CREATE POLICY "Read chat messages" ON public.chat_messages
  FOR SELECT USING (
    is_active_user(auth.uid()) AND (
      is_admin_or_manager(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE channel_members.channel_id = chat_messages.channel_id
        AND channel_members.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Insert chat messages" ON public.chat_messages;
CREATE POLICY "Insert chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    is_active_user(auth.uid()) AND
    sender_id = auth.uid() AND (
      is_admin_or_manager(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.channel_members
        WHERE channel_members.channel_id = chat_messages.channel_id
        AND channel_members.user_id = auth.uid()
      )
    )
  );

-- 4. ENSURE DEFAULT GLOBAL #GENERAL CHANNEL EXISTS
INSERT INTO public.chat_channels (name, type)
SELECT 'general', 'team'
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_channels WHERE name = 'general' AND type = 'team'
);

-- BACKFILL ALL EXISTING PROFILES INTO #GENERAL CHANNEL
INSERT INTO public.channel_members (channel_id, user_id)
SELECT c.id, p.id
FROM public.chat_channels c
CROSS JOIN public.profiles p
WHERE c.name = 'general' AND c.type = 'team'
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- 5. UPDATE HANDLE_NEW_USER TRIGGER TO AUTO-ADD USERS TO #GENERAL CHANNEL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  gen_channel_id UUID;
  matching_invite RECORD;
BEGIN
  -- Check if profile already exists for this user ID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- 1. Check if email is owner
  IF LOWER(NEW.email) = 'mubeenahma1123@gmail.com' THEN
    assigned_role := 'admin';
  ELSE
    -- 2. Check pending_invites table for matching email
    SELECT * INTO matching_invite 
    FROM public.pending_invites 
    WHERE LOWER(email) = LOWER(NEW.email);

    IF FOUND THEN
      assigned_role := matching_invite.role;
      -- Delete claimed invite
      DELETE FROM public.pending_invites WHERE email = matching_invite.email;
    ELSE
      -- Uninvited signup: skip profile creation silently
      RETURN NEW;
    END IF;
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    assigned_role,
    'active'
  );

  -- Add new user to #general team channel automatically
  SELECT id INTO gen_channel_id 
  FROM public.chat_channels 
  WHERE name = 'general' AND type = 'team' 
  LIMIT 1;

  IF gen_channel_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (gen_channel_id, NEW.id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
