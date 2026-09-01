import { db, auth } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// ── ACTIVITY LOGGER ──
// Centralized helper that writes activity events directly to the Cloud Firestore `activity_logs` collection.
//
// IMPORTANT: logActivity is fire-and-forget.
//   It NEVER throws and NEVER blocks the UI.
//   A failed log write is silently swallowed so the user experience is never affected.

/**
 * Log a business event to the activity_logs collection in Firestore.
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
    const currentUser = auth.currentUser
    const userId = currentUser ? currentUser.uid : null

    await addDoc(collection(db, 'activity_logs'), {
      userId,
      action: action || 'unknown',
      entityType: entityType || 'system',
      entityId: entityId ? String(entityId) : null,
      projectId: projectId || null,
      metadata: metadata || {},
      createdAt: serverTimestamp()
    })
  } catch (err) {
    // Network error or unexpected failure — swallow silently
    console.warn('[activityLogger] Swallowed error logging activity:', err.message)
  }
}

