-- =============================================================================
-- MR.DEVS CRM: ROADMAP SCHEMA MIGRATION (PHASE 1 + ROADMAP FOUNDATION)
-- =============================================================================

-- 1. EXTEND PROFILES FOR OAUTH & METADATA
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure roles constraint covers all roadmap roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'sales', 'lead generator', 'employee', 'viewer'));

-- 2. EXTEND LEADS FOR SALES REP ASSIGNMENT, FLEXIBLE TITLES & JSONB CUSTOM FIELDS
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS lead_name TEXT, -- Universal lead title fallback (aliased to hospital_name)
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill lead_name from hospital_name if null
UPDATE leads SET lead_name = hospital_name WHERE lead_name IS NULL;

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

-- 3. TEAM CHAT TABLES (GLOBAL, PER-LEAD THREADS, & CHANNEL MEMBERS)
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('team', 'lead_thread', 'direct')) DEFAULT 'team',
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel members table (added for scoped chat participation in Phase 4)
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

-- 4. OUTREACH EVENTS TABLE (CHROME EXTENSION & INTEGRATIONS)
CREATE TABLE IF NOT EXISTS outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('gmail', 'linkedin', 'facebook', 'manual_call', 'other')),
  event_type TEXT NOT NULL CHECK (event_type IN ('message_sent', 'reply_received', 'email_opened', 'link_clicked', 'call_logged')),
  external_id TEXT, -- E.g. Gmail thread ID or LinkedIn message ID
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_lead_id ON outreach_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_user_id ON outreach_events(user_id);

-- 5. AUTOMATIC PROFILE CREATION TRIGGER FOR OAUTH & EMAIL SIGNUPS
-- Ensures new auth.users get a profile row without duplicating existing profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists for this user ID (prevents duplicates for existing users)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    'sales'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_events ENABLE ROW LEVEL SECURITY;

-- Helper function to check if caller is Admin/Manager
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policy: Leads
-- Admins/Managers see all leads; Sales reps see leads assigned to them or unassigned leads in their project.
DROP POLICY IF EXISTS "Leads access policy" ON leads;
CREATE POLICY "Leads access policy" ON leads
  FOR ALL
  USING (
    is_admin_or_manager(auth.uid()) OR
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    assigned_to IS NULL
  );

-- RLS Policy: Chat Messages
DROP POLICY IF EXISTS "Read chat messages" ON chat_messages;
CREATE POLICY "Read chat messages" ON chat_messages
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert chat messages" ON chat_messages;
CREATE POLICY "Insert chat messages" ON chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- RLS Policy: Outreach Events
DROP POLICY IF EXISTS "Outreach events policy" ON outreach_events;
CREATE POLICY "Outreach events policy" ON outreach_events
  FOR ALL USING (
    is_admin_or_manager(auth.uid()) OR user_id = auth.uid()
  );
