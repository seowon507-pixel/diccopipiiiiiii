import { backendConfigurationError, supabase } from './supabaseClient'

export const MODERATOR_ROLES = new Set(['moderator', 'admin'])

function requireSupabase() {
  if (!supabase) throw backendConfigurationError
  return supabase
}

export function canModerate(role) {
  return MODERATOR_ROLES.has(role)
}

export async function fetchCurrentAppRole() {
  const { data, error } = await requireSupabase().rpc('current_app_role_v1')
  if (error) throw error
  return typeof data === 'string' ? data : 'user'
}

export async function fetchModerationQueue({ status = 'pending', limit = 50, offset = 0 } = {}) {
  const { data, error } = await requireSupabase().rpc('list_moderation_queue_v1', {
    p_status: status || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return data ?? []
}

export async function resolveModerationCase(caseId, action, note = '') {
  const { data, error } = await requireSupabase().rpc('resolve_moderation_case_v1', {
    p_case_id: caseId,
    p_action: action,
    p_note: note.trim() || null,
  })
  if (error) throw error
  return Array.isArray(data) ? (data[0] ?? null) : data
}
