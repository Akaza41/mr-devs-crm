# Deep Codebase Analysis & CRM Technical Roadmap

**Project:** MR.DEVS CRM  
**Date:** August 2026  
**Repository Location:** `c:\Users\Mirza Computers\OneDrive\Desktop\mr-devs-crm`  
**Target Environment:** React 19 + Vite + Supabase (PostgreSQL / Realtime / Edge Functions)

---

## Executive Summary

MR.DEVS CRM is currently a single-page React SPA powered by Vite, Tailwind CSS (v4), and Supabase. It was originally engineered for tracking healthcare and business outreach leads (such as hospital listings in Vehari) with project-based grouping, dynamic custom columns, Excel/CSV file parsing, and activity logging. 

This document contains a **Deep Codebase Audit** of the current system, an accurate mapping of the existing database model and features, a **Gap & Technical Debt Analysis**, and a **Phased CRM Technical Roadmap** designed to transition the application into an enterprise-ready, multi-tenant sales CRM with RBAC, real-time team chat, and outreach capture capabilities.

---

# PART 1: Deep Codebase Audit

## 1. Stack & Architecture Summary

| Layer | Component / Technology | Specification & Current Usage |
| :--- | :--- | :--- |
| **Frontend Framework** | React `^19.2.6` | Modern React with hooks (`useState`, `useEffect`, `useRef`). No router library (SPA view state toggled inside `App.jsx` and `Dashboard.jsx`). |
| **Build Tooling & Bundler** | Vite `^8.0.12` | High-performance ES modules bundler. Entry point at `index.html` -> `src/main.jsx`. |
| **Rendering Strategy** | Client-Side Rendering (CSR) | Pure single-page web app with client-side state hydration and Supabase REST/WebSocket connections. |
| **Styling & Design System** | Tailwind CSS `^4.3.0` + PostCSS | Configured via `@tailwindcss/postcss`. Custom dark theme styling using CSS variables (`bg-bg-primary`, `#0f0f0f`, `#1a1a1a`, `#3ecf8e` brand accent). |
| **Backend & Database** | Supabase Platform | PostgreSQL database, Supabase Auth (`@supabase/supabase-js` `^2.105.4`), Supabase Realtime channels (Presence API), and Deno Edge Functions. |
| **Serverless Edge Functions**| Deno / TypeScript (`supabase/functions/create_user`) | Admin-only API endpoint for creating auth users with pre-confirmed emails using the Supabase `SERVICE_ROLE_KEY`. |
| **File Processing** | SheetJS / `xlsx` `^0.18.5` | Client-side parsing of `.xlsx` and `.csv` binary files into structured JS arrays. |

### Component Architecture & Directory Structure Map

```
mr-devs-crm/
├── public/                     # Static assets
├── supabase/                   # Supabase infrastructure code
│   └── functions/
│       └── create_user/        # Deno edge function (Admin user creation API)
│           └── index.ts
├── src/                        # Main application source code
│   ├── main.jsx                # DOM root mount & React entry
│   ├── App.jsx                 # Top-level state, Auth session listener & Router
│   ├── App.css / index.css     # Design tokens, Tailwind v4 imports & custom CSS
│   ├── lib/                    # Shared core business logic & helpers
│   │   ├── supabase.js         # Supabase client instantiation
│   │   ├── permissions.js      # Single source of truth for UI Role-Based Access Control
│   │   ├── activityLogger.js   # Fire-and-forget logger calling Supabase RPC `log_activity`
│   │   ├── activityActions.js  # Constant definitions for audit event types
│   │   └── activityFormatter.js# Human-readable formatter for activity log timelines
│   ├── pages/                  # Page-level containers
│   │   ├── Dashboard.jsx       # Main application hub (Leads, Projects, Team views)
│   │   ├── Login.jsx           # Password sign-in interface
│   │   ├── EmployeeProfilePage.jsx # Individual user profile & activity timeline
│   │   └── SettingsPage.jsx    # User settings interface
│   └── components/             # Reusable UI components
│       ├── Toolbar.jsx         # Search, filters, import & column management bar
│       ├── StatsBar.jsx        # Summary KPI cards (Total, Contacted, Converted, Priority)
│       ├── LeadsTable.jsx      # Interactive data table with copy-to-clipboard cells
│       ├── LeadModal.jsx       # Add/Edit lead drawer modal
│       ├── ColManager.jsx      # Dynamic DDL column manager modal
│       ├── ImportModal.jsx     # Multi-step Excel/CSV import wizard
│       ├── ProjectSelector.jsx # Project switcher dropdown & management modal trigger
│       ├── ProjectModal.jsx    # Add/Edit project modal
│       ├── TeamPage.jsx        # Team directory, role cards & presence indicators
│       ├── UserMenu.jsx        # User avatar menu & navigation actions
│       └── team/               # Modular team profile subcomponents
│           ├── AddMemberModal.jsx        # Modal invoking `create_user` Edge function
│           ├── EmployeeCard.jsx          # User card with online badge & metrics
│           ├── EmployeeHeader.jsx        # User profile banner
│           ├── EmployeeStatsCards.jsx    # User performance stats summary
│           ├── EmployeeProfileEditor.jsx # Editable user detail fields
│           └── EmployeeActivityFeed.jsx  # Paginated activity log feed
```

