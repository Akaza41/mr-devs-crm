// ── PERMISSIONS UTILITY ──
// Single source of truth for what each role is allowed to do in the UI.
// RLS enforces these rules at the database level — this file controls what the UI shows.
// 
// Role hierarchy (most → least permissions):
//   admin > manager > sales > lead generator > viewer > employee (legacy, treated as viewer)

// Roles that can write leads (create or update)
const WRITE_ROLES = ['admin', 'manager', 'sales', 'lead generator']

// Roles that can delete leads
const DELETE_LEAD_ROLES = ['admin', 'manager']

// Roles that can manage projects (create, edit, delete)
const MANAGE_PROJECT_ROLES = ['admin', 'manager']

// Roles that can delete projects
const DELETE_PROJECT_ROLES = ['admin']

// Roles that can access the Team management section
const TEAM_ACCESS_ROLES = ['admin', 'manager']

// Roles that can manage columns
const MANAGE_COLUMN_ROLES = ['admin', 'manager']

// Roles with import permission
const IMPORT_ROLES = ['admin', 'manager', 'sales', 'lead generator']

// Roles that can manage user invites (Add User / Pending Invites screen)
const INVITE_ROLES = ['admin']

/**
 * Returns true if the role can create or update leads.
 * @param {string} role
 */
export function canWriteLeads(role) {
  return WRITE_ROLES.includes(role)
}

/**
 * Returns true if the role can delete leads.
 * @param {string} role
 */
export function canDeleteLeads(role) {
  return DELETE_LEAD_ROLES.includes(role)
}

/**
 * Returns true if the role can create or edit projects.
 * @param {string} role
 */
export function canManageProjects(role) {
  return MANAGE_PROJECT_ROLES.includes(role)
}

/**
 * Returns true if the role can delete projects.
 * @param {string} role
 */
export function canDeleteProjects(role) {
  return DELETE_PROJECT_ROLES.includes(role)
}

/**
 * Returns true if the role has access to the Team section.
 * @param {string} role
 */
export function canAccessTeam(role) {
  return TEAM_ACCESS_ROLES.includes(role)
}

/**
 * Returns true if the role can add or remove custom columns.
 * @param {string} role
 */
export function canManageColumns(role) {
  return MANAGE_COLUMN_ROLES.includes(role)
}

/**
 * Returns true if the role can import leads from Excel/CSV.
 * @param {string} role
 */
export function canImport(role) {
  return IMPORT_ROLES.includes(role)
}

/**
 * Returns true if the role can create and manage pending user invites.
 * @param {string} role
 */
export function canManageInvites(role) {
  return INVITE_ROLES.includes(role)
}

/**
 * Returns true if the role is strictly read-only (viewer or legacy employee).
 * @param {string} role
 */
export function isReadOnly(role) {
  return !canWriteLeads(role)
}

