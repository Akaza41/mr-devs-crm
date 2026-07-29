import { supabase } from './supabase'

// ── ACTIVITY LOGGER ──
// Centralized helper that writes activity events via the Supabase `log_activity` RPC.
//
// WHY RPC instead of a direct insert:
//   - The `activity_logs` table has RLS that blocks client-side inserts.
//   - The RPC runs with SECURITY DEFINER (postgres permissions), bypassing that safely.
//   - This also means the service role key never has to be exposed to the browser.
//
// HOW TO USE:
//   import { logActivity } from '../lib/activityLogger'
//   import { ACTIONS } from '../lib/activityActions'
//
//   logActivity({ action: ACTIONS.LEAD_CREATED, entityType: 'lead', entityId: lead.id, projectId: activeProject.id })
//
// IMPORTANT: logActivity is fire-and-forget.
//   It NEVER throws and NEVER blocks the UI.
//   A failed log write is silently swallowed so the user experience is never affected.

/**
 * Log a business event to the activity_logs table via RPC.
 *
 * @param {object} params
 * @param {string}  params.action      - Action constant from activityActions.js (e.g. ACTIONS.LEAD_CREATED)
 * @param {string}  params.entityType  - Type of entity: 'lead', 'project', 'user', 'profile'
 * @param {string}  [params.entityId]  - ID of the specific record acted on (optional)
 * @param {string}  [params.projectId] - Project scope for project-level filtering (optional)
 * @param {object}  [params.metadata]  - Event-specific context (e.g. field name, old/new values)
 */
export async function logActivity({ action, entityType, entityId = null, projectId = null, metadata = {} }) {
  try {
    // Delegate the insert entirely to the RPC — session/user_id is resolved server-side via auth.uid()
    const { error } = await supabase.rpc('log_activity', {
      p_action:      action,
      p_entity_type: entityType,
      p_entity_id:   entityId ? String(entityId) : null,
      p_project_id:  projectId || null,
      p_metadata:    metadata,
    })

    if (error) {
      // Log to console for debugging but never surface to the user
      console.warn('[activityLogger] Failed to log activity:', error.message, { action, entityType, entityId })
    }
  } catch (err) {
    // Network error or unexpected failure — swallow silently
    console.warn('[activityLogger] Unexpected error:', err.message)
  }
}