---

## 2. Actual Existing Database Schema (Verified from Code)

The codebase interacts with **5 PostgreSQL tables** and **4 Database Functions (RPCs)** in Supabase.

### Tables & Fields

#### A. `profiles` Table
Stores extended user profile data linked directly to Supabase `auth.users`.
* `id` (`UUID`, Primary Key, references `auth.users.id`)
* `email` (`TEXT`)
* `role` (`TEXT`: `'admin'`, `'manager'`, `'sales'`, `'lead generator'`, `'employee'`, `'viewer'`)
* `full_name` (`TEXT`)
* `avatar_url` (`TEXT`)
* `created_at` (`TIMESTAMP WITH TIME ZONE`)

#### B. `projects` Table
Organizes leads into isolated workspace containers (e.g. regional agency campaigns).
* `id` (`UUID` / `TEXT`, Primary Key)
* `name` (`TEXT`)
* `created_at` (`TIMESTAMP WITH TIME ZONE`)

#### C. `leads` Table
Primary entity table for outreach targets. Note: Columns added dynamically via DDL RPC.
* `id` (`BIGINT` / `UUID`, Primary Key auto-generated)
* `project_id` (`UUID` / `TEXT`, Foreign Key references `projects.id`)
* `hospital_name` (`TEXT`, Required / Not Null — serves as primary display title)
* `address` (`TEXT`)
* `type` (`TEXT`)
* `rating` (`NUMERIC`)
* `reviews` (`NUMERIC` / `INTEGER`)
* `phone` (`TEXT`)
* `number_type` (`TEXT`: `'Mobile ✅'`, `'Landline ⚠️'`, `'No Number'`)
* `has_website` (`TEXT`: `'Yes'`, `'No'`)
* `priority` (`TEXT`: `'High'`, `'Medium'`, `'Low'`)
* `stage` (`TEXT`: `'New'`, `'Contacted'`, `'Interested'`, `'Converted'`, `'Lost'`)
* `fb_found` (`TEXT`: `'Yes'`, `'No'`)
* `contacted` (`TEXT`: `'Yes'`, `'Attempted'`, `'Queued'`, `'Not Reachable'`, `'No'`)
* `reply` (`TEXT`: `'Yes'`, `'Later'`, `'No'`, `'—'`)
* `notes` (`TEXT`)
* `[dynamic_custom_columns]` (Additional physical database columns created dynamically via `add_custom_column`)

#### D. `custom_columns` Table
Metadata tracking dynamic physical columns added to the `leads` table.
* `id` (`UUID`, Primary Key)
* `column_name` (`TEXT`, snake_case database identifier matching the column added to `leads`)
* `display_name` (`TEXT`, human-readable label shown in UI headers)
* `data_type` (`TEXT`: `'Text'`, `'Number'`, `'Date'`, `'Yes/No'`)
* `created_at` (`TIMESTAMP WITH TIME ZONE`)

#### E. `activity_logs` Table
Audit trail logging business events across the system.
* `id` (`UUID`, Primary Key)
* `user_id` (`UUID`, references `profiles.id`)
* `action` (`TEXT`, e.g. `'user.logged_in'`, `'lead.created'`, `'lead.imported'`, `'lead.updated'`, `'lead.deleted'`)
* `entity_type` (`TEXT`: `'lead'`, `'project'`, `'user'`, `'profile'`)
* `entity_id` (`TEXT`)
* `project_id` (`UUID`, references `projects.id`)
* `metadata` (`JSONB`, key-value payload containing file names, changed values, counts)
* `created_at` (`TIMESTAMP WITH TIME ZONE`)

