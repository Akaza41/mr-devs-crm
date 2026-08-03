-- =============================================================================
-- PHASE 2A: PENDING INVITES TABLE & UPDATED HANDLE_NEW_USER TRIGGER
-- =============================================================================

-- 1. CREATE PENDING_INVITES TABLE
CREATE TABLE IF NOT EXISTS public.pending_invites (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'sales', 'lead generator', 'employee', 'viewer')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for case-insensitive lookup
CREATE INDEX IF NOT EXISTS idx_pending_invites_lower_email ON public.pending_invites (LOWER(email));

-- 2. ENABLE ROW-LEVEL SECURITY (RLS) FOR PENDING_INVITES
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pending invites admin/manager policy" ON public.pending_invites;
CREATE POLICY "Pending invites admin/manager policy" ON public.pending_invites
  FOR ALL
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- 3. REWRITE HANDLE_NEW_USER() TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_invite_role TEXT;
BEGIN
  -- Normalize email: lowercase and trimmed
  v_email := LOWER(TRIM(NEW.email));

  -- 1. OWNER ADMIN BOOTSTRAP: mubeenahma1123@gmail.com is always Admin
  IF v_email = 'mubeenahma1123@gmail.com' THEN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
      NEW.id,
      v_email,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(v_email, '@', 1)
      ),
      NEW.raw_user_meta_data->>'avatar_url',
      'admin'
    )
    ON CONFLICT (id) DO UPDATE
      SET role = 'admin',
          email = EXCLUDED.email;

    RETURN NEW;
  END IF;

  -- 2. CHECK PENDING INVITES FOR MATCHING EMAIL
  SELECT role INTO v_invite_role
  FROM public.pending_invites
  WHERE LOWER(TRIM(email)) = v_email;

  IF v_invite_role IS NOT NULL THEN
    -- Insert profile with the assigned invited role
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
      NEW.id,
      v_email,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(v_email, '@', 1)
      ),
      NEW.raw_user_meta_data->>'avatar_url',
      v_invite_role
    )
    ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          email = EXCLUDED.email;

    -- Delete the consumed invite from pending_invites
    DELETE FROM public.pending_invites
    WHERE LOWER(TRIM(email)) = v_email;

    RETURN NEW;
  END IF;

  -- 3. UNAUTHORIZED SIGN-UP: Skip profile creation silently
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
