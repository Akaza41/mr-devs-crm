import { ACTIONS } from './activityActions'

/**
 * Converts a raw activity_log record into a user-friendly string and title.
 * 
 * @param {object} log - The activity log record containing action and metadata.
 * @returns {object} - { title: string, details: string, isAutoDetected?: boolean }
 */
export function formatActivityDetails(log) {
  const meta = log.metadata || {}

  switch (log.action) {
    case ACTIONS.LEAD_CREATED:
      return {
        title: 'Lead Added',
        details: meta.lead_name ? `Added lead '${meta.lead_name}'` : 'Added a new lead'
      }
    case ACTIONS.LEAD_UPDATED:
      return {
        title: 'Lead Edited',
        details: meta.lead_name ? `Updated lead '${meta.lead_name}'` : 'Updated a lead'
      }
    case ACTIONS.LEAD_DELETED:
      return {
        title: 'Lead Deleted',
        details: meta.lead_name ? `Deleted lead '${meta.lead_name}'` : 'Deleted a lead'
      }
    case ACTIONS.LEAD_IMPORTED:
      return {
        title: 'Imported Excel',
        details: `Imported ${meta.inserted || 0} leads from '${meta.file_name || 'file'}'`
      }
    case ACTIONS.TOUCH_LOGGED:
      return {
        title: `Touch #${meta.sequence_number || 1} Logged`,
        details: `${(meta.channel || 'outreach').toUpperCase()} (${meta.outcome || 'completed'})`
      }
    case ACTIONS.EXTENSION_EVENT_LOGGED:
    case 'lead.extension_event':
      return {
        title: '📧 Auto-detected via extension',
        details: meta.subject_line ? `Sent email: "${meta.subject_line}"` : `Outreach detected on ${meta.channel || 'Gmail'}`,
        isAutoDetected: true
      }
    case ACTIONS.PROJECT_CREATED:
      return {
        title: 'Project Created',
        details: meta.project_name ? `Created project '${meta.project_name}'` : 'Created a new project'
      }
    case ACTIONS.PROJECT_UPDATED:
      return {
        title: 'Project Edited',
        details: meta.project_name ? `Updated project '${meta.project_name}'` : 'Updated a project'
      }
    case ACTIONS.PROJECT_DELETED:
      return {
        title: 'Project Deleted',
        details: meta.project_name ? `Deleted project '${meta.project_name}'` : 'Deleted a project'
      }
    case ACTIONS.USER_INVITED:
      return {
        title: 'User Invited',
        details: meta.target_email ? `Invited '${meta.target_email}' to the team` : 'Invited a new user'
      }
    case ACTIONS.USER_REMOVED:
      return {
        title: 'User Removed',
        details: meta.target_email ? `Removed '${meta.target_email}' from the team` : 'Removed a user'
      }
    case ACTIONS.ROLE_CHANGED:
      return {
        title: 'Role Changed',
        details: meta.new_role ? `Changed role from ${meta.old_role || 'previous'} to ${meta.new_role}` : 'Changed a user role'
      }
    case ACTIONS.PROFILE_UPDATED:
      return {
        title: 'Profile Updated',
        details: 'Updated profile details'
      }
    case ACTIONS.USER_LOGGED_IN:
      return {
        title: 'Logged In',
        details: 'Started a new session'
      }
    default:
      return {
        title: log.action ? log.action.replace(/_/g, ' ') : 'System Action',
        details: meta.detail || 'Performed an action'
      }
  }
}