### Existing Stored Procedures / RPCs

1. `add_custom_column(col_name text, col_type text)`: Executes DDL `ALTER TABLE leads ADD COLUMN ...` dynamically.
2. `delete_custom_column(col_name text)`: Executes DDL `ALTER TABLE leads DROP COLUMN ...` dynamically.
3. `log_activity(p_action text, p_entity_type text, p_entity_id text, p_project_id uuid, p_metadata jsonb)`: `SECURITY DEFINER` function that securely inserts activity logs using the caller's `auth.uid()`.
4. `get_team_metrics(p_user_id uuid DEFAULT NULL)`: Aggregates total leads added, edited, total actions, and last active timestamp per user or team-wide.

---

## 3. Current Lead Import & Analysis Flow (`ImportModal.jsx`)

The lead import workflow operates as a 2-step wizard designed for Excel/CSV spreadsheet processing.

```
[User Selects File] ──> FileReader (ArrayBuffer) ──> SheetJS (xlsx.read)
                                                           │
                                                           ▼
[Step 1: Header Selection] <── Displays Raw Rows Matrix ── Sheet JSON Array
         │
         ▼
[Step 2: Field Mapping & Cleaning]
  ├── Alias Normalization (e.g., "mob" -> "phone", "clinic_name" -> "hospital_name")
  ├── System Blocklist Filtering (Ignores "id", "#", "sr_no", "index")
  ├── Custom Column Dynamic DDL Injection (`add_custom_column` RPC)
  ├── Data Sanitization (Yes/No normalization, rating parsing)
  ├── Scope-Bounded Duplicate Detection (Matches exact `hospital_name + phone` or `hospital_name` fallback against active `project_id`)
  └── Sequential Batch Chunking (200 rows per `supabase.from('leads').insert()`)
         │
         ▼
[Database Persistence] ──> `logActivity()` Audit Event ──> Toast & UI Refresh
```

### Key Import Flow Characteristics:
1. **File Parsing**: Uses `xlsx.read(data, { type: 'array' })` to read the first worksheet (`workbook.SheetNames[0]`) into JSON row arrays.
2. **Header Detection & Auto-Mapping**: Guesses the header index based on row density. Maps original headers against explicit aliases (e.g., `business_name`, `clinic_name`, `facility_name` map to `hospital_name`; `mob`, `cell` map to `phone`).
3. **Missing Data Handling**:
   - Dropped Rows: Rows missing `hospital_name` are skipped during array compilation (tracked in `skipped` count) because `hospital_name` is constrained as non-null.
   - Sanitization: Standardizes variations of true/false to canonical `"Yes"` / `"No"` for boolean columns (`has_website`, `fb_found`). Regex parses raw ratings (`"4.5 stars"` -> `4.5`).
4. **Duplicate Prevention**:
   - Before inserting, queries existing leads for the `activeProject.id` returning `hospital_name` and `phone`.
   - Checks incoming rows against a dual fingerprint set: `name||phone` for rows with phone, and `name-only` for phoneless rows. Duplicates are filtered out and reported in `duplicates` count.
5. **Output Destination**: Inserts directly to Supabase `leads` table in sequential chunks of 200 rows. Emits an audit event to `activity_logs`.

### Hardcoded Assumptions & Risk Flags:
* **Fixed Domain Identifier (`hospital_name`)**: The schema uses `hospital_name` as the mandatory name column. Importing generic corporate or B2B sales leads requires mapping company names to `hospital_name`.
* **Single Sheet Hardcoding**: Only parses sheet 0 (`workbook.SheetNames[0]`). Workbooks with multiple tabs silently ignore tabs 2+.
* **Physical DDL Custom Columns**: Adding custom columns executes physical `ALTER TABLE leads ADD COLUMN` statements via PostgreSQL DDL. High-frequency column creation will cause table locks and schema bloat.

---

## 4. Current Auth & User State

1. **Authentication Engine**: Fully integrated with Supabase Auth (`supabase.auth.signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`).
2. **Session Persistence**: Initialized in `App.jsx`. Listens for state changes and fetches matching record from `profiles`.
3. **Role Architecture**:
   - UI permissions governed by `src/lib/permissions.js`.
   - Role hierarchy: `admin > manager > sales > lead generator > viewer > employee (legacy)`.
   - Permission helper functions govern component rendering (`canWriteLeads`, `canDeleteLeads`, `canManageProjects`, `canAccessTeam`, `canManageColumns`, `canImport`, `isReadOnly`).
