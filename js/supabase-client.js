/**
 * Supabase Client for Capacity Planner
 * 
 * Provides database operations using Supabase.
 * Falls back to localStorage when Supabase is not configured.
 */

const SupabaseClient = (function() {
    'use strict';

    let supabase = null;
    let isInitialized = false;

    /**
     * Initialize Supabase client
     */
    function init() {
        if (!CONFIG.USE_SUPABASE) {
            console.log('[Supabase] Supabase disabled, using localStorage');
            return false;
        }

        if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
            console.warn('[Supabase] Supabase URL not configured');
            return false;
        }

        try {
            // Import Supabase from CDN (loaded in index.html)
            supabase = window.supabase.createClient(
                CONFIG.SUPABASE_URL,
                CONFIG.SUPABASE_ANON_KEY
            );
            isInitialized = true;
            console.log('[Supabase] Client initialized successfully');
            return true;
        } catch (error) {
            console.error('[Supabase] Failed to initialize:', error);
            return false;
        }
    }

    /**
     * Check if Supabase is available
     */
    function isAvailable() {
        return isInitialized && supabase !== null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COUNTRIES
    // ═══════════════════════════════════════════════════════════════════════════

    async function getCountries() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('countries')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC HOLIDAYS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getPublicHolidays(countryId = null) {
        if (!isAvailable()) return null;
        let query = supabase
            .from('public_holidays')
            .select('*, countries(code, name)')
            .order('date');
        
        if (countryId) {
            query = query.eq('country_id', countryId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async function addPublicHoliday(holiday) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('public_holidays')
            .insert(holiday)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function deletePublicHoliday(id) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('public_holidays')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    async function getRoles() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    }

    async function addRole(role) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('roles')
            .insert(role)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function updateRole(id, updates) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('roles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function deleteRole(id) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('roles')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SKILLS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getSkills() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('skills')
            .select('*')
            .order('category', 'name');
        if (error) throw error;
        return data;
    }

    async function addSkill(skill) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('skills')
            .insert(skill)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function updateSkill(id, updates) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('skills')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function deleteSkill(id) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('skills')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SYSTEMS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getSystems() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('systems')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    }

    async function addSystem(system) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('systems')
            .insert(system)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function updateSystem(id, updates) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('systems')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function deleteSystem(id) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('systems')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEAM MEMBERS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getTeamMembers() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('v_team_members')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        return data;
    }

    async function getTeamMember(id) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                roles(id, name),
                countries(id, code, name),
                team_member_skills(skill_id, skills(id, name, category))
            `)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    }

    async function addTeamMember(member) {
        if (!isAvailable()) return null;
        const { skillIds, ...memberData } = member;
        
        // Insert member
        const { data: newMember, error: memberError } = await supabase
            .from('team_members')
            .insert(memberData)
            .select()
            .single();
        if (memberError) throw memberError;

        // Insert skills
        if (skillIds && skillIds.length > 0) {
            const skillRecords = skillIds.map(skillId => ({
                member_id: newMember.id,
                skill_id: skillId
            }));
            const { error: skillError } = await supabase
                .from('team_member_skills')
                .insert(skillRecords);
            if (skillError) throw skillError;
        }

        return newMember;
    }

    async function updateTeamMember(id, updates) {
        if (!isAvailable()) return null;
        const { skillIds, ...memberData } = updates;

        // Update member
        const { data: updatedMember, error: memberError } = await supabase
            .from('team_members')
            .update(memberData)
            .eq('id', id)
            .select()
            .single();
        if (memberError) throw memberError;

        // Update skills if provided
        if (skillIds !== undefined) {
            // Delete existing skills
            await supabase
                .from('team_member_skills')
                .delete()
                .eq('member_id', id);

            // Insert new skills
            if (skillIds.length > 0) {
                const skillRecords = skillIds.map(skillId => ({
                    member_id: id,
                    skill_id: skillId
                }));
                const { error: skillError } = await supabase
                    .from('team_member_skills')
                    .insert(skillRecords);
                if (skillError) throw skillError;
            }
        }

        return updatedMember;
    }

    async function deleteTeamMember(id) {
        if (!isAvailable()) return null;
        // Soft delete - just mark as inactive
        const { error } = await supabase
            .from('team_members')
            .update({ is_active: false })
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROJECTS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getProjects() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('v_projects')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    }

    async function getProject(id) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                project_systems(system_id, systems(id, name)),
                project_phases(
                    *,
                    phase_required_skills(skill_id, skills(id, name, category)),
                    phase_assignments(*)
                )
            `)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    }

    async function addProject(project) {
        if (!isAvailable()) return null;
        const { systemIds, phases, ...projectData } = project;

        // Insert project
        const { data: newProject, error: projectError } = await supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single();
        if (projectError) throw projectError;

        // Insert systems
        if (systemIds && systemIds.length > 0) {
            const systemRecords = systemIds.map(systemId => ({
                project_id: newProject.id,
                system_id: systemId
            }));
            const { error: systemError } = await supabase
                .from('project_systems')
                .insert(systemRecords);
            if (systemError) throw systemError;
        }

        // Insert phases
        if (phases && phases.length > 0) {
            for (const phase of phases) {
                await addProjectPhase(newProject.id, phase);
            }
        }

        return newProject;
    }

    async function updateProject(id, updates) {
        if (!isAvailable()) return null;
        const { systemIds, ...projectData } = updates;

        // Update project
        const { data: updatedProject, error: projectError } = await supabase
            .from('projects')
            .update(projectData)
            .eq('id', id)
            .select()
            .single();
        if (projectError) throw projectError;

        // Update systems if provided
        if (systemIds !== undefined) {
            await supabase
                .from('project_systems')
                .delete()
                .eq('project_id', id);

            if (systemIds.length > 0) {
                const systemRecords = systemIds.map(systemId => ({
                    project_id: id,
                    system_id: systemId
                }));
                const { error: systemError } = await supabase
                    .from('project_systems')
                    .insert(systemRecords);
                if (systemError) throw systemError;
            }
        }

        return updatedProject;
    }

    async function deleteProject(id) {
        if (!isAvailable()) return null;
        // Cascade delete handles phases and assignments
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROJECT PHASES
    // ═══════════════════════════════════════════════════════════════════════════

    async function addProjectPhase(projectId, phase) {
        if (!isAvailable()) return null;
        const { requiredSkillIds, assignments, ...phaseData } = phase;

        const { data: newPhase, error: phaseError } = await supabase
            .from('project_phases')
            .insert({ ...phaseData, project_id: projectId })
            .select()
            .single();
        if (phaseError) throw phaseError;

        // Insert required skills
        if (requiredSkillIds && requiredSkillIds.length > 0) {
            const skillRecords = requiredSkillIds.map(skillId => ({
                phase_id: newPhase.id,
                skill_id: skillId
            }));
            const { error: skillError } = await supabase
                .from('phase_required_skills')
                .insert(skillRecords);
            if (skillError) throw skillError;
        }

        // Insert assignments
        if (assignments && assignments.length > 0) {
            const assignmentRecords = assignments.map(a => ({
                phase_id: newPhase.id,
                member_id: a.memberId,
                quarter: a.quarter,
                days: a.days
            }));
            const { error: assignmentError } = await supabase
                .from('phase_assignments')
                .insert(assignmentRecords);
            if (assignmentError) throw assignmentError;
        }

        return newPhase;
    }

    async function updateProjectPhase(id, updates) {
        if (!isAvailable()) return null;
        const { requiredSkillIds, ...phaseData } = updates;

        const { data: updatedPhase, error: phaseError } = await supabase
            .from('project_phases')
            .update(phaseData)
            .eq('id', id)
            .select()
            .single();
        if (phaseError) throw phaseError;

        if (requiredSkillIds !== undefined) {
            await supabase
                .from('phase_required_skills')
                .delete()
                .eq('phase_id', id);

            if (requiredSkillIds.length > 0) {
                const skillRecords = requiredSkillIds.map(skillId => ({
                    phase_id: id,
                    skill_id: skillId
                }));
                const { error: skillError } = await supabase
                    .from('phase_required_skills')
                    .insert(skillRecords);
                if (skillError) throw skillError;
            }
        }

        return updatedPhase;
    }

    async function deleteProjectPhase(id) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('project_phases')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE ASSIGNMENTS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getAssignmentsForMember(memberId, quarter = null) {
        if (!isAvailable()) return null;
        let query = supabase
            .from('v_phase_assignments')
            .select('*')
            .eq('member_id', memberId);
        
        if (quarter) {
            query = query.eq('quarter', quarter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async function upsertAssignment(assignment) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('phase_assignments')
            .upsert(assignment, { 
                onConflict: 'phase_id,member_id,quarter' 
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function deleteAssignment(phaseId, memberId, quarter) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('phase_assignments')
            .delete()
            .eq('phase_id', phaseId)
            .eq('member_id', memberId)
            .eq('quarter', quarter);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TIME OFF
    // ═══════════════════════════════════════════════════════════════════════════

    async function getTimeOff(memberId = null) {
        if (!isAvailable()) return null;
        let query = supabase
            .from('time_off')
            .select('*, team_members(id, name)')
            .order('quarter');
        
        if (memberId) {
            query = query.eq('member_id', memberId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async function upsertTimeOff(timeOff) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('time_off')
            .upsert(timeOff, { 
                onConflict: 'member_id,quarter' 
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async function deleteTimeOff(memberId, quarter) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('time_off')
            .delete()
            .eq('member_id', memberId)
            .eq('quarter', quarter);
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════

    async function getSetting(key) {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.value ?? null;
    }

    async function getSettings() {
        if (!isAvailable()) return null;
        const { data, error } = await supabase
            .from('settings')
            .select('*');
        if (error) throw error;
        
        // Convert to object
        const settings = {};
        data.forEach(row => {
            settings[row.key] = row.value;
        });
        return settings;
    }

    async function setSetting(key, value) {
        if (!isAvailable()) return null;
        const { error } = await supabase
            .from('settings')
            .upsert({ key, value }, { onConflict: 'key' });
        if (error) throw error;
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BULK OPERATIONS - For import/export
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Load all data from Supabase
     * Returns data in the same format as localStorage state
     */
    async function loadAllData() {
        if (!isAvailable()) return null;
        
        try {
            const [
                countries,
                publicHolidays,
                roles,
                skills,
                systems,
                teamMembers,
                projects,
                timeOff,
                settings
            ] = await Promise.all([
                getCountries(),
                getPublicHolidays(),
                getRoles(),
                getSkills(),
                getSystems(),
                getTeamMembers(),
                getProjects(),
                getTimeOff(),
                getSettings()
            ]);

            // Transform to app format
            return {
                version: 7,
                lastModified: new Date().toISOString(),
                settings: {
                    bauReserveDays: settings.bau_reserve_days || 5,
                    hoursPerDay: settings.hours_per_day || 8,
                    defaultView: settings.default_view || 'dashboard',
                    quartersToShow: settings.quarters_to_show || 4,
                    defaultCountryId: settings.default_country_code || 'NL',
                    darkMode: settings.dark_mode || false,
                    sprintDurationWeeks: settings.sprint_duration_weeks || 3,
                    sprintStartDate: settings.sprint_start_date || '2026-01-05',
                    sprintsToShow: settings.sprints_to_show || 6,
                    sprintsPerYear: settings.sprints_per_year || 16,
                    byeWeeksAfter: settings.bye_weeks_after || [8, 12],
                    holidayWeeksAtEnd: settings.holiday_weeks_at_end || 2
                },
                countries: countries.map(c => ({
                    id: c.id,
                    code: c.code,
                    name: c.name
                })),
                publicHolidays: publicHolidays.map(h => ({
                    id: h.id,
                    countryId: h.country_id,
                    date: h.date,
                    name: h.name
                })),
                roles: roles.map(r => ({
                    id: r.id,
                    name: r.name
                })),
                skills: skills.map(s => ({
                    id: s.id,
                    name: s.name,
                    category: s.category
                })),
                systems: systems.map(s => ({
                    id: s.id,
                    name: s.name,
                    description: s.description
                })),
                teamMembers: teamMembers.map(m => ({
                    id: m.id,
                    name: m.name,
                    role: m.role_name,
                    countryId: m.country_id,
                    skillIds: m.skill_ids || [],
                    maxConcurrentProjects: m.max_concurrent_projects
                })),
                projects: projects,
                timeOff: timeOff.map(t => ({
                    memberId: t.member_id,
                    quarter: t.quarter,
                    days: t.days,
                    reason: t.reason
                }))
            };
        } catch (error) {
            console.error('[Supabase] Failed to load all data:', error);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════

    return {
        init,
        isAvailable,
        
        // Countries
        getCountries,
        
        // Public Holidays
        getPublicHolidays,
        addPublicHoliday,
        deletePublicHoliday,
        
        // Roles
        getRoles,
        addRole,
        updateRole,
        deleteRole,
        
        // Skills
        getSkills,
        addSkill,
        updateSkill,
        deleteSkill,
        
        // Systems
        getSystems,
        addSystem,
        updateSystem,
        deleteSystem,
        
        // Team Members
        getTeamMembers,
        getTeamMember,
        addTeamMember,
        updateTeamMember,
        deleteTeamMember,
        
        // Projects
        getProjects,
        getProject,
        addProject,
        updateProject,
        deleteProject,
        
        // Phases
        addProjectPhase,
        updateProjectPhase,
        deleteProjectPhase,
        
        // Assignments
        getAssignmentsForMember,
        upsertAssignment,
        deleteAssignment,
        
        // Time Off
        getTimeOff,
        upsertTimeOff,
        deleteTimeOff,
        
        // Settings
        getSetting,
        getSettings,
        setSetting,
        
        // Bulk Operations
        loadAllData
    };
})();
