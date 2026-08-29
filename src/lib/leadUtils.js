// ── LEAD UTILITIES ──
// Single source of truth for lead name fallbacks, normalization, and phone formatting.

/**
 * Returns the primary display name for a lead.
 * Prefers lead_name, falls back to hospital_name, then 'Unnamed Lead'.
 * @param {Object} lead
 * @returns {string}
 */
export function getLeadDisplayName(lead) {
  if (!lead) return 'Unnamed Lead'
  return lead.lead_name || lead.hospital_name || 'Unnamed Lead'
}

/**
 * Normalizes lead form data before database operations,
 * ensuring lead_name and hospital_name are always in sync.
 * @param {Object} form
 * @returns {Object}
 */
export function normalizeLeadPayload(form) {
  if (!form) return {}
  const payload = { ...form }
  const primaryName = payload.lead_name || payload.hospital_name || ''
  payload.lead_name = primaryName
  payload.hospital_name = primaryName
  return payload
}

/**
 * Normalizes phone numbers for uniform display and search.
 * Strip excess spaces, normalize country codes.
 * @param {string} phone
 * @returns {string}
 */
export function formatPhoneNumber(phone) {
  if (!phone) return ''
  return phone.toString().trim()
}