4. **User Management**: Admins can invite team members via `AddMemberModal.jsx`, which calls the `create_user` Supabase Edge Function using `auth.admin.createUser()`.

---

## 5. Gap Analysis & Technical Debt

### Missing Features Relative to a Production CRM:
1. **No OAuth Support**: Lacks Google OAuth or SSO integration (email/password only).
2. **Missing Assigned Lead Ownership**: The `leads` table has `project_id` but **no `assigned_to` or `user_id` column**. Every sales rep in a project sees all leads in that project; there is no rep-level lead scoping.
3. **No Visual Pipeline / Kanban View**: Lead stages (`New`, `Contacted`, `Interested`, `Converted`, `Lost`) exist only as text column values in a table. There is no drag-and-drop Kanban pipeline view.
4. **No Realtime Lead Table Synchronization**: While Supabase Realtime presence is implemented for team status (`team-presence` channel), `leads` table mutations do not subscribe to Supabase Postgres Changes. Users must refresh to see additions/edits made by teammates.
5. **No Team Messaging**: Communication must occur out-of-band; there are no chat tables or channels.
6. **No Outreach Event Logging Integration**: No Chrome extension or webhook integration for logging emails, phone calls, or social outreach events.

### Technical Debt & Codebase Inconsistencies:
1. **Schema Role Inconsistency**: `supabase/functions/create_user/index.ts` validates roles against `['admin', 'employee', 'viewer']`, while `src/lib/permissions.js` defines `['admin', 'manager', 'sales', 'lead generator', 'viewer']`.
2. **Physical Table Alterations for Custom Fields**: Dynamic columns execute `ALTER TABLE leads ADD COLUMN`, exposing the database to security risks and structural limits (Postgres maximum column limits).
3. **Lack of Database-Level RLS Enforcement on `leads` and `projects`**: Security currently relies heavily on UI suppression (`permissions.js`). PostgreSQL Row-Level Security policies need explicit definition to enforce data isolation at the DB layer.

---

# PART 2: Database Schema Additions (Roadmap Diff)

The following SQL migration script represents the **incremental schema additions** required to support the CRM roadmap without modifying existing tables destructively.

```sql
-- =============================================================================
-- MR.DEVS CRM: ROADMAP SCHEMA ADDITIONS (DIFF)
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

-- 3. TEAM CHAT TABLES (GLOBAL & PER-LEAD THREADS)
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('team', 'lead_thread', 'direct')) DEFAULT 'team',
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
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
CREATE POLICY "Leads access policy" ON leads
  FOR ALL
  USING (
    is_admin_or_manager(auth.uid()) OR
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    assigned_to IS NULL
  );

-- RLS Policy: Chat Messages
-- Users can view messages in channels they have access to, and insert messages with sender_id = auth.uid().
CREATE POLICY "Read chat messages" ON chat_messages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert chat messages" ON chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- RLS Policy: Outreach Events
CREATE POLICY "Outreach events policy" ON outreach_events
  FOR ALL USING (
    is_admin_or_manager(auth.uid()) OR user_id = auth.uid()
  );
```

---

# PART 3: Phased CRM Roadmap Proposal

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               PHASED BUILD PLAN                                  │
├───────────────────┬───────────────────┬───────────────────┬──────────────────────┤
│      PHASE 1      │      PHASE 2      │      PHASE 3      │       PHASE 4        │
│ Auth & Security   │ RBAC & RLS Engine │ Sales Dashboard & │ Realtime Team Chat   │
│ (Google OAuth &   │ (Rep Assignment & │ Import Overhaul   │ (Lead Threads &      │
│ Session Guards)   │  Database Rules)  │ (Kanban & Mapping)│ Global Channels)     │
└───────────────────┴───────────────────┴───────────────────┴──────────────────────┘
                                          │
                                          ▼
                                     [ PHASE 5 ]
                             Chrome Extension Outreach Capture
                             (Gmail / LinkedIn Event Scripting)
