-- =============================================================================
-- MR.DEVS CRM: STRICT DATABASE-LEVEL RLS HARDENING MIGRATION
-- =============================================================================

-- Enable Row Level Security on leads and projects
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if caller is Admin or Manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check caller's exact role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = user_id), 'viewer');
$$ LANGUAGE sql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEADS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- DROP existing policies if any
DROP POLICY IF EXISTS "Leads access policy" ON public.leads;
DROP POLICY IF EXISTS "Leads SELECT policy" ON public.leads;
DROP POLICY IF EXISTS "Leads INSERT policy" ON public.leads;
DROP POLICY IF EXISTS "Leads UPDATE policy" ON public.leads;
DROP POLICY IF EXISTS "Leads DELETE policy" ON public.leads;

-- SELECT POLICY:
-- Admin/Manager: see all leads.
-- Lead Generator: see leads they created.
-- Sales Rep: see leads assigned to them, created by them, or unassigned leads.
-- Viewer: see all leads (read-only).
CREATE POLICY "Leads SELECT policy" ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    is_admin_or_manager(auth.uid()) OR
    get_user_role(auth.uid()) = 'viewer' OR
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    (get_user_role(auth.uid()) = 'sales' AND assigned_to IS NULL)
  );

-- INSERT POLICY:
-- Admin, Manager, Sales, Lead Generator can insert leads.
-- Viewers cannot insert.
CREATE POLICY "Leads INSERT policy" ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'manager', 'sales', 'lead generator')
  );

-- UPDATE POLICY:
-- Admin/Manager: update any lead.
-- Lead Generator: update leads created by them.
-- Sales Rep: update leads assigned to them or created by them.
CREATE POLICY "Leads UPDATE policy" ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_manager(auth.uid()) OR
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  )
  WITH CHECK (
    is_admin_or_manager(auth.uid()) OR
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  );

-- DELETE POLICY:
-- Only Admin and Manager can delete leads.
CREATE POLICY "Leads DELETE policy" ON public.leads
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_manager(auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROJECTS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Projects SELECT policy" ON public.projects;
DROP POLICY IF EXISTS "Projects ALL policy" ON public.projects;

CREATE POLICY "Projects SELECT policy" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Projects WRITE policy" ON public.projects
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Profiles SELECT policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles UPDATE policy" ON public.profiles;

CREATE POLICY "Profiles SELECT policy" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Profiles UPDATE policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin_or_manager(auth.uid()) OR id = auth.uid())
  WITH CHECK (is_admin_or_manager(auth.uid()) OR id = auth.uid());
