-- =============================================================================
-- PHASE 3B: DETAILED PROFILES & EXPANDED INVITE FLOW
-- =============================================================================

-- 1. ADD EXTENDED PROFILE COLUMNS TO PROFILES TABLE
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;

-- Backfill join_date from created_at
UPDATE public.profiles 
  SET join_date = created_at::date 
  WHERE join_date IS NULL AND created_at IS NOT NULL;

-- 2. ADD TITLE & SPECIALTIES TO PENDING_INVITES TABLE
ALTER TABLE public.pending_invites 
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}'::text[];

-- 3. UPDATE HANDLE_NEW_USER TRIGGER TO COPY INVITE TITLE & SPECIALTIES TO PROFILE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  inv_role TEXT;
  inv_title TEXT;
  inv_specs TEXT[];
BEGIN
  -- Look up matching pending invite by email
  SELECT role, title, specialties INTO inv_role, inv_title, inv_specs
  FROM public.pending_invites 
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    avatar_url, 
    role, 
    title, 
    specialties, 
    status, 
    join_date
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(inv_role, 'viewer'),
    inv_title,
    COALESCE(inv_specs, '{}'::text[]),
    'active',
    CURRENT_DATE
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    title = COALESCE(EXCLUDED.title, profiles.title),
    specialties = CASE WHEN array_length(EXCLUDED.specialties, 1) > 0 THEN EXCLUDED.specialties ELSE profiles.specialties END;

  -- Delete consumed pending invite
  IF inv_role IS NOT NULL THEN
    DELETE FROM public.pending_invites WHERE LOWER(email) = LOWER(NEW.email);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