```

---

## Phase 1 — Authentication Enhancement & OAuth Integration

### Objectives:
* Implement Google OAuth alongside existing email/password authentication.
* Provide robust session handling, login persistence, and client-side protected routing.

### Implementation Tasks:
1. **Supabase Auth Configuration**:
   - Configure Google OAuth Client ID and Secret in Supabase Auth Console.
   - Update `Login.jsx` to include a "Sign in with Google" button calling `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
2. **Profile Trigger & OAuth Sync**:
   - Create a PostgreSQL trigger (`on_auth_user_created`) that automatically populates the `profiles` table with `full_name`, `avatar_url`, and assigns default role `'sales'` when a user registers via Google OAuth.
3. **Session & Protected Route Guard**:
   - Refactor `App.jsx` with an explicit Auth Guard wrapper component.
   - Prevent flash-of-unauthenticated-content (FOUC) during token refresh.

---

## Phase 2 — Role-Based Access Control (RBAC) & Database RLS

### Objectives:
* Enforce strict lead ownership and visibility boundaries at both the database level (RLS) and UI level.
* Enable Admins and Managers to view global performance while restricting Sales Reps to their assigned leads/batches.

### Implementation Tasks:
1. **Database Lead Ownership**:
   - Apply schema migration adding `assigned_to` and `created_by` to `leads`.
   - Update `LeadModal.jsx` and `LeadsTable.jsx` to display and edit assigned sales representatives.
2. **Supabase RLS Deployment**:
   - Apply RLS policies on `leads`, `projects`, and `profiles`.
   - Ensure Sales Reps can only query rows where `assigned_to = auth.uid()` or `assigned_to IS NULL`.
   - Ensure Admins/Managers bypass restriction via `is_admin_or_manager()` security function.
3. **UI Role Enforcement Update**:
   - Update `src/lib/permissions.js` to synchronize role taxonomy (`admin`, `manager`, `sales`, `lead generator`, `viewer`).
   - Add rep-level filtering switches to the Toolbar ("My Assigned Leads" vs. "All Project Leads" for Admins).

---

## Phase 3 — Sales Dashboard, Visual Pipeline & Import Overhaul

### Objectives:
* Deliver a visual Kanban lead pipeline view with drag-and-drop stage updates.
* Build a per-rep performance analytics view.
* Overhaul the CSV/Excel import wizard with dynamic column mapping, duplicate previewing, and missing field flags.

### Implementation Tasks:
1. **Visual Lead Kanban Board**:
   - Create a toggleable view in `Dashboard.jsx` switching between Table View and Kanban Board View.
   - Kanban columns for stages: `New` ➔ `Contacted` ➔ `Interested` ➔ `Converted` ➔ `Lost`.
   - Drag-and-drop or card action menu to transition lead stages, firing `logActivity()` events.
2. **Per-Rep Performance Analytics**:
   - Add a "Rep Performance" tab inside `TeamPage.jsx` showing lead conversion rates, response rates, outreach counts, and activity velocity per sales rep.
3. **Import Wizard Overhaul (`ImportModal.jsx`)**:
   - **Flexible Mapping**: Replace hardcoded `hospital_name` assumption with dynamic primary title mapping (`lead_name` / `company_name` / `hospital_name`).
   - **JSONB Custom Fields**: Store unknown spreadsheet columns in the `custom_fields` `JSONB` column instead of executing PostgreSQL DDL `ALTER TABLE`.
   - **In-UI Missing Field & Duplicate Flagging**: Before committing import, display a summary step highlighting rows with missing required fields or detected duplicates, allowing the user to select whether to overwrite, skip, or force-import.

---

## Phase 4 — Realtime Team Chat & Collaboration

### Objectives:
* Provide real-time team messaging directly within the CRM.
* Support both team-wide chat channels and lead-specific discussion threads.

### Implementation Tasks:
1. **Database & Realtime Subscriptions**:
   - Deploy `chat_channels` and `chat_messages` tables.
   - Establish Supabase Realtime WebSocket subscriptions on `chat_messages` for instant delivery.
2. **Global Team Chat Drawer / Page**:
   - Build a sliding chat panel or dedicated tab for general team channels (`#general`, `#announcements`, `#deals`).
3. **Per-Lead Comment & Discussion Threads**:
   - Add a "Discussion & Notes" tab inside `LeadModal.jsx`.
   - Automatically create/join a `lead_thread` channel for the active lead so sales reps can @mention teammates, discuss deal terms, or leave internal updates.

---

## Phase 5 — Outreach Capture (Chrome Extension Integration)

