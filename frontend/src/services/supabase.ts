/**
 * Supabase client configuration and database operations
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables injected by Vite at build time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// createClient validates the URL with `new URL(supabaseUrl)` and throws if it
// is empty or malformed — which crashes the entire JS bundle before React mounts
// (white screen, no error boundary). Use a syntactically valid placeholder so
// the SDK initialises safely; actual network calls are guarded by isSupabaseConfigured().
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'YOUR_SUPABASE_URL' &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-anon-key'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchCountries() {
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC HOLIDAYS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchPublicHolidays() {
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .order('date');
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchSkills() {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('category', { ascending: true });
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchSystems() {
  const { data, error } = await supabase
    .from('systems')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchTeamMembers() {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      roles(id, name),
      countries(id, code, name)
    `)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function createTeamMember(member: {
  name: string;
  role_id: string;
  country_id: string;
  max_concurrent_projects: number;
}) {
  const { data, error } = await supabase
    .from('team_members')
    .insert(member)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTeamMember(id: string, updates: Partial<{
  name: string;
  role_id: string;
  country_id: string;
  max_concurrent_projects: number;
  is_active: boolean;
}>) {
  const { data, error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeamMember(id: string) {
  // Soft delete
  const { error } = await supabase
    .from('team_members')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_systems(system_id, systems(id, name)),
      project_phases(
        *,
        phase_required_skills(skill_id),
        phase_assignments(*)
      )
    `)
    .order('name');
  if (error) throw error;
  return data;
}

export async function createProject(project: {
  name: string;
  priority: string;
  status: string;
  devops_link?: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<{
  name: string;
  priority: string;
  status: string;
  devops_link: string;
  description: string;
}>) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME OFF
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchTimeOff() {
  const { data, error } = await supabase
    .from('time_off')
    .select('*')
    .order('quarter');
  if (error) throw error;
  return data;
}

export async function upsertTimeOff(timeOff: {
  member_id: string;
  quarter: string;
  days: number;
  reason?: string;
}) {
  const { data, error } = await supabase
    .from('time_off')
    .upsert(timeOff, { onConflict: 'member_id,quarter' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*');
  if (error) throw error;
  
  // Convert to object
  const settings: Record<string, unknown> = {};
  data?.forEach((row: { key: string; value: unknown }) => {
    settings[row.key] = row.value;
  });
  return settings;
}

export async function updateSetting(key: string, value: unknown) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}
