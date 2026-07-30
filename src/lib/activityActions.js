// ── ACTIVITY ACTIONS ──
// Centralized registry of all activity log action names.
// Always use these constants instead of hardcoded strings to prevent typos
// and make future refactoring (renaming, searching) much easier.

export const ACTIONS = {
  // Lead operations
  LEAD_CREATED:    'LEAD_CREATED',
  LEAD_UPDATED:    'LEAD_UPDATED',
  LEAD_DELETED:    'LEAD_DELETED',
  LEAD_IMPORTED:   'LEAD_IMPORTED',

  // Project operations
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',

  // User / team management
  USER_INVITED:    'USER_INVITED',
  USER_REMOVED:    'USER_REMOVED',
  ROLE_CHANGED:    'ROLE_CHANGED',

  // Profile operations
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  USER_LOGGED_IN:  'USER_LOGGED_IN',
}