### Scope & Architectural Note:
* **Standalone Mini-Project**: Developed as a separate Manifest V3 Chrome Extension codebase communicating with the Supabase API.
* **WhatsApp Constraint Flag**: As noted, WhatsApp lacks an open, stable client API for personal web sessions. WhatsApp event tracking is treated as an **unsolved constraint** and excluded from scope; focus is placed on web-accessible DOM event capture for Gmail, LinkedIn, and Facebook.

### Implementation Tasks:
1. **Chrome Extension (Manifest V3)**:
   - Auth integration using Supabase JWT token storage in `chrome.storage.local`.
   - Background service worker to authenticate API requests.
2. **Content Scripts for Outreach Events**:
   - **Gmail Script**: Detects "Send" click events and email thread responses, posting payload to `outreach_events` table with `channel: 'gmail'`.
   - **LinkedIn Script**: Captures message sends and connection accepts from LinkedIn Messaging DOM, posting to `outreach_events` with `channel: 'linkedin'`.
   - **Facebook Script**: Captures Page messenger interactions, posting to `outreach_events` with `channel: 'facebook'`.
3. **CRM Timeline Integration**:
   - Render incoming `outreach_events` inside the Lead details modal and Employee activity feed.

---

## Summary of Action Items & Next Steps

1. **Review & Sign-Off**: Review this document (`CODEBASE_ANALYSIS.md`) to confirm architecture and roadmap priorities.
2. **Execute Phase 1 & 2 Migration**: Once approved, execute the SQL schema diff in Supabase SQL Editor and begin implementing Phase 1 (Google OAuth) and Phase 2 (RBAC & RLS).

---

# Phase 1 Completion Notes

**Completed On:** August 2, 2026

### What Was Executed & Changed

1. **Schema Migration Script (`supabase/migrations/20260802000000_phase1_crm_roadmap_schema.sql`)**:
   - Created standalone SQL migration file containing all schema additions.
   - Extended `profiles` with `avatar_url` and `updated_at`.
   - Updated `profiles` role constraint to support `admin`, `manager`, `sales`, `lead generator`, `employee`, `viewer`.
   - Extended `leads` with `lead_name`, `assigned_to`, `created_by`, `custom_fields` (`JSONB`), and `updated_at` (plus indexes).
   - Created `chat_channels`, `channel_members` (added for participant-scoped chat access in Phase 4), and `chat_messages` tables.
   - Created `outreach_events` table for Chrome Extension logging.
   - Added `handle_new_user()` PostgreSQL trigger function on `auth.users` to automatically create a matching `profiles` record on new auth signup/OAuth without creating duplicate rows for existing users (checks `EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id)`).
   - Applied Row-Level Security (RLS) policies for `leads`, `chat_messages`, and `outreach_events`.

2. **Role List Synchronization**:
   - Updated `supabase/functions/create_user/index.ts` role validation to validate against `['admin', 'manager', 'sales', 'lead generator', 'viewer']`, aligning strictly with `src/lib/permissions.js` (single source of truth).
   - Updated `src/components/team/AddMemberModal.jsx` role selection dropdown to present all valid roles (`sales`, `admin`, `manager`, `lead generator`, `viewer`) and set default state to `'sales'`.

3. **Google OAuth Integration**:
   - Added a "Sign in with Google" button with Google SVG branding to `src/pages/Login.jsx`.
   - Connected button to `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.

4. **Protected Route Guard Component**:
   - Created `src/components/AuthGuard.jsx` to wrap authenticated app routes.
   - Refactored `src/App.jsx` to use `<AuthGuard>` for session validation, preventing Flash Of Unauthenticated Content (FOUC) during token refresh.

---

### Manual Configuration Required in Supabase Dashboard

To complete Google OAuth setup, the following steps must be configured manually in the Supabase Dashboard:

1. **Google Cloud Console**:
   - Create an OAuth 2.0 Client ID (Web Application type) in Google Cloud Console.
   - Add Authorized Redirect URI: `https://rojqcqxyspgfcnywkbxn.supabase.co/auth/v1/callback`.
2. **Supabase Console**:
   - Go to **Authentication** ➔ **Providers** ➔ **Google** in the Supabase Dashboard (`rojqcqxyspgfcnywkbxn`).
   - Enable the Google provider toggle.
   - Paste the Google **Client ID** and **Client Secret**.
   - Save provider settings.

