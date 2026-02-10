    /**
     * ═══════════════════════════════════════════════════════════════════════════════
     * MILEWAY IT CAPACITY PLANNER
     * ═══════════════════════════════════════════════════════════════════════════════
     * 
     * A browser-based capacity planning application for IT resource management.
     * 
     * @version 6.0
     * @author Mileway IT Value Stream Finance
     * 
     * ARCHITECTURE OVERVIEW:
     * - Single-page application using vanilla JavaScript
     * - Modular IIFE pattern for encapsulation
     * - LocalStorage for persistence
     * - No external framework dependencies
     * 
     * MODULE STRUCTURE:
     * - Templates: Reusable HTML components
     * - Icons: SVG icon library
     * - Calendar: Workday calculations
     * - Storage: LocalStorage operations
     * - History: Undo/Redo functionality
     * - Data: CRUD operations
     * - Capacity: Utilization calculations
     * - UI: View rendering
     * - Modal: Dialog management
     * - Export: Import/Export operations
     * ═══════════════════════════════════════════════════════════════════════════════
     */
    const App = (function() {
        'use strict';

        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 1: STATE & CONFIGURATION
           ═══════════════════════════════════════════════════════════════════════════ */
        
        // Application State
        let state = null;
        let whatIfState = null;
        let isWhatIfMode = false;
        let currentView = 'dashboard';
        let currentSettingsSection = 'general';
        let filters = { member: [], system: [], status: [] };
        let projectFilters = { search: '', priority: '', status: '', system: '' };
        let projectViewMode = 'list'; // 'cards' or 'list'
        let projectSort = { field: 'name', direction: 'asc' }; // Sorting for project list
        let teamViewMode = 'current';
        let timelineViewMode = 'quarter'; // 'week', 'month', 'quarter', 'year'
        
        // Constants
        const STORAGE_KEY = 'capacity-planner-data';
        const MAX_HISTORY = 50;
        
        // History State
        let historyStack = [];
        let historyIndex = -1;
        let isUndoRedoAction = false;
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 2: TEMPLATES & ICONS
           Reusable HTML components and SVG icons
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * SVG Icons used throughout the application
         * @type {Object.<string, string>}
         */
        const Icons = {
            plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
            trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
            chevronDown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
            link: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
            search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
            close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
            list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
            arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
        };
        
        /**
         * Reusable HTML template generators
         * @type {Object.<string, Function>}
         */
        const Templates = {
            /**
             * Generate a badge HTML element
             * @param {string} text - Badge text
             * @param {string} type - Badge type (primary, success, warning, danger, gray, high, medium, low, system)
             * @returns {string} HTML string
             */
            badge: (text, type = 'gray') => 
                `<span class="badge badge-${type}">${escapeHtml(text)}</span>`,
            
            /**
             * Generate a priority badge
             * @param {string} priority - Priority level (High, Medium, Low)
             * @returns {string} HTML string
             */
            priorityBadge: (priority) => 
                `<span class="badge badge-${priority.toLowerCase()}">${priority}</span>`,
            
            /**
             * Generate a status badge with appropriate color
             * @param {string} status - Status value
             * @returns {string} HTML string
             */
            statusBadge: (status) => {
                const type = status === 'Active' ? 'success' : status === 'On Hold' ? 'warning' : 'gray';
                return `<span class="badge badge-${type}">${status}</span>`;
            },
            
            /**
             * Generate system badges for a project
             * @param {string[]} systemIds - Array of system IDs
             * @returns {string} HTML string with badges
             */
            systemsBadges: (systemIds) => {
                const st = getState();
                if (!systemIds || systemIds.length === 0) {
                    return '<span class="badge badge-gray">No system</span>';
                }
                const badges = systemIds.map(sysId => {
                    const sys = (st.systems || []).find(s => s.id === sysId);
                    return sys ? `<span class="badge badge-system">${escapeHtml(sys.name)}</span>` : '';
                }).filter(Boolean).join('');
                return `<span class="systems-badges">${badges}</span>`;
            },
            
            /**
             * Generate a skill tag
             * @param {string} name - Skill name
             * @param {string} category - Category (system, process, technical)
             * @returns {string} HTML string
             */
            skillTag: (name, category = '') => 
                `<span class="skill-tag ${category.toLowerCase()}">${escapeHtml(name)}</span>`,
            
            /**
             * Generate an empty state component
             * @param {string} title - Title text
             * @param {string} description - Description text
             * @param {string} [buttonHtml] - Optional button HTML
             * @returns {string} HTML string
             */
            emptyState: (title, description, buttonHtml = '') => `
                <div class="empty-state">
                    <div class="empty-state-title">${escapeHtml(title)}</div>
                    <div class="empty-state-desc">${escapeHtml(description)}</div>
                    ${buttonHtml}
                </div>
            `,
            
            /**
             * Generate a stat card
             * @param {string} label - Card label
             * @param {string|number} value - Card value
             * @param {string} [type] - Card type (success, warning, danger)
             * @returns {string} HTML string
             */
            statCard: (label, value, type = '') => `
                <div class="stat-card ${type}">
                    <div class="stat-label">${label}</div>
                    <div class="stat-value">${value}</div>
                </div>
            `,
            
            /**
             * Generate a form group
             * @param {string} label - Field label
             * @param {string} inputHtml - Input element HTML
             * @returns {string} HTML string
             */
            formGroup: (label, inputHtml) => `
                <div class="form-group">
                    <label class="form-label">${label}</label>
                    ${inputHtml}
                </div>
            `,
            
            /**
             * Generate a select dropdown
             * @param {string} id - Element ID
             * @param {Array<{value: string, label: string}>} options - Options array
             * @param {string} [selected] - Selected value
             * @param {string} [style] - Additional inline styles
             * @returns {string} HTML string
             */
            select: (id, options, selected = '', style = '') => `
                <select class="form-select" id="${id}" ${style ? `style="${style}"` : ''}>
                    ${options.map(o => `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
                </select>
            `
        };
        
        /**
         * Escape HTML special characters to prevent XSS
         * @param {string} text - Text to escape
         * @returns {string} Escaped text
         */
        function escapeHtml(text) {
            if (text == null) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 3: UTILITIES & HELPERS
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Generate quarters array starting from 2026
         * @returns {string[]} Array of quarter strings
         */
        function generateQuarters() {
            const quarters = [];
            const startYear = 2026; // Default start year
            for (let y = startYear; y <= startYear + 3; y++) {
                for (let q = 1; q <= 4; q++) {
                    quarters.push(`Q${q} ${y}`);
                }
            }
            return quarters;
        }
        
        const DEFAULT_STATE = {
            version: 7, // Updated version for sprint support
            lastModified: new Date().toISOString(),
            settings: { 
                bauReserveDays: 5, // BAU reserve in days per quarter
                hoursPerDay: 8,    // Working hours per day
                defaultView: 'dashboard', 
                quartersToShow: 4, 
                msalClientId: '',
                defaultCountryId: 'country-nl',
                darkMode: false,
                // Sprint configuration
                sprintDurationWeeks: 3,        // Duration of each sprint in weeks
                sprintStartDate: '2026-01-05', // First sprint start date (Monday)
                sprintsToShow: 6,              // Number of sprints to display in timeline
                sprintsPerYear: 16,            // Total sprints per year
                byeWeeksAfter: [8, 12],        // Sprint numbers after which bye weeks occur
                holidayWeeksAtEnd: 2           // Holiday weeks at end of year (after last sprint)
            },
            // Countries for public holidays
            countries: [
                { id: 'country-nl', code: 'NL', name: 'Netherlands' },
                { id: 'country-uk', code: 'UK', name: 'United Kingdom' },
                { id: 'country-cz', code: 'CZ', name: 'Czech Republic' },
                { id: 'country-lu', code: 'LU', name: 'Luxembourg' }
            ],
            // Public holidays by country (date format: YYYY-MM-DD)
            publicHolidays: [
                // 2024-2026 Netherlands holidays
                { id: 'hol-nl-1', countryId: 'country-nl', date: '2024-01-01', name: "New Year's Day" },
                { id: 'hol-nl-2', countryId: 'country-nl', date: '2024-03-29', name: 'Good Friday' },
                { id: 'hol-nl-3', countryId: 'country-nl', date: '2024-04-01', name: 'Easter Monday' },
                { id: 'hol-nl-4', countryId: 'country-nl', date: '2024-04-27', name: "King's Day" },
                { id: 'hol-nl-5', countryId: 'country-nl', date: '2024-05-05', name: 'Liberation Day' },
                { id: 'hol-nl-6', countryId: 'country-nl', date: '2024-05-09', name: 'Ascension Day' },
                { id: 'hol-nl-7', countryId: 'country-nl', date: '2024-05-20', name: 'Whit Monday' },
                { id: 'hol-nl-8', countryId: 'country-nl', date: '2024-12-25', name: 'Christmas Day' },
                { id: 'hol-nl-9', countryId: 'country-nl', date: '2024-12-26', name: 'Second Christmas Day' },
                { id: 'hol-nl-10', countryId: 'country-nl', date: '2025-01-01', name: "New Year's Day" },
                { id: 'hol-nl-11', countryId: 'country-nl', date: '2025-04-18', name: 'Good Friday' },
                { id: 'hol-nl-12', countryId: 'country-nl', date: '2025-04-21', name: 'Easter Monday' },
                { id: 'hol-nl-13', countryId: 'country-nl', date: '2025-04-26', name: "King's Day" },
                { id: 'hol-nl-14', countryId: 'country-nl', date: '2025-05-05', name: 'Liberation Day' },
                { id: 'hol-nl-15', countryId: 'country-nl', date: '2025-05-29', name: 'Ascension Day' },
                { id: 'hol-nl-16', countryId: 'country-nl', date: '2025-06-09', name: 'Whit Monday' },
                { id: 'hol-nl-17', countryId: 'country-nl', date: '2025-12-25', name: 'Christmas Day' },
                { id: 'hol-nl-18', countryId: 'country-nl', date: '2025-12-26', name: 'Second Christmas Day' },
                { id: 'hol-nl-19', countryId: 'country-nl', date: '2026-01-01', name: "New Year's Day" },
                { id: 'hol-nl-20', countryId: 'country-nl', date: '2026-04-03', name: 'Good Friday' },
                { id: 'hol-nl-21', countryId: 'country-nl', date: '2026-04-06', name: 'Easter Monday' },
                { id: 'hol-nl-22', countryId: 'country-nl', date: '2026-04-27', name: "King's Day" },
                { id: 'hol-nl-23', countryId: 'country-nl', date: '2026-05-05', name: 'Liberation Day' },
                { id: 'hol-nl-24', countryId: 'country-nl', date: '2026-05-14', name: 'Ascension Day' },
                { id: 'hol-nl-25', countryId: 'country-nl', date: '2026-05-25', name: 'Whit Monday' },
                { id: 'hol-nl-26', countryId: 'country-nl', date: '2026-12-25', name: 'Christmas Day' },
                { id: 'hol-nl-27', countryId: 'country-nl', date: '2026-12-26', name: 'Second Christmas Day' },
                // 2024-2026 UK holidays
                { id: 'hol-uk-1', countryId: 'country-uk', date: '2024-01-01', name: "New Year's Day" },
                { id: 'hol-uk-2', countryId: 'country-uk', date: '2024-03-29', name: 'Good Friday' },
                { id: 'hol-uk-3', countryId: 'country-uk', date: '2024-04-01', name: 'Easter Monday' },
                { id: 'hol-uk-4', countryId: 'country-uk', date: '2024-05-06', name: 'Early May Bank Holiday' },
                { id: 'hol-uk-5', countryId: 'country-uk', date: '2024-05-27', name: 'Spring Bank Holiday' },
                { id: 'hol-uk-6', countryId: 'country-uk', date: '2024-08-26', name: 'Summer Bank Holiday' },
                { id: 'hol-uk-7', countryId: 'country-uk', date: '2024-12-25', name: 'Christmas Day' },
                { id: 'hol-uk-8', countryId: 'country-uk', date: '2024-12-26', name: 'Boxing Day' },
                { id: 'hol-uk-9', countryId: 'country-uk', date: '2025-01-01', name: "New Year's Day" },
                { id: 'hol-uk-10', countryId: 'country-uk', date: '2025-04-18', name: 'Good Friday' },
                { id: 'hol-uk-11', countryId: 'country-uk', date: '2025-04-21', name: 'Easter Monday' },
                { id: 'hol-uk-12', countryId: 'country-uk', date: '2025-05-05', name: 'Early May Bank Holiday' },
                { id: 'hol-uk-13', countryId: 'country-uk', date: '2025-05-26', name: 'Spring Bank Holiday' },
                { id: 'hol-uk-14', countryId: 'country-uk', date: '2025-08-25', name: 'Summer Bank Holiday' },
                { id: 'hol-uk-15', countryId: 'country-uk', date: '2025-12-25', name: 'Christmas Day' },
                { id: 'hol-uk-16', countryId: 'country-uk', date: '2025-12-26', name: 'Boxing Day' },
                // 2024-2026 Czech Republic holidays
                { id: 'hol-cz-1', countryId: 'country-cz', date: '2024-01-01', name: "New Year's Day" },
                { id: 'hol-cz-2', countryId: 'country-cz', date: '2024-03-29', name: 'Good Friday' },
                { id: 'hol-cz-3', countryId: 'country-cz', date: '2024-04-01', name: 'Easter Monday' },
                { id: 'hol-cz-4', countryId: 'country-cz', date: '2024-05-01', name: 'Labour Day' },
                { id: 'hol-cz-5', countryId: 'country-cz', date: '2024-05-08', name: 'Victory Day' },
                { id: 'hol-cz-6', countryId: 'country-cz', date: '2024-07-05', name: 'Saints Cyril and Methodius Day' },
                { id: 'hol-cz-7', countryId: 'country-cz', date: '2024-07-06', name: 'Jan Hus Day' },
                { id: 'hol-cz-8', countryId: 'country-cz', date: '2024-09-28', name: 'Czech Statehood Day' },
                { id: 'hol-cz-9', countryId: 'country-cz', date: '2024-10-28', name: 'Independence Day' },
                { id: 'hol-cz-10', countryId: 'country-cz', date: '2024-11-17', name: 'Freedom and Democracy Day' },
                { id: 'hol-cz-11', countryId: 'country-cz', date: '2024-12-24', name: 'Christmas Eve' },
                { id: 'hol-cz-12', countryId: 'country-cz', date: '2024-12-25', name: 'Christmas Day' },
                { id: 'hol-cz-13', countryId: 'country-cz', date: '2024-12-26', name: "St. Stephen's Day" },
                { id: 'hol-cz-14', countryId: 'country-cz', date: '2025-01-01', name: "New Year's Day" },
                { id: 'hol-cz-15', countryId: 'country-cz', date: '2025-04-18', name: 'Good Friday' },
                { id: 'hol-cz-16', countryId: 'country-cz', date: '2025-04-21', name: 'Easter Monday' },
                { id: 'hol-cz-17', countryId: 'country-cz', date: '2025-05-01', name: 'Labour Day' },
                { id: 'hol-cz-18', countryId: 'country-cz', date: '2025-05-08', name: 'Victory Day' },
                { id: 'hol-cz-19', countryId: 'country-cz', date: '2025-12-24', name: 'Christmas Eve' },
                { id: 'hol-cz-20', countryId: 'country-cz', date: '2025-12-25', name: 'Christmas Day' },
                { id: 'hol-cz-21', countryId: 'country-cz', date: '2025-12-26', name: "St. Stephen's Day" },
                // 2024-2026 Luxembourg holidays
                { id: 'hol-lu-1', countryId: 'country-lu', date: '2024-01-01', name: "New Year's Day" },
                { id: 'hol-lu-2', countryId: 'country-lu', date: '2024-04-01', name: 'Easter Monday' },
                { id: 'hol-lu-3', countryId: 'country-lu', date: '2024-05-01', name: 'Labour Day' },
                { id: 'hol-lu-4', countryId: 'country-lu', date: '2024-05-09', name: 'Europe Day' },
                { id: 'hol-lu-5', countryId: 'country-lu', date: '2024-05-09', name: 'Ascension Day' },
                { id: 'hol-lu-6', countryId: 'country-lu', date: '2024-05-20', name: 'Whit Monday' },
                { id: 'hol-lu-7', countryId: 'country-lu', date: '2024-06-23', name: 'National Day' },
                { id: 'hol-lu-8', countryId: 'country-lu', date: '2024-08-15', name: 'Assumption Day' },
                { id: 'hol-lu-9', countryId: 'country-lu', date: '2024-11-01', name: "All Saints' Day" },
                { id: 'hol-lu-10', countryId: 'country-lu', date: '2024-12-25', name: 'Christmas Day' },
                { id: 'hol-lu-11', countryId: 'country-lu', date: '2024-12-26', name: "St. Stephen's Day" },
                { id: 'hol-lu-12', countryId: 'country-lu', date: '2025-01-01', name: "New Year's Day" },
                { id: 'hol-lu-13', countryId: 'country-lu', date: '2025-04-21', name: 'Easter Monday' },
                { id: 'hol-lu-14', countryId: 'country-lu', date: '2025-05-01', name: 'Labour Day' },
                { id: 'hol-lu-15', countryId: 'country-lu', date: '2025-05-29', name: 'Ascension Day' },
                { id: 'hol-lu-16', countryId: 'country-lu', date: '2025-06-09', name: 'Whit Monday' },
                { id: 'hol-lu-17', countryId: 'country-lu', date: '2025-06-23', name: 'National Day' },
                { id: 'hol-lu-18', countryId: 'country-lu', date: '2025-12-25', name: 'Christmas Day' },
                { id: 'hol-lu-19', countryId: 'country-lu', date: '2025-12-26', name: "St. Stephen's Day" }
            ],
            roles: [
                { id: 'role-1', name: 'Service Manager' },
                { id: 'role-2', name: 'ERP Specialist' },
                { id: 'role-3', name: 'Manager ERP' },
                { id: 'role-4', name: 'TMS Specialist' },
                { id: 'role-5', name: 'iWMS Specialist' },
                { id: 'role-6', name: 'EPM Specialist' }
            ],
            skills: [
                { id: 'skill-1', name: 'SAP ECC', category: 'System' },
                { id: 'skill-2', name: 'SAP S/4HANA', category: 'System' },
                { id: 'skill-3', name: 'Yardi Voyager', category: 'System' },
                { id: 'skill-4', name: 'FIS Integrity', category: 'System' },
                { id: 'skill-5', name: 'Planon', category: 'System' },
                { id: 'skill-6', name: 'OneStream', category: 'System' },
                { id: 'skill-7', name: 'Basware', category: 'System' },
                { id: 'skill-8', name: 'Treasury Management', category: 'Process' },
                { id: 'skill-9', name: 'Financial Close', category: 'Process' },
                { id: 'skill-10', name: 'P2P Process', category: 'Process' },
                { id: 'skill-11', name: 'Integration/API', category: 'Technical' },
                { id: 'skill-12', name: 'Data Migration', category: 'Technical' },
                { id: 'skill-13', name: 'Testing', category: 'Technical' }
            ],
            // Systems - Applications that are implemented/changed
            systems: [
                { id: 'sys-1', name: 'ERP', description: 'Enterprise Resource Planning' },
                { id: 'sys-2', name: 'TMS', description: 'Treasury Management System' },
                { id: 'sys-3', name: 'iWMS', description: 'Integrated Workplace Management System' },
                { id: 'sys-4', name: 'EPM', description: 'Enterprise Performance Management' },
                { id: 'sys-5', name: 'Multi', description: 'Multiple Systems' }
            ],
            teamMembers: [
                { id: 'member-1', name: 'Dennis', role: 'Service Manager', countryId: 'country-nl', skillIds: ['skill-1','skill-2','skill-3','skill-4','skill-5','skill-6','skill-7','skill-8','skill-9','skill-10','skill-11','skill-12','skill-13'], maxConcurrentProjects: 4 },
                { id: 'member-2', name: 'ERP Specialist 1', role: 'ERP Specialist', countryId: 'country-nl', skillIds: ['skill-1','skill-2','skill-3','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-3', name: 'ERP Specialist 2', role: 'ERP Specialist', countryId: 'country-nl', skillIds: ['skill-1','skill-2','skill-3','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-4', name: 'ERP Manager', role: 'Manager ERP', countryId: 'country-nl', skillIds: ['skill-1','skill-2','skill-3','skill-11','skill-12'], maxConcurrentProjects: 3 },
                { id: 'member-5', name: 'ERP Specialist 3', role: 'ERP Specialist', countryId: 'country-nl', skillIds: ['skill-1','skill-2','skill-3','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-6', name: 'TMS Specialist 1', role: 'TMS Specialist', countryId: 'country-nl', skillIds: ['skill-4','skill-8','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-7', name: 'TMS Specialist 2', role: 'TMS Specialist', countryId: 'country-nl', skillIds: ['skill-4','skill-8','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-8', name: 'iWMS Specialist 1', role: 'iWMS Specialist', countryId: 'country-cz', skillIds: ['skill-5','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-9', name: 'iWMS Specialist 2', role: 'iWMS Specialist', countryId: 'country-cz', skillIds: ['skill-5','skill-11'], maxConcurrentProjects: 2 },
                { id: 'member-10', name: 'EPM Specialist', role: 'EPM Specialist', countryId: 'country-uk', skillIds: ['skill-6','skill-9'], maxConcurrentProjects: 2 }
            ],
            projects: [],  // Assignments now use { memberId, quarter, days: 12.5 } instead of allocation percentage
            timeOff: [],   // Time off now uses { memberId, quarter, days: 5, reason: '' }
            quarters: generateQuarters()
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 4: CALENDAR MODULE
           Workday calculations with country-specific holidays
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Calendar module for workday calculations
         * Handles weekends, public holidays, and quarter parsing
         */
        const Calendar = {
            log: (msg, data) => console.log(`[Calendar] ${msg}`, data || ''),
            
            // Parse quarter string to date range
            parseQuarter(quarterStr) {
                const match = quarterStr.match(/Q(\d)\s+(\d{4})/);
                if (!match) return null;
                const q = parseInt(match[1]);
                const year = parseInt(match[2]);
                const startMonth = (q - 1) * 3;
                const startDate = new Date(year, startMonth, 1);
                const endDate = new Date(year, startMonth + 3, 0); // Last day of quarter
                return { start: startDate, end: endDate, quarter: q, year };
            },
            
            // Check if a date is a weekend
            isWeekend(date) {
                const day = date.getDay();
                return day === 0 || day === 6; // Sunday or Saturday
            },
            
            // Check if a date is a public holiday
            isPublicHoliday(date, holidays) {
                const dateStr = date.toISOString().split('T')[0];
                return holidays.some(h => h.date === dateStr);
            },
            
            // Get holidays for a specific country
            getHolidaysByCountry(countryId) {
                const st = getState();
                return (st.publicHolidays || []).filter(h => h.countryId === countryId);
            },
            
            // Get holidays for a specific member (by their country)
            getHolidaysForMember(memberId) {
                const st = getState();
                const member = st.teamMembers.find(m => m.id === memberId);
                const countryId = member?.countryId || st.settings.defaultCountryId || 'country-nl';
                return this.getHolidaysByCountry(countryId);
            },
            
            // Get workdays in a quarter (excluding weekends and holidays)
            getWorkdaysInQuarter(quarterStr, holidays = []) {
                const range = this.parseQuarter(quarterStr);
                if (!range) return 0;
                
                let workdays = 0;
                const current = new Date(range.start);
                
                while (current <= range.end) {
                    if (!this.isWeekend(current) && !this.isPublicHoliday(current, holidays)) {
                        workdays++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                
                return workdays;
            },
            
            // Get workdays for a specific member in a quarter
            getWorkdaysForMember(memberId, quarterStr) {
                const holidays = this.getHolidaysForMember(memberId);
                return this.getWorkdaysInQuarter(quarterStr, holidays);
            },
            
            // Get quarter breakdown for a specific member
            getQuarterBreakdownForMember(memberId, quarterStr) {
                const holidays = this.getHolidaysForMember(memberId);
                return this.getQuarterBreakdown(quarterStr, holidays);
            },
            
            // Get holidays in a specific quarter
            getHolidaysInQuarter(quarterStr, holidays = []) {
                const range = this.parseQuarter(quarterStr);
                if (!range) return [];
                
                return holidays.filter(h => {
                    const hDate = new Date(h.date);
                    return hDate >= range.start && hDate <= range.end;
                });
            },
            
            // Get detailed breakdown for a quarter
            getQuarterBreakdown(quarterStr, holidays = []) {
                const range = this.parseQuarter(quarterStr);
                if (!range) return null;
                
                let totalDays = 0;
                let weekendDays = 0;
                let holidayDays = 0;
                const current = new Date(range.start);
                
                while (current <= range.end) {
                    totalDays++;
                    if (this.isWeekend(current)) {
                        weekendDays++;
                    } else if (this.isPublicHoliday(current, holidays)) {
                        holidayDays++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                
                const workdays = totalDays - weekendDays - holidayDays;
                
                return {
                    quarter: quarterStr,
                    totalDays,
                    weekendDays,
                    holidayDays,
                    workdays,
                    holidays: this.getHolidaysInQuarter(quarterStr, holidays)
                };
            },
            
            // Format days for display (with hours if half day)
            formatDays(days, hoursPerDay = 8) {
                if (days === Math.floor(days)) {
                    return `${days}d`;
                } else {
                    return `${days}d`;
                }
            },
            
            // Format days with percentage
            formatDaysWithPercent(days, totalDays) {
                const percent = totalDays > 0 ? Math.round((days / totalDays) * 100) : 0;
                return `${days}d (${percent}%)`;
            },
            
            /* ═══════════════════════════════════════════════════════════════════════════
               TIME PERIOD PARSING - Week, Month, Quarter, Year
               ═══════════════════════════════════════════════════════════════════════════ */
            
            /**
             * Parse a week string (e.g., "W1 2026") to date range
             * Uses ISO week definition (Monday-Sunday)
             * @param {string} weekStr - Week string in format "W## YYYY"
             * @returns {Object|null} Date range object with start, end, week, year
             */
            parseWeek(weekStr) {
                const match = weekStr.match(/W(\d+)\s+(\d{4})/);
                if (!match) return null;
                const week = parseInt(match[1]);
                const year = parseInt(match[2]);
                // Get the first day of the year
                const jan1 = new Date(year, 0, 1);
                // Find the first Monday of the year (ISO week 1 contains Jan 4)
                const jan4 = new Date(year, 0, 4);
                const dayOfWeek = jan4.getDay() || 7; // Convert Sunday from 0 to 7
                const firstMonday = new Date(jan4);
                firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
                // Calculate start of requested week
                const startDate = new Date(firstMonday);
                startDate.setDate(firstMonday.getDate() + (week - 1) * 7);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6); // Sunday
                return { start: startDate, end: endDate, week, year };
            },
            
            /**
             * Get ISO week number for a date
             * @param {Date} date - Date to get week number for
             * @returns {Object} Object with week number and year
             */
            getISOWeek(date) {
                const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                const dayNum = d.getUTCDay() || 7;
                d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                return { week: weekNo, year: d.getUTCFullYear() };
            },
            
            /**
             * Parse a month string (e.g., "Jan 2026") to date range
             * @param {string} monthStr - Month string in format "MMM YYYY"
             * @returns {Object|null} Date range object with start, end, month, year
             */
            parseMonth(monthStr) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const match = monthStr.match(/([A-Za-z]+)\s+(\d{4})/);
                if (!match) return null;
                const monthName = match[1];
                const year = parseInt(match[2]);
                const monthIdx = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase().slice(0, 3));
                if (monthIdx === -1) return null;
                const startDate = new Date(year, monthIdx, 1);
                const endDate = new Date(year, monthIdx + 1, 0); // Last day of month
                return { start: startDate, end: endDate, month: monthIdx + 1, monthName: monthNames[monthIdx], year };
            },
            
            /**
             * Parse a year string (e.g., "2026") to date range
             * @param {string} yearStr - Year string in format "YYYY"
             * @returns {Object|null} Date range object with start, end, year
             */
            parseYear(yearStr) {
                const match = yearStr.match(/^(\d{4})$/);
                if (!match) return null;
                const year = parseInt(match[1]);
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                return { start: startDate, end: endDate, year };
            },
            
            /**
             * Parse any period string (auto-detect type)
             * @param {string} periodStr - Period string (26-01, W1 2026, Jan 2026, Q1 2026, or 2026)
             * @returns {Object|null} Date range with type
             */
            parsePeriod(periodStr) {
                if (!periodStr) return null;
                const str = periodStr.trim();
                // Try sprint YY-XX format (e.g., "26-01", "26-08")
                if (/^\d{2}-\d{2}$/.test(str)) {
                    const result = this.parseSprint(str);
                    return result ? { ...result, type: 'sprint', label: str } : null;
                }
                // Try week (W## YYYY)
                if (/^W\d+\s+\d{4}$/.test(str)) {
                    const result = this.parseWeek(str);
                    return result ? { ...result, type: 'week', label: str } : null;
                }
                // Try quarter (Q# YYYY)
                if (/^Q\d\s+\d{4}$/.test(str)) {
                    const result = this.parseQuarter(str);
                    return result ? { ...result, type: 'quarter', label: str } : null;
                }
                // Try year (YYYY)
                if (/^\d{4}$/.test(str)) {
                    const result = this.parseYear(str);
                    return result ? { ...result, type: 'year', label: str } : null;
                }
                // Try month (MMM YYYY)
                const result = this.parseMonth(str);
                return result ? { ...result, type: 'month', label: str } : null;
            },
            
            /* ═══════════════════════════════════════════════════════════════════════════
               SPRINT FUNCTIONS - Custom sprint calendar with bye weeks
               Format: YY-XX (e.g., "26-01", "26-08")
               Supports: 16 sprints/year, bye weeks after S8 and S12, holiday weeks at end
               ═══════════════════════════════════════════════════════════════════════════ */
            
            /**
             * Parse a sprint string (e.g., "26-01", "26-08") to date range
             * Uses sprint configuration from settings including bye weeks
             * @param {string} sprintStr - Sprint string in format "YY-XX"
             * @returns {Object|null} Date range object with start, end, sprint number, year
             */
            parseSprint(sprintStr) {
                // Match YY-XX format (e.g., "26-01", "26-12")
                const match = sprintStr.match(/^(\d{2})-(\d{2})$/);
                if (!match) return null;
                
                const yearShort = parseInt(match[1]);
                const sprintNum = parseInt(match[2]);
                const year = 2000 + yearShort;
                
                const st = getState();
                const settings = st.settings;
                const durationWeeks = settings.sprintDurationWeeks || 3;
                const baseStartDateStr = settings.sprintStartDate || '2026-01-05';
                const byeWeeksAfter = settings.byeWeeksAfter || [8, 12];
                const sprintsPerYear = settings.sprintsPerYear || 16;
                
                // Parse the base start date and calculate year's start
                const baseStartDate = new Date(baseStartDateStr);
                const baseYear = baseStartDate.getFullYear();
                
                // Calculate the first sprint start for the requested year
                const yearOffset = year - baseYear;
                const yearStartDate = new Date(baseStartDate);
                yearStartDate.setFullYear(baseStartDate.getFullYear() + yearOffset);
                
                // Calculate weeks offset for this sprint, accounting for bye weeks
                let totalWeeksOffset = 0;
                for (let s = 1; s < sprintNum; s++) {
                    totalWeeksOffset += durationWeeks;
                    // Add bye week if this sprint is followed by one
                    if (byeWeeksAfter.includes(s)) {
                        totalWeeksOffset += 1;
                    }
                }
                
                const sprintStartDate = new Date(yearStartDate);
                sprintStartDate.setDate(yearStartDate.getDate() + totalWeeksOffset * 7);
                
                const sprintEndDate = new Date(sprintStartDate);
                sprintEndDate.setDate(sprintStartDate.getDate() + (durationWeeks * 7) - 1);
                
                return { 
                    start: sprintStartDate, 
                    end: sprintEndDate, 
                    sprint: sprintNum,
                    year: year,
                    yearShort: yearShort,
                    durationWeeks,
                    label: sprintStr
                };
            },
            
            /**
             * Get sprint info for a given date
             * @param {Date} date - Date to find sprint for
             * @returns {Object} Object with sprint number and year
             */
            getSprintForDate(date) {
                const st = getState();
                const settings = st.settings;
                const durationWeeks = settings.sprintDurationWeeks || 3;
                const baseStartDateStr = settings.sprintStartDate || '2026-01-05';
                const byeWeeksAfter = settings.byeWeeksAfter || [8, 12];
                const sprintsPerYear = settings.sprintsPerYear || 16;
                
                const baseStartDate = new Date(baseStartDateStr);
                const baseYear = baseStartDate.getFullYear();
                
                // Determine which year this date falls in
                const dateYear = date.getFullYear();
                const yearOffset = dateYear - baseYear;
                
                // Get the first sprint start for this year
                const yearStartDate = new Date(baseStartDate);
                yearStartDate.setFullYear(baseYear + yearOffset);
                
                // If date is before this year's first sprint, check previous year
                if (date < yearStartDate && yearOffset > 0) {
                    return this.getSprintForDate(new Date(date.getFullYear() - 1, date.getMonth(), date.getDate()));
                }
                
                // Calculate which sprint this date falls in
                const diffTime = date - yearStartDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                // Walk through sprints to find the right one
                let dayCount = 0;
                for (let s = 1; s <= sprintsPerYear; s++) {
                    const sprintDays = durationWeeks * 7;
                    if (diffDays >= dayCount && diffDays < dayCount + sprintDays) {
                        return { sprint: s, year: dateYear };
                    }
                    dayCount += sprintDays;
                    // Add bye week days
                    if (byeWeeksAfter.includes(s)) {
                        if (diffDays >= dayCount && diffDays < dayCount + 7) {
                            // Date is in a bye week - return the previous sprint
                            return { sprint: s, year: dateYear, isByeWeek: true };
                        }
                        dayCount += 7;
                    }
                }
                
                // After all sprints (holiday period)
                return { sprint: sprintsPerYear, year: dateYear, isHolidayPeriod: true };
            },
            
            /**
             * Get workdays in a sprint
             * @param {string} sprintStr - Sprint string in format "YY-XX"
             * @param {Array} holidays - Array of holiday objects
             * @returns {number} Number of workdays
             */
            getWorkdaysInSprint(sprintStr, holidays = []) {
                const range = this.parseSprint(sprintStr);
                if (!range) return 0;
                let workdays = 0;
                const current = new Date(range.start);
                while (current <= range.end) {
                    if (!this.isWeekend(current) && !this.isPublicHoliday(current, holidays)) {
                        workdays++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                return workdays;
            },
            
            /**
             * Generate array of sprints for display
             * @param {number} count - Number of sprints to generate
             * @param {number} [startYear] - Starting year (default: from settings)
             * @param {number} [startSprint=1] - Starting sprint number within year
             * @returns {string[]} Array of sprint strings in YY-XX format
             */
            generateSprints(count, startYear = null, startSprint = 1) {
                const st = getState();
                const settings = st.settings;
                const sprintsPerYear = settings.sprintsPerYear || 16;
                const baseStartDateStr = settings.sprintStartDate || '2026-01-05';
                
                if (!startYear) {
                    const baseStartDate = new Date(baseStartDateStr);
                    startYear = baseStartDate.getFullYear();
                }
                
                const sprints = [];
                let currentYear = startYear;
                let currentSprint = startSprint;
                
                for (let i = 0; i < count; i++) {
                    const yearShort = String(currentYear).slice(-2);
                    const sprintPadded = String(currentSprint).padStart(2, '0');
                    sprints.push(`${yearShort}-${sprintPadded}`);
                    
                    currentSprint++;
                    if (currentSprint > sprintsPerYear) {
                        currentSprint = 1;
                        currentYear++;
                    }
                }
                
                return sprints;
            },
            
            /**
             * Get the quarter that contains a sprint
             * @param {string} sprintStr - Sprint string
             * @returns {string|null} Quarter string or null
             */
            sprintToQuarter(sprintStr) {
                const sprintData = this.parseSprint(sprintStr);
                if (!sprintData) return null;
                // Use middle of sprint for quarter determination
                const midDate = new Date((sprintData.start.getTime() + sprintData.end.getTime()) / 2);
                const quarter = Math.floor(midDate.getMonth() / 3) + 1;
                return `Q${quarter} ${midDate.getFullYear()}`;
            },
            
            /**
             * Get all quarters that a sprint overlaps with
             * @param {string} sprintStr - Sprint string
             * @returns {string[]} Array of quarter strings
             */
            sprintToQuarters(sprintStr) {
                const sprintData = this.parseSprint(sprintStr);
                if (!sprintData) return [];
                const quarters = new Set();
                const current = new Date(sprintData.start);
                while (current <= sprintData.end) {
                    const q = Math.floor(current.getMonth() / 3) + 1;
                    quarters.add(`Q${q} ${current.getFullYear()}`);
                    current.setDate(current.getDate() + 7); // Check weekly
                }
                return Array.from(quarters);
            },
            
            /**
             * Format sprint date range for display
             * @param {string} sprintStr - Sprint string
             * @returns {string} Formatted date range
             */
            formatSprintDates(sprintStr) {
                const sprintData = this.parseSprint(sprintStr);
                if (!sprintData) return '';
                const options = { month: 'short', day: 'numeric' };
                const startStr = sprintData.start.toLocaleDateString('en-US', options);
                const endStr = sprintData.end.toLocaleDateString('en-US', options);
                return `${startStr} - ${endStr}`;
            },
            
            /**
             * Get sprint label for display
             * @param {string} sprintStr - Sprint string
             * @returns {Object} Object with label and parent (quarter)
             */
            getSprintLabel(sprintStr) {
                const sprintData = this.parseSprint(sprintStr);
                if (!sprintData) return { label: sprintStr, parent: '' };
                const quarter = this.sprintToQuarter(sprintStr);
                const dateRange = this.formatSprintDates(sprintStr);
                return {
                    label: sprintStr,
                    parent: quarter || '',
                    dateRange
                };
            },
            
            /**
             * Check if a sprint has a bye week after it
             * @param {string} sprintStr - Sprint string
             * @returns {boolean} True if bye week follows
             */
            hasByeWeekAfter(sprintStr) {
                const sprintData = this.parseSprint(sprintStr);
                if (!sprintData) return false;
                const st = getState();
                const byeWeeksAfter = st.settings.byeWeeksAfter || [8, 12];
                return byeWeeksAfter.includes(sprintData.sprint);
            },
            
            /**
             * Get workdays in a week
             * @param {string} weekStr - Week string in format "W## YYYY"
             * @param {Array} holidays - Array of holiday objects
             * @returns {number} Number of workdays
             */
            getWorkdaysInWeek(weekStr, holidays = []) {
                const range = this.parseWeek(weekStr);
                if (!range) return 0;
                let workdays = 0;
                const current = new Date(range.start);
                while (current <= range.end) {
                    if (!this.isWeekend(current) && !this.isPublicHoliday(current, holidays)) {
                        workdays++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                return workdays;
            },
            
            /**
             * Get workdays in a month
             * @param {string} monthStr - Month string in format "MMM YYYY"
             * @param {Array} holidays - Array of holiday objects
             * @returns {number} Number of workdays
             */
            getWorkdaysInMonth(monthStr, holidays = []) {
                const range = this.parseMonth(monthStr);
                if (!range) return 0;
                let workdays = 0;
                const current = new Date(range.start);
                while (current <= range.end) {
                    if (!this.isWeekend(current) && !this.isPublicHoliday(current, holidays)) {
                        workdays++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                return workdays;
            },
            
            /**
             * Get workdays in a year
             * @param {string} yearStr - Year string in format "YYYY"
             * @param {Array} holidays - Array of holiday objects
             * @returns {number} Number of workdays
             */
            getWorkdaysInYear(yearStr, holidays = []) {
                const range = this.parseYear(yearStr);
                if (!range) return 0;
                let workdays = 0;
                const current = new Date(range.start);
                while (current <= range.end) {
                    if (!this.isWeekend(current) && !this.isPublicHoliday(current, holidays)) {
                        workdays++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                return workdays;
            },
            
            /**
             * Get workdays for any period type
             * @param {string} periodStr - Period string
             * @param {Array} holidays - Array of holiday objects
             * @returns {number} Number of workdays
             */
            getWorkdaysInPeriod(periodStr, holidays = []) {
                const period = this.parsePeriod(periodStr);
                if (!period) return 0;
                switch (period.type) {
                    case 'sprint': return this.getWorkdaysInSprint(periodStr, holidays);
                    case 'week': return this.getWorkdaysInWeek(periodStr, holidays);
                    case 'month': return this.getWorkdaysInMonth(periodStr, holidays);
                    case 'quarter': return this.getWorkdaysInQuarter(periodStr, holidays);
                    case 'year': return this.getWorkdaysInYear(periodStr, holidays);
                    default: return 0;
                }
            },
            
            /**
             * Generate array of weeks for a given year
             * @param {number} year - Year
             * @returns {string[]} Array of week strings
             */
            generateWeeks(year) {
                const weeks = [];
                // Get the last day of the year to determine total weeks
                const dec28 = new Date(year, 11, 28);
                const lastWeek = this.getISOWeek(dec28);
                const totalWeeks = lastWeek.year === year ? lastWeek.week : 52;
                for (let w = 1; w <= totalWeeks; w++) {
                    weeks.push(`W${w} ${year}`);
                }
                return weeks;
            },
            
            /**
             * Generate array of months for a given year
             * @param {number} year - Year
             * @returns {string[]} Array of month strings
             */
            generateMonths(year) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return monthNames.map(m => `${m} ${year}`);
            },
            
            /**
             * Generate array of quarters for a given year
             * @param {number} year - Year
             * @returns {string[]} Array of quarter strings
             */
            generateQuartersForYear(year) {
                return [1, 2, 3, 4].map(q => `Q${q} ${year}`);
            },
            
            /**
             * Generate periods based on view mode and time range
             * @param {string} viewMode - 'sprint', 'week', 'month', 'quarter', 'year'
             * @param {number} count - Number of periods to generate
             * @param {Date} [startFrom] - Optional start date (defaults to current)
             * @returns {string[]} Array of period strings
             */
            generatePeriods(viewMode, count, startFrom = new Date()) {
                const periods = [];
                const startYear = startFrom.getFullYear();
                const startMonth = startFrom.getMonth();
                const startWeekInfo = this.getISOWeek(startFrom);
                
                switch (viewMode) {
                    case 'sprint': {
                        // Use the generateSprints function which handles YY-XX format
                        return this.generateSprints(count, startYear, 1);
                    }
                    case 'week': {
                        let year = startWeekInfo.year;
                        let week = startWeekInfo.week;
                        for (let i = 0; i < count; i++) {
                            periods.push(`W${week} ${year}`);
                            week++;
                            const lastWeekOfYear = this.getISOWeek(new Date(year, 11, 28)).week;
                            if (week > lastWeekOfYear) {
                                week = 1;
                                year++;
                            }
                        }
                        break;
                    }
                    case 'month': {
                        let year = startYear;
                        let month = startMonth;
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        for (let i = 0; i < count; i++) {
                            periods.push(`${monthNames[month]} ${year}`);
                            month++;
                            if (month > 11) {
                                month = 0;
                                year++;
                            }
                        }
                        break;
                    }
                    case 'quarter': {
                        let year = startYear;
                        let quarter = Math.floor(startMonth / 3) + 1;
                        for (let i = 0; i < count; i++) {
                            periods.push(`Q${quarter} ${year}`);
                            quarter++;
                            if (quarter > 4) {
                                quarter = 1;
                                year++;
                            }
                        }
                        break;
                    }
                    case 'year': {
                        for (let i = 0; i < count; i++) {
                            periods.push(`${startYear + i}`);
                        }
                        break;
                    }
                }
                return periods;
            },
            
            /**
             * Check if a date falls within a period
             * @param {Date} date - Date to check
             * @param {string} periodStr - Period string
             * @returns {boolean} True if date is within period
             */
            isDateInPeriod(date, periodStr) {
                const period = this.parsePeriod(periodStr);
                if (!period) return false;
                return date >= period.start && date <= period.end;
            },
            
            /**
             * Get the quarter that contains a given period
             * @param {string} periodStr - Period string (week or month)
             * @returns {string|null} Quarter string or null
             */
            periodToQuarter(periodStr) {
                const period = this.parsePeriod(periodStr);
                if (!period) return null;
                const midDate = new Date((period.start.getTime() + period.end.getTime()) / 2);
                const quarter = Math.floor(midDate.getMonth() / 3) + 1;
                return `Q${quarter} ${midDate.getFullYear()}`;
            },
            
            /**
             * Get the quarters that overlap with a period
             * @param {string} periodStr - Period string
             * @returns {string[]} Array of quarter strings
             */
            periodToQuarters(periodStr) {
                const period = this.parsePeriod(periodStr);
                if (!period) return [];
                const quarters = new Set();
                const current = new Date(period.start);
                while (current <= period.end) {
                    const q = Math.floor(current.getMonth() / 3) + 1;
                    quarters.add(`Q${q} ${current.getFullYear()}`);
                    current.setMonth(current.getMonth() + 1);
                }
                return Array.from(quarters);
            },
            
            /**
             * Check if two periods overlap
             * @param {string} period1 - First period string
             * @param {string} period2 - Second period string
             * @returns {boolean} True if periods overlap
             */
            periodsOverlap(period1, period2) {
                const p1 = this.parsePeriod(period1);
                const p2 = this.parsePeriod(period2);
                if (!p1 || !p2) return false;
                return p1.start <= p2.end && p2.start <= p1.end;
            },
            
            /**
             * Get period label for display
             * @param {string} periodStr - Period string
             * @param {string} viewMode - View mode for context
             * @returns {Object} Object with label and parent label
             */
            getPeriodLabel(periodStr, viewMode) {
                const period = this.parsePeriod(periodStr);
                if (!period) return { label: periodStr, parent: '' };
                
                switch (viewMode) {
                    case 'sprint': {
                        const sprintLabel = this.getSprintLabel(periodStr);
                        return { 
                            label: sprintLabel.label, 
                            parent: sprintLabel.parent,
                            dateRange: sprintLabel.dateRange
                        };
                    }
                    case 'week': {
                        const quarterNum = Math.floor(period.start.getMonth() / 3) + 1;
                        return { 
                            label: `W${period.week}`, 
                            parent: `Q${quarterNum} ${period.year}` 
                        };
                    }
                    case 'month': {
                        return { 
                            label: period.monthName, 
                            parent: `${period.year}` 
                        };
                    }
                    case 'quarter': {
                        return { 
                            label: periodStr, 
                            parent: '' 
                        };
                    }
                    case 'year': {
                        return { 
                            label: periodStr, 
                            parent: '' 
                        };
                    }
                    default:
                        return { label: periodStr, parent: '' };
                }
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 5: STORAGE MODULE
           LocalStorage persistence and data migration
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Storage module for LocalStorage operations
         * Handles save, load, and data migration
         */
        const Storage = {
            log: (msg, data) => console.log(`[Storage] ${msg}`, data || ''),
            load() {
                this.log('Loading from localStorage');
                try {
                    const data = localStorage.getItem(STORAGE_KEY);
                    if (data) {
                        const parsed = JSON.parse(data);
                        this.log('Loaded', { version: parsed.version });
                        // Migrate data from older versions
                        return this.migrate(parsed);
                    }
                } catch (e) { this.log('Error loading', e); }
                return null;
            },
            // Migrate old data to current version
            migrate(data) {
                // Ensure countries array exists (added in v4)
                if (!data.countries) {
                    this.log('Migrating: Adding default countries');
                    data.countries = [
                        { id: 'country-nl', code: 'NL', name: 'Netherlands' },
                        { id: 'country-uk', code: 'UK', name: 'United Kingdom' },
                        { id: 'country-cz', code: 'CZ', name: 'Czech Republic' },
                        { id: 'country-lu', code: 'LU', name: 'Luxembourg' }
                    ];
                }
                // Ensure team members have countryId (added in v4)
                if (data.teamMembers) {
                    data.teamMembers.forEach(m => {
                        if (!m.countryId) m.countryId = 'country-nl'; // Default to NL
                    });
                }
                // Ensure publicHolidays have countryId (added in v4)
                if (data.publicHolidays) {
                    data.publicHolidays.forEach(h => {
                        if (!h.countryId) h.countryId = 'country-nl'; // Default to NL
                    });
                }
                // Ensure settings has defaultCountryId
                if (data.settings && !data.settings.defaultCountryId) {
                    data.settings.defaultCountryId = 'country-nl';
                }
                // Ensure settings has darkMode flag
                if (data.settings && typeof data.settings.darkMode === 'undefined') {
                    data.settings.darkMode = false;
                }
                // Ensure systems array exists (added in v5)
                if (!data.systems) {
                    this.log('Migrating: Adding default systems');
                    data.systems = [
                        { id: 'sys-1', name: 'ERP', description: 'Enterprise Resource Planning' },
                        { id: 'sys-2', name: 'TMS', description: 'Treasury Management System' },
                        { id: 'sys-3', name: 'iWMS', description: 'Integrated Workplace Management System' },
                        { id: 'sys-4', name: 'EPM', description: 'Enterprise Performance Management' },
                        { id: 'sys-5', name: 'Multi', description: 'Multiple Systems' }
                    ];
                }
                // Regenerate quarters to start from Q1 2026 (added in v6)
                if (data.version < 6) {
                    this.log('Migrating: Regenerating quarters to start from Q1 2026');
                    data.quarters = generateQuarters();
                }
                // Ensure sprint settings exist (added in v7)
                if (data.settings) {
                    if (typeof data.settings.sprintDurationWeeks === 'undefined') {
                        data.settings.sprintDurationWeeks = 3;
                    }
                    if (!data.settings.sprintStartDate) {
                        data.settings.sprintStartDate = '2026-01-05';
                    }
                    if (typeof data.settings.sprintsToShow === 'undefined') {
                        data.settings.sprintsToShow = 6;
                    }
                    if (typeof data.settings.sprintsPerYear === 'undefined') {
                        data.settings.sprintsPerYear = 16;
                    }
                    if (!data.settings.byeWeeksAfter) {
                        data.settings.byeWeeksAfter = [8, 12];
                    }
                    if (typeof data.settings.holidayWeeksAtEnd === 'undefined') {
                        data.settings.holidayWeeksAtEnd = 2;
                    }
                }
                // Migrate projects from single system to systems array (added in v8)
                if (data.projects) {
                    data.projects.forEach(project => {
                        if (!project.systems) {
                            // Convert old system string to systems array
                            if (project.system) {
                                const sys = (data.systems || []).find(s => s.name === project.system);
                                project.systems = sys ? [sys.id] : [];
                            } else {
                                project.systems = [];
                            }
                            delete project.system; // Remove old property
                        }
                    });
                }
                // Remove 'Multi' from systems if it exists (no longer needed)
                if (data.systems) {
                    data.systems = data.systems.filter(s => s.name !== 'Multi');
                }
                // Update version
                data.version = 8;
                return data;
            },
            save(data) {
                this.log('Saving to localStorage');
                try {
                    data.lastModified = new Date().toISOString();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    this.updateSyncStatus('', 'Saved');
                    return true;
                } catch (e) { this.log('Error saving', e); return false; }
            },
            updateSyncStatus(status, text) {
                const dot = document.getElementById('sync-dot');
                const textEl = document.getElementById('sync-text');
                if (dot) dot.className = 'dot ' + status;
                if (textEl) textEl.textContent = text;
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 6: HISTORY MODULE
           Undo/Redo functionality with state snapshots
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * History module for undo/redo functionality
         * Maintains a stack of state snapshots
         */
        const History = {
            log: (msg, data) => console.log(`[History] ${msg}`, data || ''),
            push(actionName) {
                if (isUndoRedoAction || isWhatIfMode) return;
                // Remove any redo states if we're not at the end
                if (historyIndex < historyStack.length - 1) {
                    historyStack = historyStack.slice(0, historyIndex + 1);
                }
                // Deep clone the state
                const snapshot = { state: JSON.parse(JSON.stringify(state)), actionName, timestamp: Date.now() };
                historyStack.push(snapshot);
                // Limit history size
                if (historyStack.length > MAX_HISTORY) {
                    historyStack.shift();
                } else {
                    historyIndex++;
                }
                this.log('Pushed', { actionName, index: historyIndex, stackSize: historyStack.length });
                this.updateButtons();
            },
            undo() {
                if (historyIndex <= 0 || isWhatIfMode) {
                    showToast('Nothing to undo', 'warning');
                    return false;
                }
                isUndoRedoAction = true;
                historyIndex--;
                const snapshot = historyStack[historyIndex];
                state = JSON.parse(JSON.stringify(snapshot.state));
                Storage.save(state);
                this.log('Undo', { index: historyIndex, action: historyStack[historyIndex + 1]?.actionName });
                showToast(`Undid: ${historyStack[historyIndex + 1]?.actionName || 'action'}`, 'info');
                UI.renderView(currentView);
                isUndoRedoAction = false;
                this.updateButtons();
                return true;
            },
            redo() {
                if (historyIndex >= historyStack.length - 1 || isWhatIfMode) {
                    showToast('Nothing to redo', 'warning');
                    return false;
                }
                isUndoRedoAction = true;
                historyIndex++;
                const snapshot = historyStack[historyIndex];
                state = JSON.parse(JSON.stringify(snapshot.state));
                Storage.save(state);
                this.log('Redo', { index: historyIndex, action: snapshot.actionName });
                showToast(`Redid: ${snapshot.actionName || 'action'}`, 'info');
                UI.renderView(currentView);
                isUndoRedoAction = false;
                this.updateButtons();
                return true;
            },
            updateButtons() {
                const undoBtn = document.getElementById('undo-btn');
                const redoBtn = document.getElementById('redo-btn');
                if (undoBtn) undoBtn.disabled = historyIndex <= 0 || isWhatIfMode;
                if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1 || isWhatIfMode;
            },
            clear() {
                historyStack = [{ state: JSON.parse(JSON.stringify(state)), actionName: 'Initial', timestamp: Date.now() }];
                historyIndex = 0;
                this.updateButtons();
            }
        };
        
        function getState() { return isWhatIfMode ? whatIfState : state; }
        function saveState(actionName = 'Change') { 
            if (!isWhatIfMode) {
                History.push(actionName);
                Storage.save(state);
            }
        }
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 7: DATA MODULE
           CRUD operations for all entities
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Data module for CRUD operations
         * Handles projects, team members, skills, roles, time-off, etc.
         */
        const Data = {
            log: (msg, data) => console.log(`[Data] ${msg}`, data || ''),
            generateId: (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
            getCurrentQuarter() {
                const now = new Date();
                const q = Math.ceil((now.getMonth() + 1) / 3);
                const year = now.getFullYear();
                // If current date is before Q1 2026, default to Q1 2026
                if (year < 2026) return 'Q1 2026';
                return `Q${q} ${year}`;
            },
            quarterToIndex(quarter, quarters) { return quarters.indexOf(quarter); },
            isQuarterInRange(quarter, start, end, quarters) {
                const qi = this.quarterToIndex(quarter, quarters);
                const si = this.quarterToIndex(start, quarters);
                const ei = this.quarterToIndex(end, quarters);
                return qi >= si && qi <= ei;
            },
            getVisibleQuarters(n) {
                const currentQ = this.getCurrentQuarter();
                const allQ = getState().quarters;
                const idx = allQ.indexOf(currentQ);
                const start = Math.max(0, idx - 1);
                return allQ.slice(start, start + n);
            },
            /**
             * Get visible periods based on view mode
             * @param {string} viewMode - 'sprint', 'week', 'month', 'quarter', 'year'
             * @param {number} [count] - Number of periods (defaults based on mode)
             * @returns {string[]} Array of period strings
             */
            getVisiblePeriods(viewMode, count) {
                const st = getState();
                // Default counts based on view mode
                const defaultCounts = { 
                    sprint: st.settings.sprintsToShow || 6, 
                    week: 12, 
                    month: 6, 
                    quarter: st.settings.quartersToShow || 4, 
                    year: 4 
                };
                const n = count || defaultCounts[viewMode] || 4;
                
                // For sprints, use the configured start date
                if (viewMode === 'sprint') {
                    const sprintStartDate = new Date(st.settings.sprintStartDate || '2026-01-05');
                    return Calendar.generatePeriods(viewMode, n, sprintStartDate);
                }
                
                // Use Q1 2026 as the start date for consistency
                const startDate = new Date(2026, 0, 1);
                return Calendar.generatePeriods(viewMode, n, startDate);
            },
            /**
             * Check if a period (week/month) overlaps with a phase's quarter range
             * @param {string} period - Period string (W1 2026, Jan 2026, etc.)
             * @param {string} startQuarter - Phase start quarter
             * @param {string} endQuarter - Phase end quarter
             * @returns {boolean} True if period overlaps with phase range
             */
            isPeriodInPhaseRange(period, startQuarter, endQuarter) {
                const periodData = Calendar.parsePeriod(period);
                if (!periodData) return false;
                
                const startQ = Calendar.parseQuarter(startQuarter);
                const endQ = Calendar.parseQuarter(endQuarter);
                if (!startQ || !endQ) return false;
                
                // Check if period overlaps with phase date range
                return periodData.start <= endQ.end && periodData.end >= startQ.start;
            },
            getProjectDateRange(project) {
                if (!project.phases || project.phases.length === 0) return { start: null, end: null };
                const quarters = getState().quarters;
                let minIdx = Infinity, maxIdx = -Infinity;
                project.phases.forEach(phase => {
                    const si = this.quarterToIndex(phase.startQuarter, quarters);
                    const ei = this.quarterToIndex(phase.endQuarter, quarters);
                    if (si < minIdx) minIdx = si;
                    if (ei > maxIdx) maxIdx = ei;
                });
                return { start: quarters[minIdx], end: quarters[maxIdx] };
            },
            addProject(projectData) {
                this.log('Adding project', projectData);
                const st = getState();
                const project = {
                    id: this.generateId('proj'),
                    name: projectData.name,
                    priority: projectData.priority,
                    systems: projectData.systems || [],
                    status: projectData.status || 'Planning',
                    phases: projectData.phases || [{
                        id: this.generateId('phase'),
                        name: 'Main',
                        startQuarter: this.getCurrentQuarter(),
                        endQuarter: this.getCurrentQuarter(),
                        requiredSkillIds: [],
                        predecessorPhaseId: null,
                        assignments: []
                    }]
                };
                st.projects.push(project);
                saveState(`Add project "${project.name}"`);
                return project;
            },
            updateProject(projectId, updates) {
                this.log('Updating project', { projectId, updates });
                const st = getState();
                const idx = st.projects.findIndex(p => p.id === projectId);
                if (idx !== -1) {
                    const name = st.projects[idx].name;
                    st.projects[idx] = { ...st.projects[idx], ...updates };
                    saveState(`Update project "${name}"`);
                    return st.projects[idx];
                }
                return null;
            },
            deleteProject(projectId) {
                this.log('Deleting project', projectId);
                const st = getState();
                const project = st.projects.find(p => p.id === projectId);
                const name = project?.name || 'Unknown';
                st.projects = st.projects.filter(p => p.id !== projectId);
                saveState(`Delete project "${name}"`);
            },
            duplicateProject(projectId) {
                this.log('Duplicating project', projectId);
                const st = getState();
                const original = st.projects.find(p => p.id === projectId);
                if (!original) return null;
                
                // Create mapping of old phase IDs to new phase IDs
                const phaseIdMap = {};
                original.phases.forEach(phase => {
                    phaseIdMap[phase.id] = this.generateId('phase');
                });
                
                // Deep clone the project
                const newProject = {
                    id: this.generateId('project'),
                    name: original.name + ' (Copy)',
                    priority: original.priority,
                    systems: [...(original.systems || [])],
                    status: 'Planning', // Reset to Planning for the copy
                    phases: original.phases.map(phase => ({
                        id: phaseIdMap[phase.id],
                        name: phase.name,
                        startQuarter: phase.startQuarter,
                        endQuarter: phase.endQuarter,
                        requiredSkillIds: [...(phase.requiredSkillIds || [])],
                        // Remap predecessor to new phase ID
                        predecessorPhaseId: phase.predecessorPhaseId ? phaseIdMap[phase.predecessorPhaseId] : null,
                        // Copy assignments with new references
                        assignments: phase.assignments.map(a => ({
                            memberId: a.memberId,
                            quarter: a.quarter,
                            days: a.days || 0
                        }))
                    }))
                };
                
                st.projects.push(newProject);
                saveState(`Duplicate project "${original.name}"`);
                return newProject;
            },
            addTeamMember(memberData) {
                this.log('Adding team member', memberData);
                const st = getState();
                const member = {
                    id: this.generateId('member'),
                    name: memberData.name,
                    role: memberData.role,
                    countryId: memberData.countryId || st.settings.defaultCountryId || 'country-nl',
                    skillIds: memberData.skillIds || [],
                    maxConcurrentProjects: memberData.maxConcurrentProjects || 2
                };
                st.teamMembers.push(member);
                saveState(`Add team member "${member.name}"`);
                return member;
            },
            updateTeamMember(memberId, updates) {
                const st = getState();
                const idx = st.teamMembers.findIndex(m => m.id === memberId);
                if (idx !== -1) {
                    const name = st.teamMembers[idx].name;
                    st.teamMembers[idx] = { ...st.teamMembers[idx], ...updates };
                    saveState(`Update member "${name}"`);
                    return st.teamMembers[idx];
                }
                return null;
            },
            deleteTeamMember(memberId) {
                const st = getState();
                const member = st.teamMembers.find(m => m.id === memberId);
                const name = member?.name || 'Unknown';
                let hasAssignments = false;
                st.projects.forEach(p => {
                    p.phases.forEach(ph => {
                        if (ph.assignments.some(a => a.memberId === memberId)) hasAssignments = true;
                    });
                });
                if (hasAssignments) return { error: 'Member has active assignments. Please reassign first.' };
                st.teamMembers = st.teamMembers.filter(m => m.id !== memberId);
                saveState(`Delete member "${name}"`);
                return { success: true };
            },
            addSkill(skillData) {
                const st = getState();
                const skill = { id: this.generateId('skill'), name: skillData.name, category: skillData.category };
                st.skills.push(skill);
                saveState(`Add skill "${skill.name}"`);
                return skill;
            },
            addRole(roleData) {
                const st = getState();
                const role = { id: this.generateId('role'), name: roleData.name };
                st.roles.push(role);
                saveState(`Add role "${role.name}"`);
                return role;
            },
            updateRole(roleId, updates) {
                const st = getState();
                const idx = st.roles.findIndex(r => r.id === roleId);
                if (idx !== -1) {
                    st.roles[idx] = { ...st.roles[idx], ...updates };
                    saveState(`Update role "${st.roles[idx].name}"`);
                    return st.roles[idx];
                }
                return null;
            },
            deleteRole(roleId) {
                const st = getState();
                const role = st.roles.find(r => r.id === roleId);
                if (!role) return { error: 'Role not found.' };
                const inUse = st.teamMembers.some(m => m.role === role.name);
                if (inUse) return { error: 'Role is assigned to team members. Please reassign them first.' };
                st.roles = st.roles.filter(r => r.id !== roleId);
                saveState(`Delete role "${role.name}"`);
                return { success: true };
            },
            deleteSkill(skillId) {
                const st = getState();
                const skill = st.skills.find(s => s.id === skillId);
                const name = skill?.name || 'Unknown';
                const inUse = st.teamMembers.some(m => m.skillIds.includes(skillId)) ||
                    st.projects.some(p => p.phases.some(ph => ph.requiredSkillIds?.includes(skillId)));
                if (inUse) return { error: 'Skill is in use. Cannot delete.' };
                st.skills = st.skills.filter(s => s.id !== skillId);
                saveState(`Delete skill "${name}"`);
                return { success: true };
            },
            // System CRUD methods
            addSystem(systemData) {
                const st = getState();
                if (!st.systems) st.systems = [];
                const system = { 
                    id: this.generateId('sys'), 
                    name: systemData.name, 
                    description: systemData.description || '' 
                };
                st.systems.push(system);
                saveState(`Add system "${system.name}"`);
                return system;
            },
            updateSystem(systemId, updates) {
                const st = getState();
                if (!st.systems) st.systems = [];
                const idx = st.systems.findIndex(s => s.id === systemId);
                if (idx !== -1) {
                    st.systems[idx] = { ...st.systems[idx], ...updates };
                    saveState(`Update system "${st.systems[idx].name}"`);
                    return st.systems[idx];
                }
                return null;
            },
            deleteSystem(systemId) {
                const st = getState();
                if (!st.systems) st.systems = [];
                const system = st.systems.find(s => s.id === systemId);
                if (!system) return { error: 'System not found.' };
                const name = system.name;
                // Check if system is used in any project
                const inUse = st.projects.some(p => (p.systems || []).includes(systemId));
                if (inUse) return { error: 'System is used in projects. Cannot delete.' };
                st.systems = st.systems.filter(s => s.id !== systemId);
                saveState(`Delete system "${name}"`);
                return { success: true };
            },
            addTimeOff(timeOffData) {
                const st = getState();
                const member = st.teamMembers.find(m => m.id === timeOffData.memberId);
                const timeOff = {
                    id: this.generateId('timeoff'),
                    memberId: timeOffData.memberId,
                    quarter: timeOffData.quarter,
                    days: timeOffData.days || 0,  // Changed from reduction to days
                    reason: timeOffData.reason || ''
                };
                st.timeOff.push(timeOff);
                saveState(`Add time off for "${member?.name || 'Unknown'}"`);
                return timeOff;
            },
            deleteTimeOff(timeOffId) {
                const st = getState();
                st.timeOff = st.timeOff.filter(t => t.id !== timeOffId);
                saveState('Delete time off');
            },
            updateSettings(updates) {
                const st = getState();
                st.settings = { ...st.settings, ...updates };
                saveState('Update settings');
            },
            // Country CRUD methods
            addCountry(countryData) {
                const st = getState();
                // Ensure countries array exists (for data migration from older versions)
                if (!st.countries) st.countries = [];
                const country = {
                    id: this.generateId('country'),
                    code: countryData.code.toUpperCase(),
                    name: countryData.name
                };
                st.countries.push(country);
                saveState(`Add country "${country.name}"`);
                return country;
            },
            updateCountry(countryId, updates) {
                const st = getState();
                if (!st.countries) st.countries = [];
                const idx = st.countries.findIndex(c => c.id === countryId);
                if (idx !== -1) {
                    st.countries[idx] = { ...st.countries[idx], ...updates };
                    saveState(`Update country "${st.countries[idx].name}"`);
                    return st.countries[idx];
                }
                return null;
            },
            deleteCountry(countryId) {
                const st = getState();
                if (!st.countries) st.countries = [];
                if (!st.publicHolidays) st.publicHolidays = [];
                const country = st.countries.find(c => c.id === countryId);
                if (!country) return { error: 'Country not found.' };
                // Check if country is assigned to any team members
                const inUse = st.teamMembers.some(m => m.countryId === countryId);
                if (inUse) return { error: 'Country is assigned to team members. Reassign them first.' };
                // Delete country and all its holidays
                st.countries = st.countries.filter(c => c.id !== countryId);
                st.publicHolidays = st.publicHolidays.filter(h => h.countryId !== countryId);
                saveState(`Delete country "${country.name}"`);
                return { success: true };
            },
            // Add/update public holiday with country
            addPublicHoliday(holidayData) {
                const st = getState();
                if (!st.publicHolidays) st.publicHolidays = [];
                if (!st.countries) st.countries = [];
                const country = st.countries.find(c => c.id === holidayData.countryId);
                const holiday = {
                    id: this.generateId('hol'),
                    countryId: holidayData.countryId,
                    date: holidayData.date,
                    name: holidayData.name
                };
                st.publicHolidays.push(holiday);
                saveState(`Add holiday "${holiday.name}" (${country?.code || 'Unknown'})`);
                return holiday;
            },
            updatePublicHoliday(holidayId, updates) {
                const st = getState();
                const idx = st.publicHolidays.findIndex(h => h.id === holidayId);
                if (idx !== -1) {
                    st.publicHolidays[idx] = { ...st.publicHolidays[idx], ...updates };
                    saveState(`Update holiday "${st.publicHolidays[idx].name}"`);
                    return st.publicHolidays[idx];
                }
                return null;
            },
            deletePublicHoliday(holidayId) {
                const st = getState();
                const holiday = st.publicHolidays.find(h => h.id === holidayId);
                st.publicHolidays = st.publicHolidays.filter(h => h.id !== holidayId);
                saveState(`Delete holiday "${holiday?.name || 'Unknown'}"`);
            },
            // Bulk assignment method - now uses days instead of allocation percentage
            bulkAssign(assignments) {
                const st = getState();
                let count = 0;
                assignments.forEach(({ projectId, phaseId, memberId, quarter, days }) => {
                    const project = st.projects.find(p => p.id === projectId);
                    if (!project) return;
                    const phase = project.phases.find(ph => ph.id === phaseId);
                    if (!phase) return;
                    // Remove existing assignment for this member/quarter if exists
                    phase.assignments = phase.assignments.filter(a => !(a.memberId === memberId && a.quarter === quarter));
                    // Add new assignment if days > 0
                    if (days > 0) {
                        phase.assignments.push({ memberId, quarter, days });
                    }
                    count++;
                });
                saveState(`Bulk assign ${count} assignments`);
                return count;
            },
            // Bulk remove assignments
            bulkRemoveAssignments(memberIds, projectId, phaseId, quarters) {
                const st = getState();
                const project = st.projects.find(p => p.id === projectId);
                if (!project) return 0;
                const phase = project.phases.find(ph => ph.id === phaseId);
                if (!phase) return 0;
                const before = phase.assignments.length;
                phase.assignments = phase.assignments.filter(a => 
                    !(memberIds.includes(a.memberId) && quarters.includes(a.quarter))
                );
                const removed = before - phase.assignments.length;
                if (removed > 0) saveState(`Remove ${removed} assignments`);
                return removed;
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 8: CAPACITY MODULE
           Utilization calculations and capacity analysis
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Capacity module for utilization calculations
         * Uses workdays instead of percentages for more accurate planning
         */
        const Capacity = {
            log: (msg, data) => console.log(`[Capacity] ${msg}`, data || ''),
            
            // Calculate capacity in workdays for a member in a quarter
            calculate(memberId, quarter) {
                const st = getState();
                // Use member's country-specific holidays
                const memberHolidays = Calendar.getHolidaysForMember(memberId);
                const totalWorkdays = Calendar.getWorkdaysInQuarter(quarter, memberHolidays);
                
                let usedDays = 0;
                const breakdown = [];
                
                // BAU Reserve (in days)
                const bauDays = st.settings.bauReserveDays || 5;
                usedDays += bauDays;
                breakdown.push({ type: 'bau', days: bauDays });
                
                // Time Off (in days)
                const timeOff = st.timeOff.find(t => t.memberId === memberId && t.quarter === quarter);
                if (timeOff) {
                    const toDays = timeOff.days || 0;
                    usedDays += toDays;
                    breakdown.push({ type: 'timeoff', days: toDays, reason: timeOff.reason });
                }
                
                // Project assignments (in days)
                st.projects.forEach(project => {
                    if (project.status === 'Completed') return;
                    project.phases.forEach(phase => {
                        if (Data.isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter, st.quarters)) {
                            const assignment = phase.assignments.find(a => a.memberId === memberId && a.quarter === quarter);
                            if (assignment) {
                                const assignDays = assignment.days || 0;
                                usedDays += assignDays;
                                breakdown.push({
                                    type: 'project', projectId: project.id, projectName: project.name,
                                    phaseId: phase.id, phaseName: phase.name, days: assignDays
                                });
                            }
                        }
                    });
                });
                
                const availableDaysRaw = totalWorkdays - usedDays; // Can be negative
                const availableDays = Math.max(0, availableDaysRaw); // Clamped to 0 for some uses
                const usedPercent = totalWorkdays > 0 ? Math.round((usedDays / totalWorkdays) * 100) : 0;
                
                return {
                    totalWorkdays,
                    usedDays,
                    availableDays,
                    availableDaysRaw, // Can be negative for over-allocation
                    usedPercent,
                    status: usedDays > totalWorkdays ? 'overallocated' : usedPercent > 90 ? 'warning' : 'normal',
                    breakdown
                };
            },
            getMemberProjectCount(memberId, quarter) {
                const st = getState();
                const projects = new Set();
                st.projects.forEach(project => {
                    if (project.status === 'Completed') return;
                    project.phases.forEach(phase => {
                        if (Data.isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter, st.quarters)) {
                            if (phase.assignments.find(a => a.memberId === memberId && a.quarter === quarter)) {
                                projects.add(project.id);
                            }
                        }
                    });
                });
                return projects.size;
            },
            checkSkillMatch(memberId, requiredSkillIds) {
                const st = getState();
                const member = st.teamMembers.find(m => m.id === memberId);
                if (!member) return { matched: false, missing: requiredSkillIds };
                const missing = requiredSkillIds.filter(sid => !member.skillIds.includes(sid));
                return { matched: missing.length === 0, missing: missing.map(sid => st.skills.find(s => s.id === sid)?.name || sid) };
            },
            getWarnings() {
                const st = getState();
                const currentQ = Data.getCurrentQuarter();
                const warnings = { overallocated: [], highUtilization: [], tooManyProjects: [], skillMismatch: [], dependencyViolations: [], unassignedPhases: [] };
                st.teamMembers.forEach(member => {
                    const cap = this.calculate(member.id, currentQ);
                    if (cap.status === 'overallocated') warnings.overallocated.push({ member, usedDays: cap.usedDays, totalDays: cap.totalWorkdays, quarter: currentQ });
                    else if (cap.status === 'warning') warnings.highUtilization.push({ member, usedDays: cap.usedDays, totalDays: cap.totalWorkdays, usedPercent: cap.usedPercent, quarter: currentQ });
                    const projectCount = this.getMemberProjectCount(member.id, currentQ);
                    if (projectCount > member.maxConcurrentProjects) {
                        warnings.tooManyProjects.push({ member, count: projectCount, max: member.maxConcurrentProjects });
                    }
                });
                st.projects.forEach(project => {
                    if (project.status === 'Completed') return;
                    project.phases.forEach(phase => {
                        // Check skill mismatches
                        if (phase.requiredSkillIds && phase.requiredSkillIds.length > 0) {
                            phase.assignments.forEach(assignment => {
                                const match = this.checkSkillMatch(assignment.memberId, phase.requiredSkillIds);
                                if (!match.matched) {
                                    const member = st.teamMembers.find(m => m.id === assignment.memberId);
                                    warnings.skillMismatch.push({ project, phase, member, missingSkills: match.missing });
                                }
                            });
                        }
                        // Check unassigned phases
                        const phaseStartIdx = Data.quarterToIndex(phase.startQuarter, st.quarters);
                        const currentIdx = Data.quarterToIndex(currentQ, st.quarters);
                        if (phaseStartIdx <= currentIdx + 1 && phase.assignments.length === 0) {
                            warnings.unassignedPhases.push({ project, phase });
                        }
                        // Check dependency violations
                        if (phase.predecessorPhaseId) {
                            const predPhase = project.phases.find(p => p.id === phase.predecessorPhaseId);
                            if (predPhase) {
                                const predEndIdx = Data.quarterToIndex(predPhase.endQuarter, st.quarters);
                                const phaseStartIdx = Data.quarterToIndex(phase.startQuarter, st.quarters);
                                // Violation if phase starts before or same quarter as predecessor ends
                                if (phaseStartIdx <= predEndIdx) {
                                    warnings.dependencyViolations.push({
                                        project,
                                        phase,
                                        predecessorPhase: predPhase,
                                        issue: `"${phase.name}" starts in ${phase.startQuarter} but depends on "${predPhase.name}" which ends in ${predPhase.endQuarter}`
                                    });
                                }
                            }
                        }
                    });
                });
                return warnings;
            },
            getDashboardStats() {
                const st = getState();
                const currentQ = Data.getCurrentQuarter();
                const quarterInfo = Calendar.getQuarterBreakdown(currentQ, st.publicHolidays || []);
                let totalUsedDays = 0, totalWorkdays = 0, overallocatedCount = 0;
                st.teamMembers.forEach(member => {
                    const cap = this.calculate(member.id, currentQ);
                    totalUsedDays += cap.usedDays;
                    totalWorkdays += cap.totalWorkdays;
                    if (cap.status === 'overallocated') overallocatedCount++;
                });
                const avgUsedPercent = st.teamMembers.length > 0 && totalWorkdays > 0 
                    ? Math.round((totalUsedDays / totalWorkdays) * 100) 
                    : 0;
                const avgUsedDays = st.teamMembers.length > 0 
                    ? Math.round(totalUsedDays / st.teamMembers.length * 10) / 10 
                    : 0;
                const warnings = this.getWarnings();
                return {
                    teamSize: st.teamMembers.length,
                    activeProjects: st.projects.filter(p => p.status === 'Active').length,
                    avgUsedPercent,
                    avgUsedDays,
                    workdaysInQuarter: quarterInfo?.workdays || 0,
                    overallocatedCount,
                    skillGaps: warnings.skillMismatch.length,
                    dependencyIssues: warnings.dependencyViolations.length,
                    currentQuarter: currentQ
                };
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 9: UI MODULE
           View rendering and event handling
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * UI module for view rendering
         * Handles all view generation and DOM manipulation
         */
        const UI = {
            log: (msg, data) => console.log(`[UI] ${msg}`, data || ''),
            /** @see escapeHtml - Uses global escapeHtml function */
            escapeHtml: (text) => escapeHtml(text),
            renderView(viewName) {
                this.log('Rendering view', viewName);
                currentView = viewName;
                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.view === viewName);
                });
                const main = document.getElementById('main-content');
                switch(viewName) {
                    case 'dashboard': main.innerHTML = this.renderDashboard(); this.attachDashboardEvents(); break;
                    case 'timeline': main.innerHTML = this.renderTimeline(); this.attachTimelineEvents(); break;
                    case 'projects': main.innerHTML = this.renderProjects(); this.attachProjectsEvents(); break;
                    case 'team': main.innerHTML = this.renderTeam(); this.attachTeamEvents(); break;
                    case 'settings': main.innerHTML = this.renderSettings(); this.attachSettingsEvents(); break;
                }
            },
            renderDashboard() {
                const stats = Capacity.getDashboardStats();
                const warnings = Capacity.getWarnings();
                const st = getState();
                const quarterInfo = Calendar.getQuarterBreakdown(stats.currentQuarter, st.publicHolidays || []);
                let avgClass = stats.avgUsedPercent > 90 ? 'danger' : stats.avgUsedPercent > 70 ? 'warning' : 'success';
                return `
                    <h2 style="font-size:20px;font-weight:700;color:var(--gray-900);margin-bottom:20px;">Dashboard</h2>
                    <div style="margin-bottom:20px;padding:12px 16px;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--border-light);display:flex;align-items:center;gap:24px;">
                        <div style="font-weight:600;color:var(--gray-700);">${stats.currentQuarter}</div>
                        <div style="font-size:13px;color:var(--gray-500);">
                            <span style="font-weight:500;">${quarterInfo?.workdays || 0}</span> workdays
                            <span style="margin:0 8px;">·</span>
                            <span>${quarterInfo?.holidayDays || 0}</span> holidays
                        </div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-label">Team Size</div><div class="stat-value">${stats.teamSize}</div></div>
                        <div class="stat-card"><div class="stat-label">Active Projects</div><div class="stat-value">${stats.activeProjects}</div></div>
                        <div class="stat-card ${avgClass}"><div class="stat-label">Avg Capacity Used</div><div class="stat-value">${stats.avgUsedDays}d <span style="font-size:14px;color:var(--gray-500);">(${stats.avgUsedPercent}%)</span></div></div>
                        <div class="stat-card"><div class="stat-label">Workdays/Quarter</div><div class="stat-value">${stats.workdaysInQuarter}d</div></div>
                        <div class="stat-card ${stats.overallocatedCount > 0 ? 'danger' : 'success'}"><div class="stat-label">Overallocated</div><div class="stat-value">${stats.overallocatedCount}</div></div>
                        <div class="stat-card ${stats.skillGaps > 0 ? 'warning' : ''}"><div class="stat-label">Skill Gaps</div><div class="stat-value">${stats.skillGaps}</div></div>
                        <div class="stat-card ${stats.dependencyIssues > 0 ? 'danger' : ''}"><div class="stat-label">Dependency Issues</div><div class="stat-value">${stats.dependencyIssues}</div></div>
                    </div>
                    <h3 style="font-size:16px;font-weight:600;color:var(--gray-800);margin-bottom:16px;">Team Availability Heatmap</h3>
                    ${this.renderAvailabilityHeatmap()}
                    
                    <h3 style="font-size:16px;font-weight:600;color:var(--gray-800);margin:24px 0 16px 0;">Warnings</h3>
                    <div class="warnings-section">
                        ${this.renderWarningPanel('Overallocated Team Members', warnings.overallocated, 'danger', w => `${w.member.name} uses ${w.usedDays}d of ${w.totalDays}d in ${w.quarter}`)}
                        ${this.renderWarningPanel('High Utilization (>90%)', warnings.highUtilization, 'warning', w => `${w.member.name} at ${w.usedPercent}% (${w.usedDays}d/${w.totalDays}d) in ${w.quarter}`)}
                        ${this.renderWarningPanel('Too Many Projects', warnings.tooManyProjects, 'warning', w => `${w.member.name} has ${w.count} projects (max ${w.max})`)}
                        ${this.renderWarningPanel('Skill Mismatches', warnings.skillMismatch, 'warning', w => `${w.member.name} on ${w.project.name}: missing ${w.missingSkills.join(', ')}`)}
                        ${this.renderWarningPanel('Dependency Violations', warnings.dependencyViolations, 'danger', w => `${w.project.name}: ${w.issue}`)}
                        ${this.renderWarningPanel('Unassigned Phases Starting Soon', warnings.unassignedPhases, 'warning', w => `${w.project.name} → ${w.phase.name} (${w.phase.startQuarter})`)}
                    </div>
                `;
            },
            renderWarningPanel(title, items, severity, formatItem) {
                if (items.length === 0) {
                    return `<div class="warning-panel ${severity}"><div class="warning-header"><div class="warning-title">${title}</div><span class="warning-count" style="background:var(--success-light);color:var(--success);">0</span></div></div>`;
                }
                return `
                    <div class="warning-panel ${severity}">
                        <div class="warning-header" onclick="this.parentElement.classList.toggle('expanded')">
                            <div class="warning-title">${title}</div>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span class="warning-count">${items.length}</span>
                                <svg class="warning-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>
                        <div class="warning-content">${items.map(item => `<div class="warning-item">${formatItem(item)}</div>`).join('')}</div>
                    </div>
                `;
            },
            renderAvailabilityHeatmap() {
                const st = getState();
                const quarters = Data.getVisibleQuarters(st.settings.quartersToShow || 8);
                
                if (st.teamMembers.length === 0) {
                    return `<div style="padding:20px;text-align:center;color:var(--gray-500);background:var(--gray-50);border-radius:var(--radius-lg);">No team members yet. Add team members in Settings.</div>`;
                }
                
                // Helper to get cell color based on utilization
                const getHeatmapColor = (percent, isOver) => {
                    if (isOver) return { bg: '#fecaca', text: '#991b1b', border: '#f87171' }; // Red - over
                    if (percent >= 90) return { bg: '#fed7aa', text: '#9a3412', border: '#fb923c' }; // Orange - high
                    if (percent >= 70) return { bg: '#fef08a', text: '#854d0e', border: '#facc15' }; // Yellow - moderate
                    if (percent >= 40) return { bg: '#bbf7d0', text: '#166534', border: '#4ade80' }; // Green - good
                    if (percent > 0) return { bg: '#d1fae5', text: '#047857', border: '#34d399' }; // Light green - low
                    return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' }; // Gray - no allocation
                };
                
                return `
                    <div class="heatmap-container" style="background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:24px;">
                        <div style="overflow-x:auto;">
                            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                <thead>
                                    <tr style="background:var(--gray-50);">
                                        <th style="padding:12px 16px;text-align:left;font-weight:600;color:var(--gray-700);border-bottom:1px solid var(--border-light);position:sticky;left:0;background:var(--gray-50);min-width:160px;">Team Member</th>
                                        ${quarters.map(q => `<th style="padding:12px 8px;text-align:center;font-weight:600;color:var(--gray-700);border-bottom:1px solid var(--border-light);min-width:80px;">${q}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${st.teamMembers.map(member => {
                                        return `
                                            <tr>
                                                <td style="padding:10px 16px;border-bottom:1px solid var(--border-light);font-weight:500;color:var(--gray-800);position:sticky;left:0;background:var(--bg-secondary);">
                                                    <div>${this.escapeHtml(member.name)}</div>
                                                    <div style="font-size:11px;color:var(--gray-500);font-weight:400;">${this.escapeHtml(member.role)}</div>
                                                </td>
                                                ${quarters.map(q => {
                                                    const cap = Capacity.calculate(member.id, q);
                                                    const isOver = cap.usedDays > cap.totalWorkdays;
                                                    const colors = getHeatmapColor(cap.usedPercent, isOver);
                                                    const tooltip = `${cap.usedDays}d / ${cap.totalWorkdays}d (${cap.usedPercent}%)${isOver ? ' - OVER!' : ''}`;
                                                    
                                                    return `
                                                        <td style="padding:6px;border-bottom:1px solid var(--border-light);text-align:center;">
                                                            <div title="${tooltip}" style="
                                                                padding:8px 4px;
                                                                border-radius:var(--radius-sm);
                                                                background:${colors.bg};
                                                                color:${colors.text};
                                                                font-weight:600;
                                                                font-family:var(--font-mono);
                                                                font-size:11px;
                                                                border:1px solid ${colors.border};
                                                                cursor:default;
                                                            ">
                                                                ${isOver ? '🔥' : ''} ${cap.usedPercent}%
                                                                <div style="font-size:10px;font-weight:400;opacity:0.8;">${cap.availableDaysRaw.toFixed(0)}d ${isOver ? 'over' : 'free'}</div>
                                                            </div>
                                                        </td>
                                                    `;
                                                }).join('')}
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div style="padding:12px 16px;background:var(--gray-50);border-top:1px solid var(--border-light);display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                            <span style="font-size:11px;font-weight:600;color:var(--gray-600);">Legend:</span>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;"><span style="width:16px;height:16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:3px;"></span> 0%</span>
                                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;"><span style="width:16px;height:16px;background:#d1fae5;border:1px solid #34d399;border-radius:3px;"></span> 1-39%</span>
                                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;"><span style="width:16px;height:16px;background:#bbf7d0;border:1px solid #4ade80;border-radius:3px;"></span> 40-69%</span>
                                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;"><span style="width:16px;height:16px;background:#fef08a;border:1px solid #facc15;border-radius:3px;"></span> 70-89%</span>
                                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;"><span style="width:16px;height:16px;background:#fed7aa;border:1px solid #fb923c;border-radius:3px;"></span> 90-99%</span>
                                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;"><span style="width:16px;height:16px;background:#fecaca;border:1px solid #f87171;border-radius:3px;"></span> 🔥 Over</span>
                            </div>
                        </div>
                    </div>
                `;
            },
            attachDashboardEvents() { this.log('Dashboard events attached'); },
            renderTimeline() {
                const st = getState();
                // Get periods based on current view mode
                const periods = Data.getVisiblePeriods(timelineViewMode);
                // Also get quarters for resource allocation (assignments are stored at quarter level)
                const quarters = Data.getVisibleQuarters(st.settings.quartersToShow);
                
                return `
                    <div class="timeline-container">
                        <div class="timeline-filters">
                            <div class="filter-group"><span class="filter-label">Member:</span>
                                <select class="form-select" id="filter-member" style="width:180px;">
                                    <option value="">All Members</option>
                                    ${st.teamMembers.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="filter-group"><span class="filter-label">System:</span>
                                <select class="form-select" id="filter-system" style="width:150px;">
                                    <option value="">All Systems</option>
                                    ${(st.systems || []).map(sys => `<option value="${this.escapeHtml(sys.name)}">${this.escapeHtml(sys.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="filter-group"><span class="filter-label">Status:</span>
                                <select class="form-select" id="filter-status" style="width:150px;">
                                    <option value="">All Statuses</option>
                                    <option value="Planning">Planning</option><option value="Active">Active</option><option value="On Hold">On Hold</option><option value="Completed">Completed</option>
                                </select>
                            </div>
                            <button class="btn btn-ghost btn-sm" id="reset-filters">Reset</button>
                            
                            <!-- Timeline View Mode Toggle -->
                            <div class="timeline-view-toggle">
                                <button class="toggle-btn ${timelineViewMode === 'sprint' ? 'active' : ''}" data-view-mode="sprint" title="3-week sprints">Sprint</button>
                                <button class="toggle-btn ${timelineViewMode === 'week' ? 'active' : ''}" data-view-mode="week">Week</button>
                                <button class="toggle-btn ${timelineViewMode === 'month' ? 'active' : ''}" data-view-mode="month">Month</button>
                                <button class="toggle-btn ${timelineViewMode === 'quarter' ? 'active' : ''}" data-view-mode="quarter">Quarter</button>
                                <button class="toggle-btn ${timelineViewMode === 'year' ? 'active' : ''}" data-view-mode="year">Year</button>
                            </div>
                            
                            <div style="margin-left:auto;">
                                <button class="btn btn-primary btn-sm" id="bulk-assign-btn">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    Bulk Assign
                                </button>
                            </div>
                        </div>
                        <div class="timeline-pane">
                            <div class="pane-header">
                                Project Gantt
                                <span style="margin-left:auto;font-size:11px;font-weight:500;color:var(--gray-400);text-transform:none;">
                                    Viewing by ${timelineViewMode.charAt(0).toUpperCase() + timelineViewMode.slice(1)}
                                </span>
                            </div>
                            <div class="gantt-wrapper">${this.renderProjectGantt(periods, timelineViewMode)}</div>
                        </div>
                        <div class="timeline-pane">
                            <div class="pane-header">
                                Resource Allocation
                                <span style="margin-left:auto;font-size:11px;font-weight:500;color:var(--gray-400);text-transform:none;">
                                    (Aggregated by Quarter)
                                </span>
                            </div>
                            <div class="gantt-wrapper">${this.renderResourceAllocation(quarters)}</div>
                        </div>
                    </div>
                `;
            },
            /**
             * Render the Project Gantt chart with dynamic time periods
             * @param {string[]} periods - Array of period strings (weeks, months, quarters, or years)
             * @param {string} viewMode - Current view mode ('week', 'month', 'quarter', 'year')
             */
            renderProjectGantt(periods, viewMode = 'quarter') {
                const st = getState();
                let filteredProjects = st.projects;
                if (filters.system.length > 0) filteredProjects = filteredProjects.filter(p => filters.system.includes(p.system));
                if (filters.status.length > 0) filteredProjects = filteredProjects.filter(p => filters.status.includes(p.status));
                if (filters.member.length > 0) {
                    filteredProjects = filteredProjects.filter(p => p.phases.some(ph => ph.assignments.some(a => filters.member.includes(a.memberId))));
                }
                if (filteredProjects.length === 0) {
                    return `<div class="empty-state"><div class="empty-state-title">No projects found</div><div class="empty-state-desc">Create a project in the Projects view or adjust your filters.</div></div>`;
                }
                
                // Collect dependency info for visualization
                const dependencies = [];
                filteredProjects.forEach(project => {
                    project.phases.forEach(phase => {
                        if (phase.predecessorPhaseId) {
                            const predPhase = project.phases.find(p => p.id === phase.predecessorPhaseId);
                            if (predPhase) {
                                dependencies.push({
                                    projectId: project.id,
                                    fromPhase: predPhase,
                                    toPhase: phase,
                                    fromQuarter: predPhase.endQuarter,
                                    toQuarter: phase.startQuarter
                                });
                            }
                        }
                    });
                });
                
                // Generate header labels based on view mode
                const renderPeriodHeaders = () => {
                    return periods.map((period, idx) => {
                        const labelInfo = Calendar.getPeriodLabel(period, viewMode);
                        if (viewMode === 'sprint') {
                            return `<th data-period-idx="${idx}" class="period-header-group">
                                <div class="period-parent">${labelInfo.parent}</div>
                                <div class="period-label">${labelInfo.label}</div>
                                <div class="period-dates">${labelInfo.dateRange || ''}</div>
                            </th>`;
                        }
                        if (viewMode === 'week' || viewMode === 'month') {
                            return `<th data-period-idx="${idx}" class="period-header-group">
                                <div class="period-parent">${labelInfo.parent}</div>
                                <div class="period-label">${labelInfo.label}</div>
                            </th>`;
                        }
                        return `<th data-period-idx="${idx}">${period}</th>`;
                    }).join('');
                };
                
                // Check if a phase is active in a given period
                const isPhaseActiveInPeriod = (phase, period) => {
                    if (viewMode === 'quarter') {
                        return Data.isQuarterInRange(period, phase.startQuarter, phase.endQuarter, st.quarters);
                    }
                    // For sprint, week, month, year - check if period overlaps with phase quarter range
                    return Data.isPeriodInPhaseRange(period, phase.startQuarter, phase.endQuarter);
                };
                
                // Get assignments count for a phase in a period
                const getAssignmentsInPeriod = (phase, period) => {
                    if (viewMode === 'quarter') {
                        return phase.assignments.filter(a => a.quarter === period).length;
                    }
                    // For sprint view, get assignments for quarters that the sprint overlaps with
                    if (viewMode === 'sprint') {
                        const overlappingQuarters = Calendar.sprintToQuarters(period);
                        return phase.assignments.filter(a => overlappingQuarters.includes(a.quarter)).length;
                    }
                    // For other views, get all assignments for quarters that overlap with this period
                    const overlappingQuarters = Calendar.periodToQuarters(period);
                    return phase.assignments.filter(a => overlappingQuarters.includes(a.quarter)).length;
                };
                
                // Get all unique members assigned to a project across all periods
                const getProjectMembers = (project) => {
                    const memberIds = new Set();
                    project.phases.forEach(phase => {
                        phase.assignments.forEach(a => memberIds.add(a.memberId));
                    });
                    return Array.from(memberIds).map(id => st.teamMembers.find(m => m.id === id)).filter(Boolean);
                };
                
                // Get member's days for a specific period in this project
                // Returns { days, isProportional } - proportional when period < quarter
                const getMemberDaysInPeriod = (project, memberId, period) => {
                    const memberHolidays = Calendar.getHolidaysForMember(memberId);
                    
                    // For quarter view, return actual days
                    if (viewMode === 'quarter') {
                        let totalDays = 0;
                        project.phases.forEach(phase => {
                            if (!isPhaseActiveInPeriod(phase, period)) return;
                            phase.assignments.forEach(a => {
                                if (a.memberId === memberId && a.quarter === period) {
                                    totalDays += a.days || 0;
                                }
                            });
                        });
                        return { days: totalDays, isProportional: false };
                    }
                    
                    // For year view, sum all quarters in the year
                    if (viewMode === 'year') {
                        let totalDays = 0;
                        const yearQuarters = Calendar.generateQuartersForYear(parseInt(period));
                        project.phases.forEach(phase => {
                            phase.assignments.forEach(a => {
                                if (a.memberId === memberId && yearQuarters.includes(a.quarter)) {
                                    totalDays += a.days || 0;
                                }
                            });
                        });
                        return { days: totalDays, isProportional: false };
                    }
                    
                    // For sprint, week, month views - calculate proportional days
                    const overlappingQuarters = viewMode === 'sprint' 
                        ? Calendar.sprintToQuarters(period)
                        : Calendar.periodToQuarters(period);
                    
                    // Get period workdays
                    const periodWorkdays = Calendar.getWorkdaysInPeriod(period, memberHolidays);
                    
                    let proportionalDays = 0;
                    
                    overlappingQuarters.forEach(quarter => {
                        const quarterWorkdays = Calendar.getWorkdaysInQuarter(quarter, memberHolidays);
                        if (quarterWorkdays === 0) return;
                        
                        // Get the portion of the period that falls within this quarter
                        const periodData = Calendar.parsePeriod(period);
                        const quarterData = Calendar.parseQuarter(quarter);
                        if (!periodData || !quarterData) return;
                        
                        // Calculate overlap between period and quarter
                        const overlapStart = new Date(Math.max(periodData.start.getTime(), quarterData.start.getTime()));
                        const overlapEnd = new Date(Math.min(periodData.end.getTime(), quarterData.end.getTime()));
                        
                        if (overlapStart > overlapEnd) return; // No overlap
                        
                        // Count workdays in the overlap
                        let overlapWorkdays = 0;
                        const current = new Date(overlapStart);
                        while (current <= overlapEnd) {
                            if (!Calendar.isWeekend(current) && !Calendar.isPublicHoliday(current, memberHolidays)) {
                                overlapWorkdays++;
                            }
                            current.setDate(current.getDate() + 1);
                        }
                        
                        // Get member's quarterly assignment for this project
                        let quarterlyDays = 0;
                        project.phases.forEach(phase => {
                            phase.assignments.forEach(a => {
                                if (a.memberId === memberId && a.quarter === quarter) {
                                    quarterlyDays += a.days || 0;
                                }
                            });
                        });
                        
                        // Calculate proportional days: (quarterly_days) × (overlap_workdays / quarter_workdays)
                        const proportion = overlapWorkdays / quarterWorkdays;
                        proportionalDays += quarterlyDays * proportion;
                    });
                    
                    return { days: Math.round(proportionalDays * 10) / 10, isProportional: true };
                };
                
                // Check if member is overallocated in a period
                const isMemberOverallocated = (memberId, period) => {
                    const overlappingQuarters = viewMode === 'quarter' 
                        ? [period] 
                        : viewMode === 'sprint' 
                            ? Calendar.sprintToQuarters(period)
                            : Calendar.periodToQuarters(period);
                    
                    for (const q of overlappingQuarters) {
                        const cap = Capacity.calculate(memberId, q);
                        if (cap.status === 'overallocated') return true;
                    }
                    return false;
                };
                
                return `
                    <div style="position:relative;">
                        <table class="gantt-table ${viewMode}-view" id="gantt-project-table">
                            <thead><tr><th>Project</th>${renderPeriodHeaders()}</tr></thead>
                            <tbody>
                                ${filteredProjects.map((project, pi) => {
                                    const dateRange = Data.getProjectDateRange(project);
                                    const hasDeps = project.phases.some(ph => ph.predecessorPhaseId);
                                    const projectMembers = getProjectMembers(project);
                                    const hasResources = projectMembers.length > 0;
                                    
                                    // Project row
                                    const projectRow = `
                                        <tr class="gantt-project-row ${hasResources ? 'has-resources' : ''}" data-project-id="${project.id}" data-project-idx="${pi}">
                                            <td class="gantt-label-cell">
                                                <div style="display:flex;align-items:flex-start;">
                                                    ${hasResources ? `<span class="expand-toggle" title="Show/hide resources">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg>
                                                    </span>` : '<span style="width:28px;"></span>'}
                                                    <div style="flex:1;">
                                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                                                    <span class="badge badge-${project.priority.toLowerCase()}">${project.priority}</span>
                                                    ${Templates.systemsBadges(project.systems)}
                                                    ${hasDeps ? '<span class="badge badge-primary" title="Has dependencies">🔗</span>' : ''}
                                                            ${hasResources ? `<span class="badge badge-gray" title="${projectMembers.length} team member(s)">👥 ${projectMembers.length}</span>` : ''}
                                                </div>
                                                <div style="font-weight:600;color:var(--gray-900);">${this.escapeHtml(project.name)}</div>
                                                <div style="font-size:12px;color:var(--gray-500);">${dateRange.start || '—'} → ${dateRange.end || '—'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            ${periods.map((period, periodIdx) => {
                                                const activePhases = project.phases.filter(ph => isPhaseActiveInPeriod(ph, period));
                                                if (activePhases.length === 0) return `<td class="gantt-period-cell" data-period-idx="${periodIdx}"></td>`;
                                                
                                                const totalAssignments = activePhases.reduce((sum, ph) => sum + getAssignmentsInPeriod(ph, period), 0);
                                                
                                                // Compact display for week view
                                                const barContent = viewMode === 'week' 
                                                    ? (activePhases.length > 1 ? activePhases.length : '') 
                                                    : (activePhases.length === 1 ? this.escapeHtml(activePhases[0].name) : `${activePhases.length} phases`);
                                                
                                                return `
                                                    <td class="gantt-period-cell" data-period-idx="${periodIdx}">
                                                        <div class="gantt-bar priority-${project.priority.toLowerCase()}" 
                                                             style="left:5%;right:5%;width:90%;" 
                                                             data-project-id="${project.id}" 
                                                             data-phase-ids="${activePhases.map(p => p.id).join(',')}"
                                                             title="${activePhases.map(p => p.name).join(', ')}">
                                                            ${barContent}
                                                            ${totalAssignments > 0 ? `<span class="team-badge">${totalAssignments}</span>` : ''}
                                                        </div>
                                                    </td>
                                                `;
                                            }).join('')}
                                        </tr>
                                    `;
                                    
                                    // Resource rows (hidden by default)
                                    const resourceRows = projectMembers.map(member => {
                                        const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                        return `
                                            <tr class="gantt-resource-row" data-project-id="${project.id}" data-member-id="${member.id}">
                                                <td class="gantt-label-cell">
                                                    <div class="resource-info">
                                                        <span class="resource-avatar">${initials}</span>
                                                        <div>
                                                            <div class="resource-name">${this.escapeHtml(member.name)}</div>
                                                            <div class="resource-role">${this.escapeHtml(member.role)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                ${periods.map((period, periodIdx) => {
                                                    const allocation = getMemberDaysInPeriod(project, member.id, period);
                                                    const isOver = isMemberOverallocated(member.id, period);
                                                    const cellClass = allocation.days > 0 ? (isOver ? 'has-allocation overallocated-cell' : 'has-allocation') : '';
                                                    const valueClass = isOver ? 'overallocated' : '';
                                                    const prefix = allocation.isProportional ? '~' : '';
                                                    const tooltip = allocation.isProportional ? 'title="Proportional estimate from quarterly allocation"' : '';
                                                    
                                                    return `
                                                        <td class="gantt-resource-cell ${cellClass}" data-period-idx="${periodIdx}">
                                                            ${allocation.days > 0 ? `<span class="days-value ${valueClass}" ${tooltip}>${prefix}${allocation.days}d</span>` : ''}
                                                        </td>
                                                    `;
                                                }).join('')}
                                            </tr>
                                        `;
                                    }).join('');
                                    
                                    return projectRow + resourceRows;
                                }).join('')}
                            </tbody>
                        </table>
                        ${dependencies.length > 0 ? `
                            <div style="margin-top:12px;padding:12px;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--border-light);">
                                <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:8px;">Phase Dependencies</div>
                                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                                    ${dependencies.map(d => `
                                        <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-md);font-size:12px;">
                                            <span style="color:var(--gray-700);font-weight:500;">${this.escapeHtml(d.fromPhase.name)}</span>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                            <span style="color:var(--gray-700);font-weight:500;">${this.escapeHtml(d.toPhase.name)}</span>
                                            <span style="color:var(--gray-400);">(${d.fromQuarter} → ${d.toQuarter})</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            },
            renderResourceAllocation(quarters) {
                const st = getState();
                const countries = st.countries || [];
                let filteredMembers = st.teamMembers;
                if (filters.member.length > 0) filteredMembers = filteredMembers.filter(m => filters.member.includes(m.id));
                return `
                    <table class="gantt-table">
                        <thead><tr><th>Team Member</th>${quarters.map(q => `<th>${q}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${filteredMembers.map(member => {
                                const memberCountry = countries.find(c => c.id === member.countryId);
                                return `
                                <tr class="resource-row" data-member-id="${member.id}">
                                    <td class="gantt-label-cell">
                                        <div class="resource-label">
                                            <span class="resource-name">${this.escapeHtml(member.name)}</span>
                                            <span class="resource-role">${this.escapeHtml(member.role)} ${memberCountry ? '<span style="color:var(--gray-400);">(' + memberCountry.code + ')</span>' : ''}</span>
                                            <div class="resource-skills">
                                                ${member.skillIds.slice(0, 3).map(sid => {
                                                    const skill = st.skills.find(s => s.id === sid);
                                                    return skill ? '<span class="skill-tag ' + skill.category.toLowerCase() + '">' + this.escapeHtml(skill.name) + '</span>' : '';
                                                }).join('')}
                                                ${member.skillIds.length > 3 ? '<span class="skill-tag">+' + (member.skillIds.length - 3) + '</span>' : ''}
                                            </div>
                                        </div>
                                    </td>
                                    ${quarters.map(q => {
                                        const cap = Capacity.calculate(member.id, q);
                                        const cellClass = cap.status === 'overallocated' ? 'overallocated' : cap.status === 'warning' ? 'warning-capacity' : '';
                                        const projectAllocations = cap.breakdown.filter(b => b.type === 'project');
                                        return '<td class="gantt-quarter-cell ' + cellClass + '">' +
                                            '<div class="resource-cell" style="height:100%;display:flex;flex-direction:column;padding:8px;">' +
                                                projectAllocations.map(alloc => 
                                                    '<div class="allocation-block" data-project-id="' + alloc.projectId + '">' +
                                                        '<div class="allocation-project">' + this.escapeHtml(alloc.projectName) + '</div>' +
                                                        '<div class="allocation-percent">' + alloc.phaseName + ' · ' + alloc.days + 'd</div>' +
                                                    '</div>'
                                                ).join('') +
                                                '<div class="capacity-summary">' +
                                                    '<span class="capacity-used">' + cap.usedDays + 'd used (' + cap.usedPercent + '%)</span>' +
                                                    '<span class="capacity-available" style="color:' + (cap.availableDaysRaw < 0 ? 'var(--danger);font-weight:600;' : cap.availableDaysRaw < 5 ? 'var(--warning)' : 'var(--success)') + ';">' + 
                                                        (cap.availableDaysRaw < 0 ? cap.availableDaysRaw.toFixed(1) : cap.availableDaysRaw.toFixed(1)) + 'd ' + (cap.availableDaysRaw < 0 ? 'over' : 'free') + 
                                                    '</span>' +
                                                '</div>' +
                                            '</div>' +
                                        '</td>';
                                    }).join('')}
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            },
            attachTimelineEvents() {
                document.getElementById('filter-member')?.addEventListener('change', e => { filters.member = e.target.value ? [e.target.value] : []; this.renderView('timeline'); });
                document.getElementById('filter-system')?.addEventListener('change', e => { filters.system = e.target.value ? [e.target.value] : []; this.renderView('timeline'); });
                document.getElementById('filter-status')?.addEventListener('change', e => { filters.status = e.target.value ? [e.target.value] : []; this.renderView('timeline'); });
                document.getElementById('reset-filters')?.addEventListener('click', () => { filters = { member: [], system: [], status: [] }; this.renderView('timeline'); });
                document.getElementById('bulk-assign-btn')?.addEventListener('click', () => Modal.openBulkAssignModal());
                
                // Timeline view mode toggle buttons
                document.querySelectorAll('.timeline-view-toggle .toggle-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const newMode = btn.dataset.viewMode;
                        if (newMode && newMode !== timelineViewMode) {
                            timelineViewMode = newMode;
                            this.renderView('timeline');
                        }
                    });
                });
                
                // Expandable project rows - show/hide resource allocation
                document.querySelectorAll('.gantt-project-row.has-resources').forEach(row => {
                    row.addEventListener('click', (e) => {
                        // Don't toggle if clicking on the bar itself (for potential future click actions)
                        if (e.target.closest('.gantt-bar')) return;
                        
                        const projectId = row.dataset.projectId;
                        const isExpanded = row.classList.contains('expanded');
                        
                        // Toggle expanded state
                        row.classList.toggle('expanded');
                        
                        // Show/hide resource rows for this project
                        document.querySelectorAll(`.gantt-resource-row[data-project-id="${projectId}"]`).forEach(resourceRow => {
                            resourceRow.classList.toggle('visible', !isExpanded);
                        });
                    });
                });
            },
            renderProjects() {
                const st = getState();
                
                // Filter projects based on search and filters
                let filteredProjects = st.projects;
                
                // Search filter (case-insensitive, searches name and system)
                if (projectFilters.search) {
                    const searchTerm = projectFilters.search.toLowerCase();
                    filteredProjects = filteredProjects.filter(p => 
                        p.name.toLowerCase().includes(searchTerm) ||
                        p.system.toLowerCase().includes(searchTerm) ||
                        p.phases.some(ph => ph.name.toLowerCase().includes(searchTerm)) ||
                        p.phases.some(ph => ph.assignments.some(a => {
                            const member = st.teamMembers.find(m => m.id === a.memberId);
                            return member && member.name.toLowerCase().includes(searchTerm);
                        }))
                    );
                }
                
                // Priority filter
                if (projectFilters.priority) {
                    filteredProjects = filteredProjects.filter(p => p.priority === projectFilters.priority);
                }
                
                // Status filter
                if (projectFilters.status) {
                    filteredProjects = filteredProjects.filter(p => p.status === projectFilters.status);
                }
                
                // System filter
                if (projectFilters.system) {
                    const filterSysId = st.systems.find(s => s.name === projectFilters.system)?.id;
                    filteredProjects = filteredProjects.filter(p => (p.systems || []).includes(filterSysId));
                }
                
                const hasActiveFilters = projectFilters.search || projectFilters.priority || projectFilters.status || projectFilters.system;
                
                return `
                    <div class="projects-header">
                        <h2 style="font-size:20px;font-weight:700;color:var(--gray-900);">Projects</h2>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div class="view-toggle">
                                <button class="view-toggle-btn ${projectViewMode === 'cards' ? 'active' : ''}" data-view-mode="cards" title="Card View">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                                </button>
                                <button class="view-toggle-btn ${projectViewMode === 'list' ? 'active' : ''}" data-view-mode="list" title="List View">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                </button>
                            </div>
                        <button class="btn btn-primary" id="add-project-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            New Project
                        </button>
                        </div>
                    </div>
                    
                    <div class="projects-filters" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;padding:16px;background:var(--gray-50);border-radius:var(--radius-lg);border:1px solid var(--border-light);">
                        <div style="flex:1;min-width:200px;max-width:300px;position:relative;">
                            <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--gray-400);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <input type="text" class="form-input" id="project-search" placeholder="Search projects, systems, phases, members..." 
                                style="padding-left:36px;" value="${this.escapeHtml(projectFilters.search)}">
                        </div>
                        <div class="filter-group">
                            <span class="filter-label">Priority:</span>
                            <select class="form-select" id="project-filter-priority" style="width:120px;">
                                <option value="">All</option>
                                <option value="High" ${projectFilters.priority === 'High' ? 'selected' : ''}>High</option>
                                <option value="Medium" ${projectFilters.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="Low" ${projectFilters.priority === 'Low' ? 'selected' : ''}>Low</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <span class="filter-label">Status:</span>
                            <select class="form-select" id="project-filter-status" style="width:130px;">
                                <option value="">All</option>
                                <option value="Planning" ${projectFilters.status === 'Planning' ? 'selected' : ''}>Planning</option>
                                <option value="Active" ${projectFilters.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="On Hold" ${projectFilters.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                                <option value="Completed" ${projectFilters.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <span class="filter-label">System:</span>
                            <select class="form-select" id="project-filter-system" style="width:140px;">
                                <option value="">All</option>
                                ${(st.systems || []).map(sys => `<option value="${this.escapeHtml(sys.name)}" ${projectFilters.system === sys.name ? 'selected' : ''}>${this.escapeHtml(sys.name)}</option>`).join('')}
                            </select>
                        </div>
                        ${hasActiveFilters ? `
                            <button class="btn btn-ghost btn-sm" id="clear-project-filters" style="margin-left:auto;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                Clear Filters
                            </button>
                        ` : ''}
                    </div>
                    
                    ${st.projects.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-title">No projects yet</div>
                            <div class="empty-state-desc">Create your first project to start planning capacity.</div>
                            <button class="btn btn-primary" id="add-project-btn-empty">Create Project</button>
                        </div>
                    ` : filteredProjects.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-title">No matching projects</div>
                            <div class="empty-state-desc">Try adjusting your search or filters.</div>
                            <button class="btn btn-secondary" id="clear-project-filters-empty">Clear Filters</button>
                        </div>
                    ` : `
                        <div style="margin-bottom:12px;font-size:13px;color:var(--gray-500);display:flex;align-items:center;justify-content:space-between;">
                            <span>Showing ${filteredProjects.length} of ${st.projects.length} projects</span>
                        </div>
                        ${projectViewMode === 'list' ? this.renderProjectListView(filteredProjects) : `
                        <div class="projects-grid" id="projects-grid">
                            ${filteredProjects.map(project => this.renderProjectCard(project)).join('')}
                        </div>
                        `}
                    `}
                `;
            },
            renderProjectListView(projects) {
                const st = getState();
                const sortIcon = `<span class="sort-indicator"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></span>`;
                
                // Sort projects based on current sort state
                const sortedProjects = [...projects].sort((a, b) => {
                    let aVal, bVal;
                    switch (projectSort.field) {
                        case 'name':
                            aVal = a.name.toLowerCase();
                            bVal = b.name.toLowerCase();
                            break;
                        case 'priority':
                            const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
                            aVal = priorityOrder[a.priority] || 4;
                            bVal = priorityOrder[b.priority] || 4;
                            break;
                        case 'system':
                            // Sort by first system name or empty
                            const aFirstSys = st.systems.find(s => (a.systems || [])[0] === s.id);
                            const bFirstSys = st.systems.find(s => (b.systems || [])[0] === s.id);
                            aVal = aFirstSys?.name.toLowerCase() || 'zzz';
                            bVal = bFirstSys?.name.toLowerCase() || 'zzz';
                            break;
                        case 'status':
                            const statusOrder = { 'Active': 1, 'On Hold': 2, 'Completed': 3 };
                            aVal = statusOrder[a.status] || 4;
                            bVal = statusOrder[b.status] || 4;
                            break;
                        case 'timeline':
                            const aRange = Data.getProjectDateRange(a);
                            const bRange = Data.getProjectDateRange(b);
                            aVal = aRange.start || 'Z';
                            bVal = bRange.start || 'Z';
                            break;
                        case 'phases':
                            aVal = a.phases.length;
                            bVal = b.phases.length;
                            break;
                        default:
                            aVal = a.name.toLowerCase();
                            bVal = b.name.toLowerCase();
                    }
                    if (aVal < bVal) return projectSort.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return projectSort.direction === 'asc' ? 1 : -1;
                    return 0;
                });
                
                const getSortClass = (field) => {
                    if (projectSort.field === field) {
                        return `sortable sorted ${projectSort.direction}`;
                    }
                    return 'sortable';
                };
                
                return `
                    <div class="projects-list-container">
                        <table class="projects-list-table">
                            <thead>
                                <tr>
                                    <th style="width:30%;" class="${getSortClass('name')}" data-sort="name">Project ${sortIcon}</th>
                                    <th style="width:10%;" class="${getSortClass('priority')}" data-sort="priority">Priority ${sortIcon}</th>
                                    <th style="width:10%;" class="${getSortClass('system')}" data-sort="system">System ${sortIcon}</th>
                                    <th style="width:12%;" class="${getSortClass('status')}" data-sort="status">Status ${sortIcon}</th>
                                    <th style="width:15%;" class="${getSortClass('timeline')}" data-sort="timeline">Timeline ${sortIcon}</th>
                                    <th style="width:8%;" class="${getSortClass('phases')}" data-sort="phases">Phases ${sortIcon}</th>
                                    <th style="width:15%;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedProjects.map(project => {
                                    const dateRange = Data.getProjectDateRange(project);
                                    const totalAssignments = project.phases.reduce((sum, ph) => sum + ph.assignments.length, 0);
                                    return `
                                        <tr class="project-list-row" data-project-id="${project.id}">
                                            <td>
                                                <div class="project-list-name">${this.escapeHtml(project.name)}</div>
                                                <div class="project-list-assignments">${totalAssignments} assignment${totalAssignments !== 1 ? 's' : ''}</div>
                                            </td>
                                            <td><span class="badge badge-${project.priority.toLowerCase()}">${project.priority}</span></td>
                                            <td>${Templates.systemsBadges(project.systems)}</td>
                                            <td><span class="badge badge-${project.status === 'Active' ? 'success' : project.status === 'On Hold' ? 'warning' : 'gray'}">${project.status}</span></td>
                                            <td>
                                                <span class="project-list-timeline">${dateRange.start || '—'} → ${dateRange.end || '—'}</span>
                                            </td>
                                            <td>
                                                <span class="project-list-phases-count">${project.phases.length}</span>
                                            </td>
                                            <td>
                                                <div class="project-list-actions">
                                                    <button class="btn btn-ghost btn-sm edit-project-btn" data-project-id="${project.id}" title="Edit">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                    </button>
                                                    <button class="btn btn-ghost btn-sm duplicate-project-btn" data-project-id="${project.id}" title="Duplicate">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                                    </button>
                                                    <button class="btn btn-ghost btn-sm delete-project-btn" data-project-id="${project.id}" title="Delete">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="project-list-detail-row" data-project-id="${project.id}">
                                            <td colspan="7">
                                                <div class="project-list-phases">
                                                    ${project.phases.map((phase, idx) => {
                                                        const predPhase = phase.predecessorPhaseId ? project.phases.find(p => p.id === phase.predecessorPhaseId) : null;
                                                        return `
                                                            <div class="project-list-phase">
                                                                <div class="project-list-phase-header">
                                                                    <span class="project-list-phase-name">${idx + 1}. ${this.escapeHtml(phase.name)}</span>
                                                                    <span class="project-list-phase-dates">${phase.startQuarter}${phase.startQuarter !== phase.endQuarter ? ' → ' + phase.endQuarter : ''}</span>
                                                                    ${predPhase ? `<span class="project-list-phase-dep">← ${this.escapeHtml(predPhase.name)}</span>` : ''}
                                                                </div>
                                                                <div class="project-list-phase-assignments">
                                                                    ${phase.assignments.length > 0 ? phase.assignments.map(a => {
                                                                        const member = st.teamMembers.find(m => m.id === a.memberId);
                                                                        return member ? `<span class="phase-assignment">${this.escapeHtml(member.name)} (${a.days || 0}d)</span>` : '';
                                                                    }).join('') : '<span style="color:var(--gray-400);font-size:11px;">No assignments</span>'}
                                                                </div>
                                                            </div>
                                                        `;
                                                    }).join('')}
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            },
            renderProjectCard(project) {
                const st = getState();
                const dateRange = Data.getProjectDateRange(project);
                return `
                    <div class="project-card" data-project-id="${project.id}">
                        <div class="project-card-header">
                            <div class="project-card-top">
                                <div class="project-badges" style="flex-wrap:wrap;">
                                    <span class="badge badge-${project.priority.toLowerCase()}">${project.priority}</span>
                                    ${Templates.systemsBadges(project.systems)}
                                </div>
                                <button class="btn btn-ghost btn-icon edit-project-btn" data-project-id="${project.id}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                </button>
                            </div>
                            <div class="project-name">${this.escapeHtml(project.name)}</div>
                            <div class="project-meta">
                                <span>${dateRange.start || '—'} → ${dateRange.end || '—'}</span>
                                <span>·</span>
                                <span class="badge badge-${project.status === 'Active' ? 'success' : project.status === 'On Hold' ? 'warning' : 'gray'}">${project.status}</span>
                            </div>
                        </div>
                        <div class="project-phases">
                            <div class="phases-title">Phases (${project.phases.length})</div>
                            <div class="phase-list">
                                ${project.phases.map((phase, idx) => {
                                    // Find predecessor phase name
                                    const predPhase = phase.predecessorPhaseId ? project.phases.find(p => p.id === phase.predecessorPhaseId) : null;
                                    return `
                                    <div class="phase-item">
                                        <div class="phase-item-header">
                                            <span class="phase-name">${idx + 1}. ${this.escapeHtml(phase.name)}</span>
                                            <span class="phase-dates">${phase.startQuarter}${phase.startQuarter !== phase.endQuarter ? ' → ' + phase.endQuarter : ''}</span>
                                        </div>
                                        ${predPhase ? `
                                            <div class="phase-dependency" style="margin-bottom:8px;">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                                Depends on: ${this.escapeHtml(predPhase.name)}
                                            </div>
                                        ` : ''}
                                        <div class="phase-assignments">
                                            ${phase.assignments.length > 0 ? phase.assignments.map(a => {
                                                const member = st.teamMembers.find(m => m.id === a.memberId);
                                                return member ? `<span class="phase-assignment">${this.escapeHtml(member.name)} (${a.days || 0}d)</span>` : '';
                                            }).join('') : '<span style="color:var(--gray-400);font-size:12px;">No assignments</span>'}
                                        </div>
                                    </div>
                                `}).join('')}
                            </div>
                        </div>
                        <div class="project-card-footer">
                            <button class="btn btn-ghost btn-sm duplicate-project-btn" data-project-id="${project.id}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                Duplicate
                            </button>
                            <button class="btn btn-ghost btn-sm delete-project-btn" data-project-id="${project.id}">Delete</button>
                        </div>
                    </div>
                `;
            },
            attachProjectsEvents() {
                document.getElementById('add-project-btn')?.addEventListener('click', () => Modal.openProjectModal());
                document.getElementById('add-project-btn-empty')?.addEventListener('click', () => Modal.openProjectModal());
                
                // View toggle buttons
                document.querySelectorAll('.view-toggle-btn[data-view-mode]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        projectViewMode = btn.dataset.viewMode;
                        this.renderView('projects');
                    });
                });
                
                // Sort headers (list view)
                document.querySelectorAll('.projects-list-table th.sortable').forEach(th => {
                    th.addEventListener('click', () => {
                        const field = th.dataset.sort;
                        if (projectSort.field === field) {
                            // Toggle direction if same field
                            projectSort.direction = projectSort.direction === 'asc' ? 'desc' : 'asc';
                        } else {
                            // New field, default to ascending
                            projectSort.field = field;
                            projectSort.direction = 'asc';
                        }
                        this.renderView('projects');
                    });
                });
                
                // List view row expansion
                document.querySelectorAll('.project-list-row').forEach(row => {
                    row.addEventListener('click', (e) => {
                        // Don't expand if clicking on action buttons
                        if (e.target.closest('.project-list-actions')) return;
                        
                        const projectId = row.dataset.projectId;
                        const detailRow = document.querySelector(`.project-list-detail-row[data-project-id="${projectId}"]`);
                        
                        // Toggle this row
                        row.classList.toggle('expanded');
                        detailRow?.classList.toggle('visible');
                    });
                });
                
                // Search with debounce
                let searchTimeout;
                document.getElementById('project-search')?.addEventListener('input', e => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        projectFilters.search = e.target.value;
                        this.renderView('projects');
                    }, 200);
                });
                
                // Priority filter
                document.getElementById('project-filter-priority')?.addEventListener('change', e => {
                    projectFilters.priority = e.target.value;
                    this.renderView('projects');
                });
                
                // Status filter
                document.getElementById('project-filter-status')?.addEventListener('change', e => {
                    projectFilters.status = e.target.value;
                    this.renderView('projects');
                });
                
                // System filter
                document.getElementById('project-filter-system')?.addEventListener('change', e => {
                    projectFilters.system = e.target.value;
                    this.renderView('projects');
                });
                
                // Clear filters
                const clearFilters = () => {
                    projectFilters = { search: '', priority: '', status: '', system: '' };
                    this.renderView('projects');
                };
                document.getElementById('clear-project-filters')?.addEventListener('click', clearFilters);
                document.getElementById('clear-project-filters-empty')?.addEventListener('click', clearFilters);
                
                document.querySelectorAll('.edit-project-btn').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        const projectId = btn.dataset.projectId;
                        const project = getState().projects.find(p => p.id === projectId);
                        if (project) Modal.openProjectModal(project);
                    });
                });
                document.querySelectorAll('.duplicate-project-btn').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        const newProject = Data.duplicateProject(btn.dataset.projectId);
                        if (newProject) {
                            this.renderView('projects');
                            showToast(`Created "${newProject.name}"`, 'success');
                        }
                    });
                });
                document.querySelectorAll('.delete-project-btn').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this project?')) {
                            Data.deleteProject(btn.dataset.projectId);
                            this.renderView('projects');
                            showToast('Project deleted', 'success');
                        }
                    });
                });
            },
            renderTeam() {
                const st = getState();
                const currentQ = Data.getCurrentQuarter();
                const countries = st.countries || [];
                return `
                    <div class="team-header">
                        <h2 style="font-size:20px;font-weight:700;color:var(--gray-900);">Team</h2>
                        <div style="display:flex;align-items:center;gap:16px;">
                            <div class="filter-group">
                                <span class="filter-label">Quarter:</span>
                                <select class="form-select" id="team-quarter-filter" style="width:130px;">
                                    ${st.quarters.map(q => `<option value="${q}" ${q === currentQ ? 'selected' : ''}>${q}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <table class="team-table">
                        <thead><tr><th>Member</th><th>Role</th><th>Country</th><th>Workdays</th><th>Capacity</th><th>Available</th><th>Projects</th></tr></thead>
                        <tbody>
                            ${st.teamMembers.map(member => {
                                const cap = Capacity.calculate(member.id, currentQ);
                                const projectAllocations = cap.breakdown.filter(b => b.type === 'project');
                                const memberCountry = countries.find(c => c.id === member.countryId);
                                return `
                                    <tr data-member-id="${member.id}" style="cursor:pointer;">
                                        <td><div class="member-name">${this.escapeHtml(member.name)}</div></td>
                                        <td><span class="member-role">${this.escapeHtml(member.role)}</span></td>
                                        <td><span style="font-size:12px;color:var(--gray-500);">${memberCountry?.code || '—'}</span></td>
                                        <td><span style="font-family:var(--font-mono);font-size:12px;">${cap.totalWorkdays}d</span></td>
                                        <td>
                                            <div class="capacity-bar-container">
                                                <div class="capacity-bar">${this.renderCapacityBar(cap)}</div>
                                                <div class="capacity-percent">${cap.usedDays}d (${cap.usedPercent}%)</div>
                                            </div>
                                        </td>
                                        <td><span style="font-family:var(--font-mono);font-weight:${cap.availableDaysRaw < 0 ? '600' : 'normal'};color:${cap.availableDaysRaw < 0 ? 'var(--danger)' : cap.availableDaysRaw > (cap.totalWorkdays * 0.2) ? 'var(--success)' : 'var(--warning)'};">${cap.availableDaysRaw < 0 ? cap.availableDaysRaw.toFixed(1) : cap.availableDaysRaw.toFixed(1)}d</span></td>
                                        <td>
                                            <div class="member-projects">
                                                ${projectAllocations.map(a => `<span class="member-project-tag">${this.escapeHtml(a.projectName)} (${a.days}d)</span>`).join('')}
                                                ${projectAllocations.length === 0 ? '<span style="color:var(--gray-400);">—</span>' : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            },
            renderCapacityBar(cap) {
                const segments = [];
                const totalDays = cap.totalWorkdays || 1;
                let remainingPercent = Math.min(cap.usedPercent, 100);
                
                const bauItem = cap.breakdown.find(b => b.type === 'bau');
                if (bauItem) { 
                    const w = Math.round((bauItem.days / totalDays) * 100);
                    segments.push(`<div class="capacity-segment bau" style="width:${Math.min(w, remainingPercent)}%;"></div>`); 
                    remainingPercent -= w; 
                }
                const toItem = cap.breakdown.find(b => b.type === 'timeoff');
                if (toItem && remainingPercent > 0) { 
                    const w = Math.round((toItem.days / totalDays) * 100);
                    segments.push(`<div class="capacity-segment timeoff" style="width:${Math.min(w, remainingPercent)}%;"></div>`); 
                    remainingPercent -= w; 
                }
                cap.breakdown.filter(b => b.type === 'project').forEach(item => {
                    if (remainingPercent > 0) { 
                        const w = Math.round((item.days / totalDays) * 100);
                        segments.push(`<div class="capacity-segment project" style="width:${Math.min(w, remainingPercent)}%;"></div>`); 
                        remainingPercent -= w; 
                    }
                });
                if (cap.usedDays > totalDays) {
                    const overflowPercent = Math.min(Math.round(((cap.usedDays - totalDays) / totalDays) * 100), 20);
                    segments.push(`<div class="capacity-segment overflow" style="width:${overflowPercent}%;"></div>`);
                }
                return segments.join('');
            },
            attachTeamEvents() {
                document.querySelectorAll('.team-table tbody tr').forEach(row => {
                    row.addEventListener('click', () => { filters.member = [row.dataset.memberId]; this.renderView('timeline'); });
                });
            },
            renderSettings() {
                const st = getState();
                return `
                    <div class="settings-container">
                        <nav class="settings-nav">
                            <button class="settings-nav-btn ${currentSettingsSection === 'general' ? 'active' : ''}" data-section="general">General</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'countries' ? 'active' : ''}" data-section="countries">Countries</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'holidays' ? 'active' : ''}" data-section="holidays">Public Holidays</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'systems' ? 'active' : ''}" data-section="systems">Systems</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'roles' ? 'active' : ''}" data-section="roles">Roles</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'skills' ? 'active' : ''}" data-section="skills">Skills</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'team' ? 'active' : ''}" data-section="team">Team Members</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'timeoff' ? 'active' : ''}" data-section="timeoff">Time Off</button>
                            <button class="settings-nav-btn ${currentSettingsSection === 'data' ? 'active' : ''}" data-section="data">Data Management</button>
                        </nav>
                        <div class="settings-content">${this.renderSettingsSection()}</div>
                    </div>
                `;
            },
            renderSettingsSection() {
                const st = getState();
                switch(currentSettingsSection) {
                    case 'general':
                        const currentQ = Data.getCurrentQuarter();
                        const quarterInfo = Calendar.getQuarterBreakdown(currentQ, st.publicHolidays || []);
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">General Settings</h3>
                            <div style="margin-bottom:20px;padding:12px 16px;background:var(--primary-subtle);border-radius:var(--radius-md);border:1px solid var(--primary-light);">
                                <div style="font-weight:600;color:var(--primary);margin-bottom:4px;">Current Quarter: ${currentQ}</div>
                                <div style="font-size:13px;color:var(--gray-600);">
                                    ${quarterInfo?.workdays || 0} workdays · ${quarterInfo?.holidayDays || 0} holidays · ${quarterInfo?.weekendDays || 0} weekend days
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">BAU Reserve (days)</div><div class="settings-row-desc">Default days reserved for BAU activities per quarter</div></div>
                                <div class="settings-row-control">
                                    <div style="display:flex;align-items:center;gap:12px;">
                                        <input type="number" class="form-input" id="bau-reserve-days" min="0" max="20" step="0.5" value="${st.settings.bauReserveDays || 5}" style="width:80px;">
                                        <span style="color:var(--gray-500);">days</span>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Hours per Day</div><div class="settings-row-desc">Standard working hours per day</div></div>
                                <div class="settings-row-control">
                                    <div style="display:flex;align-items:center;gap:12px;">
                                        <input type="number" class="form-input" id="hours-per-day" min="4" max="12" step="0.5" value="${st.settings.hoursPerDay || 8}" style="width:80px;">
                                        <span style="color:var(--gray-500);">hours</span>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Quarters to Show</div><div class="settings-row-desc">Number of quarters in timeline views</div></div>
                                <div class="settings-row-control">
                                    <select class="form-select" id="quarters-to-show">
                                        <option value="4" ${st.settings.quartersToShow === 4 ? 'selected' : ''}>4 Quarters</option>
                                        <option value="8" ${st.settings.quartersToShow === 8 ? 'selected' : ''}>8 Quarters</option>
                                        <option value="12" ${st.settings.quartersToShow === 12 ? 'selected' : ''}>12 Quarters</option>
                                    </select>
                                </div>
                            </div>
                            <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border-light);">
                                <h4 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">Sprint Configuration</h4>
                                <p style="font-size:12px;color:var(--gray-500);margin-bottom:16px;">Sprints use YY-XX naming format (e.g., 26-01, 26-08). Configure your sprint calendar below.</p>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Sprint Duration</div><div class="settings-row-desc">Length of each sprint in weeks</div></div>
                                <div class="settings-row-control">
                                    <select class="form-select" id="sprint-duration" style="width:120px;">
                                        <option value="1" ${st.settings.sprintDurationWeeks === 1 ? 'selected' : ''}>1 week</option>
                                        <option value="2" ${st.settings.sprintDurationWeeks === 2 ? 'selected' : ''}>2 weeks</option>
                                        <option value="3" ${st.settings.sprintDurationWeeks === 3 ? 'selected' : ''}>3 weeks</option>
                                        <option value="4" ${st.settings.sprintDurationWeeks === 4 ? 'selected' : ''}>4 weeks</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">First Sprint Start Date</div><div class="settings-row-desc">The start date of Sprint 26-01 (should be a Monday)</div></div>
                                <div class="settings-row-control">
                                    <input type="date" class="form-input" id="sprint-start-date" value="${st.settings.sprintStartDate || '2026-01-05'}" style="width:160px;">
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Sprints Per Year</div><div class="settings-row-desc">Total number of sprints in each year</div></div>
                                <div class="settings-row-control">
                                    <select class="form-select" id="sprints-per-year" style="width:120px;">
                                        <option value="12" ${st.settings.sprintsPerYear === 12 ? 'selected' : ''}>12 Sprints</option>
                                        <option value="16" ${st.settings.sprintsPerYear === 16 ? 'selected' : ''}>16 Sprints</option>
                                        <option value="17" ${st.settings.sprintsPerYear === 17 ? 'selected' : ''}>17 Sprints</option>
                                        <option value="18" ${st.settings.sprintsPerYear === 18 ? 'selected' : ''}>18 Sprints</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Bye Weeks After</div><div class="settings-row-desc">Sprint numbers followed by a 1-week bye/catch-up week</div></div>
                                <div class="settings-row-control">
                                    <input type="text" class="form-input" id="bye-weeks-after" value="${(st.settings.byeWeeksAfter || [8, 12]).join(', ')}" placeholder="8, 12" style="width:120px;">
                                    <span style="font-size:11px;color:var(--gray-400);margin-left:8px;">comma-separated</span>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Sprints to Show</div><div class="settings-row-desc">Number of sprints to display in timeline views</div></div>
                                <div class="settings-row-control">
                                    <select class="form-select" id="sprints-to-show" style="width:120px;">
                                        <option value="4" ${st.settings.sprintsToShow === 4 ? 'selected' : ''}>4 Sprints</option>
                                        <option value="6" ${st.settings.sprintsToShow === 6 ? 'selected' : ''}>6 Sprints</option>
                                        <option value="8" ${st.settings.sprintsToShow === 8 ? 'selected' : ''}>8 Sprints</option>
                                        <option value="12" ${st.settings.sprintsToShow === 12 ? 'selected' : ''}>12 Sprints</option>
                                        <option value="16" ${st.settings.sprintsToShow === 16 ? 'selected' : ''}>16 Sprints</option>
                                    </select>
                                </div>
                            </div>
                            <div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:var(--radius-md);border:1px solid var(--border-light);">
                                <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:8px;">Sprint Calendar Preview (${new Date(st.settings.sprintStartDate || '2026-01-05').getFullYear()})</div>
                                <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;">
                                    ${(() => {
                                        const sprints = Calendar.generateSprints(st.settings.sprintsPerYear || 16);
                                        const byeWeeks = st.settings.byeWeeksAfter || [8, 12];
                                        return sprints.map(s => {
                                            const data = Calendar.parseSprint(s);
                                            const hasBye = byeWeeks.includes(data?.sprint);
                                            const dateStr = Calendar.formatSprintDates(s);
                                            return '<span style="padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-sm);" title="' + dateStr + '">' + s + (hasBye ? ' <span style="color:var(--warning);">+bye</span>' : '') + '</span>';
                                        }).join('');
                                    })()}
                                </div>
                            </div>
                        </div>`;
                    case 'roles':
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Roles Management</h3>
                            <div style="display:flex;gap:12px;margin-bottom:16px;">
                                <input type="text" class="form-input" id="new-role-name" placeholder="Role name" style="flex:1;">
                                <button class="btn btn-primary" id="add-role-btn">Add Role</button>
                            </div>
                            <table class="data-table">
                                <thead><tr><th>Role Name</th><th style="width:120px;">Actions</th></tr></thead>
                                <tbody>${(st.roles || []).map(role => `<tr data-role-id="${role.id}"><td><input type="text" class="form-input role-name-input" value="${this.escapeHtml(role.name)}" style="border:none;background:transparent;padding:0;"></td><td><button class="btn btn-ghost btn-sm save-role-btn" data-role-id="${role.id}">Save</button><button class="btn btn-ghost btn-sm delete-role-btn" data-role-id="${role.id}">Delete</button></td></tr>`).join('')}</tbody>
                            </table>
                        </div>`;
                    case 'skills':
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Skills Management</h3>
                            <div style="display:flex;gap:12px;margin-bottom:16px;">
                                <input type="text" class="form-input" id="new-skill-name" placeholder="Skill name" style="flex:1;">
                                <select class="form-select" id="new-skill-category" style="width:150px;"><option value="System">System</option><option value="Process">Process</option><option value="Technical">Technical</option></select>
                                <button class="btn btn-primary" id="add-skill-btn">Add Skill</button>
                            </div>
                            <table class="data-table">
                                <thead><tr><th>Skill Name</th><th>Category</th><th style="width:100px;">Actions</th></tr></thead>
                                <tbody>${st.skills.map(skill => `<tr><td>${this.escapeHtml(skill.name)}</td><td><span class="skill-tag ${skill.category.toLowerCase()}">${skill.category}</span></td><td><button class="btn btn-ghost btn-sm delete-skill-btn" data-skill-id="${skill.id}">Delete</button></td></tr>`).join('')}</tbody>
                            </table>
                        </div>`;
                    case 'systems':
                        const systems = st.systems || [];
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Systems Management</h3>
                            <p style="color:var(--gray-500);font-size:13px;margin-bottom:16px;">Systems are the applications that are implemented or changed in projects.</p>
                            <div style="display:flex;gap:12px;margin-bottom:16px;">
                                <input type="text" class="form-input" id="new-system-name" placeholder="System name (e.g. SAP)" style="width:150px;">
                                <input type="text" class="form-input" id="new-system-desc" placeholder="Description (optional)" style="flex:1;">
                                <button class="btn btn-primary" id="add-system-btn">Add System</button>
                            </div>
                            <table class="data-table">
                                <thead><tr><th style="width:150px;">System</th><th>Description</th><th style="width:100px;">Projects</th><th style="width:120px;">Actions</th></tr></thead>
                                <tbody>
                                    ${systems.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);">No systems configured</td></tr>' : 
                                    systems.map(sys => {
                                        const projectCount = st.projects.filter(p => p.system === sys.name).length;
                                        return `<tr data-system-id="${sys.id}">
                                            <td><input type="text" class="form-input system-name-input" value="${this.escapeHtml(sys.name)}" style="border:none;background:transparent;padding:0;font-weight:600;"></td>
                                            <td><input type="text" class="form-input system-desc-input" value="${this.escapeHtml(sys.description || '')}" style="border:none;background:transparent;padding:0;color:var(--gray-500);"></td>
                                            <td>${projectCount}</td>
                                            <td>
                                                <button class="btn btn-ghost btn-sm save-system-btn" data-system-id="${sys.id}">Save</button>
                                                <button class="btn btn-ghost btn-sm delete-system-btn" data-system-id="${sys.id}" ${projectCount > 0 ? 'disabled title="Used in projects"' : ''}>Delete</button>
                                            </td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>`;
                    case 'team':
                        const teamCountries = st.countries || [];
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Team Members</h3>
                            <button class="btn btn-primary" id="add-member-btn" style="margin-bottom:16px;">Add Team Member</button>
                            <table class="data-table">
                                <thead><tr><th>Name</th><th>Role</th><th>Country</th><th>Skills</th><th>Max Projects</th><th style="width:120px;">Actions</th></tr></thead>
                                <tbody>${st.teamMembers.map(m => {
                                    const memberCountry = teamCountries.find(c => c.id === m.countryId);
                                    return `<tr><td><strong>${this.escapeHtml(m.name)}</strong></td><td>${this.escapeHtml(m.role)}</td><td>${memberCountry ? memberCountry.code : '—'}</td><td>${m.skillIds.length} skills</td><td>${m.maxConcurrentProjects}</td><td><button class="btn btn-ghost btn-sm edit-member-btn" data-member-id="${m.id}">Edit</button><button class="btn btn-ghost btn-sm delete-member-btn" data-member-id="${m.id}">Delete</button></td></tr>`;
                                }).join('')}</tbody>
                            </table>
                        </div>`;
                    case 'timeoff':
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Time Off</h3>
                            <button class="btn btn-primary" id="add-timeoff-btn" style="margin-bottom:16px;">Add Time Off</button>
                            <table class="data-table">
                                <thead><tr><th>Member</th><th>Quarter</th><th>Days</th><th>Reason</th><th style="width:80px;">Actions</th></tr></thead>
                                <tbody>${st.timeOff.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);">No time off records</td></tr>' : st.timeOff.map(to => { const m = st.teamMembers.find(x => x.id === to.memberId); return `<tr><td>${m ? this.escapeHtml(m.name) : '—'}</td><td>${to.quarter}</td><td>${to.days || 0}d</td><td>${this.escapeHtml(to.reason || '—')}</td><td><button class="btn btn-ghost btn-sm delete-timeoff-btn" data-timeoff-id="${to.id}">Delete</button></td></tr>`; }).join('')}</tbody>
                            </table>
                        </div>`;
                    case 'countries':
                        const countries = st.countries || [];
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Countries</h3>
                            <p style="color:var(--gray-500);font-size:13px;margin-bottom:16px;">Manage countries for team member assignments and public holidays.</p>
                            <div style="display:flex;gap:12px;margin-bottom:16px;">
                                <input type="text" class="form-input" id="new-country-code" placeholder="Code (e.g. DE)" style="width:100px;" maxlength="3">
                                <input type="text" class="form-input" id="new-country-name" placeholder="Country name" style="flex:1;">
                                <button class="btn btn-primary" id="add-country-btn">Add Country</button>
                            </div>
                            <table class="data-table">
                                <thead><tr><th style="width:80px;">Code</th><th>Name</th><th style="width:120px;">Team Members</th><th style="width:100px;">Holidays</th><th style="width:100px;">Actions</th></tr></thead>
                                <tbody>
                                    ${countries.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);">No countries configured</td></tr>' : 
                                    countries.map(c => {
                                        const memberCount = st.teamMembers.filter(m => m.countryId === c.id).length;
                                        const holidayCount = (st.publicHolidays || []).filter(h => h.countryId === c.id).length;
                                        return `<tr>
                                            <td><strong>${this.escapeHtml(c.code)}</strong></td>
                                            <td>${this.escapeHtml(c.name)}</td>
                                            <td>${memberCount}</td>
                                            <td>${holidayCount}</td>
                                            <td><button class="btn btn-ghost btn-sm delete-country-btn" data-country-id="${c.id}" ${memberCount > 0 ? 'disabled title="Reassign members first"' : ''}>Delete</button></td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>`;
                    case 'holidays':
                        const allHolidays = st.publicHolidays || [];
                        const allCountries = st.countries || [];
                        // Group by country, then by year
                        const holidaysByCountry = allCountries.map(country => {
                            const countryHolidays = allHolidays.filter(h => h.countryId === country.id);
                            const byYear = countryHolidays.reduce((acc, h) => {
                                const year = h.date.substring(0, 4);
                                if (!acc[year]) acc[year] = [];
                                acc[year].push(h);
                                return acc;
                            }, {});
                            return { country, holidays: countryHolidays, byYear };
                        });
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Public Holidays</h3>
                            <div style="margin-bottom:16px;">
                                <p style="color:var(--gray-500);font-size:13px;margin-bottom:12px;">Public holidays are excluded from workday calculations for team members assigned to that country.</p>
                                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                                    <select class="form-select" id="new-holiday-country" style="width:180px;">
                                        ${allCountries.map(c => `<option value="${c.id}">${c.code} - ${this.escapeHtml(c.name)}</option>`).join('')}
                                    </select>
                                    <input type="date" class="form-input" id="new-holiday-date" style="width:160px;">
                                    <input type="text" class="form-input" id="new-holiday-name" placeholder="Holiday name" style="flex:1;min-width:200px;">
                                    <button class="btn btn-primary" id="add-holiday-btn">Add Holiday</button>
                                </div>
                            </div>
                            ${holidaysByCountry.map(({ country, holidays, byYear }) => `
                                <div style="margin-bottom:24px;padding:16px;background:var(--gray-50);border-radius:var(--radius-lg);border:1px solid var(--border-light);">
                                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                                        <span style="font-size:16px;font-weight:700;color:var(--gray-800);">${this.escapeHtml(country.code)}</span>
                                        <span style="color:var(--gray-600);">${this.escapeHtml(country.name)}</span>
                                        <span style="font-size:12px;color:var(--gray-400);">(${holidays.length} holidays)</span>
                                    </div>
                                    ${Object.keys(byYear).length === 0 ? '<p style="color:var(--gray-400);font-size:13px;">No holidays configured for this country</p>' : 
                                    Object.keys(byYear).sort().reverse().map(year => `
                                        <div style="margin-bottom:12px;">
                                            <div style="font-size:13px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">${year}</div>
                                            <table class="data-table" style="margin-bottom:0;">
                                                <tbody>
                                                    ${byYear[year].sort((a, b) => a.date.localeCompare(b.date)).map(h => {
                                                        const hDate = new Date(h.date);
                                                        const q = Math.ceil((hDate.getMonth() + 1) / 3);
                                                        return `<tr>
                                                            <td style="width:100px;">${h.date}</td>
                                                            <td>${this.escapeHtml(h.name)}</td>
                                                            <td style="width:80px;">Q${q}</td>
                                                            <td style="width:60px;"><button class="btn btn-ghost btn-sm delete-holiday-btn" data-holiday-id="${h.id}">×</button></td>
                                                        </tr>`;
                                                    }).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `).join('')}
                                </div>
                            `).join('')}
                            ${allCountries.length === 0 ? '<p style="color:var(--gray-400);text-align:center;">Add countries first in the Countries tab</p>' : ''}
                        </div>`;
                    case 'data':
                        return `<div class="settings-section active">
                            <h3 class="settings-section-title">Data Management</h3>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Export Data</div><div class="settings-row-desc">Download your data</div></div>
                                <div class="settings-row-control" style="display:flex;gap:8px;">
                                    <button class="btn btn-secondary btn-sm" id="export-json-btn">Export JSON</button>
                                    <button class="btn btn-secondary btn-sm" id="export-excel-btn">Export Excel</button>
                                    <button class="btn btn-outline btn-sm" id="export-excel-template-btn">Download Excel Template</button>
                                </div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Import Data</div><div class="settings-row-desc">Upload a JSON backup file</div></div>
                                <div class="settings-row-control"><input type="file" id="import-file" accept=".json" class="form-input"></div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Import from Excel</div><div class="settings-row-desc">Use the Excel template (.xlsx)</div></div>
                                <div class="settings-row-control"><input type="file" id="import-excel-file" accept=".xlsx" class="form-input"></div>
                            </div>
                            <div class="settings-row">
                                <div><div class="settings-row-label">Reset Data</div><div class="settings-row-desc">Clear all data and start fresh</div></div>
                                <div class="settings-row-control"><button class="btn btn-danger btn-sm" id="reset-data-btn">Reset All Data</button></div>
                            </div>
                        </div>`;
                    default: return '';
                }
            },
            attachSettingsEvents() {
                document.querySelectorAll('.settings-nav-btn').forEach(btn => {
                    btn.addEventListener('click', () => { currentSettingsSection = btn.dataset.section; this.renderView('settings'); });
                });
                // BAU Reserve Days
                document.getElementById('bau-reserve-days')?.addEventListener('change', e => {
                    Data.updateSettings({ bauReserveDays: parseFloat(e.target.value) || 5 });
                    showToast('BAU reserve updated', 'success');
                });
                // Hours per Day
                document.getElementById('hours-per-day')?.addEventListener('change', e => {
                    Data.updateSettings({ hoursPerDay: parseFloat(e.target.value) || 8 });
                    showToast('Hours per day updated', 'success');
                });
                // Add Country
                document.getElementById('add-country-btn')?.addEventListener('click', () => {
                    const code = document.getElementById('new-country-code').value.trim().toUpperCase();
                    const name = document.getElementById('new-country-name').value.trim();
                    if (!code || !name) { showToast('Please enter code and name', 'error'); return; }
                    if (code.length > 3) { showToast('Code must be 3 characters or less', 'error'); return; }
                    Data.addCountry({ code, name });
                    showToast('Country added', 'success');
                    this.renderView('settings');
                });
                // Delete Country
                document.querySelectorAll('.delete-country-btn').forEach(btn => {
                    if (!btn.disabled) {
                        btn.addEventListener('click', () => {
                            if (confirm('Delete this country and all its holidays?')) {
                                const result = Data.deleteCountry(btn.dataset.countryId);
                                if (result.error) showToast(result.error, 'error');
                                else { showToast('Country deleted', 'success'); this.renderView('settings'); }
                            }
                        });
                    }
                });
                // Add Holiday (with country)
                document.getElementById('add-holiday-btn')?.addEventListener('click', () => {
                    const countryId = document.getElementById('new-holiday-country')?.value;
                    const date = document.getElementById('new-holiday-date').value;
                    const name = document.getElementById('new-holiday-name').value.trim();
                    if (!countryId) { showToast('Please select a country', 'error'); return; }
                    if (!date || !name) { showToast('Please enter date and name', 'error'); return; }
                    Data.addPublicHoliday({ countryId, date, name });
                    showToast('Holiday added', 'success');
                    this.renderView('settings');
                });
                // Delete Holiday
                document.querySelectorAll('.delete-holiday-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Data.deletePublicHoliday(btn.dataset.holidayId);
                        showToast('Holiday deleted', 'success');
                        this.renderView('settings');
                    });
                });
                document.getElementById('quarters-to-show')?.addEventListener('change', e => {
                    Data.updateSettings({ quartersToShow: parseInt(e.target.value) });
                });
                // Sprint settings handlers
                document.getElementById('sprint-duration')?.addEventListener('change', e => {
                    Data.updateSettings({ sprintDurationWeeks: parseInt(e.target.value) });
                    showToast('Sprint duration updated', 'success');
                    this.renderView('settings'); // Refresh to update preview
                });
                document.getElementById('sprint-start-date')?.addEventListener('change', e => {
                    Data.updateSettings({ sprintStartDate: e.target.value });
                    showToast('Sprint start date updated', 'success');
                    this.renderView('settings'); // Refresh to update preview
                });
                document.getElementById('sprints-per-year')?.addEventListener('change', e => {
                    Data.updateSettings({ sprintsPerYear: parseInt(e.target.value) });
                    showToast('Sprints per year updated', 'success');
                    this.renderView('settings'); // Refresh to update preview
                });
                document.getElementById('bye-weeks-after')?.addEventListener('change', e => {
                    const value = e.target.value;
                    const byeWeeks = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
                    Data.updateSettings({ byeWeeksAfter: byeWeeks });
                    showToast('Bye weeks updated', 'success');
                    this.renderView('settings'); // Refresh to update preview
                });
                document.getElementById('sprints-to-show')?.addEventListener('change', e => {
                    Data.updateSettings({ sprintsToShow: parseInt(e.target.value) });
                });
                document.getElementById('add-skill-btn')?.addEventListener('click', () => {
                    const name = document.getElementById('new-skill-name').value.trim();
                    const category = document.getElementById('new-skill-category').value;
                    if (name) { Data.addSkill({ name, category }); this.renderView('settings'); showToast('Skill added', 'success'); }
                });
                document.querySelectorAll('.delete-skill-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const result = Data.deleteSkill(btn.dataset.skillId);
                        if (result.error) showToast(result.error, 'error');
                        else { this.renderView('settings'); showToast('Skill deleted', 'success'); }
                    });
                });
                document.getElementById('add-role-btn')?.addEventListener('click', () => {
                    const name = document.getElementById('new-role-name').value.trim();
                    if (name) { Data.addRole({ name }); this.renderView('settings'); showToast('Role added', 'success'); }
                    else { showToast('Role name is required', 'error'); }
                });
                document.querySelectorAll('.save-role-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const row = btn.closest('tr');
                        const roleId = btn.dataset.roleId;
                        const name = row.querySelector('.role-name-input').value.trim();
                        if (name) { Data.updateRole(roleId, { name }); this.renderView('settings'); showToast('Role updated', 'success'); }
                        else { showToast('Role name is required', 'error'); }
                    });
                });
                document.querySelectorAll('.delete-role-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (confirm('Delete this role?')) {
                            const result = Data.deleteRole(btn.dataset.roleId);
                            if (result.error) showToast(result.error, 'error');
                            else { this.renderView('settings'); showToast('Role deleted', 'success'); }
                        }
                    });
                });
                // System event handlers
                document.getElementById('add-system-btn')?.addEventListener('click', () => {
                    const name = document.getElementById('new-system-name').value.trim();
                    const description = document.getElementById('new-system-desc').value.trim();
                    if (name) { 
                        Data.addSystem({ name, description }); 
                        this.renderView('settings'); 
                        showToast('System added', 'success'); 
                    } else { 
                        showToast('System name is required', 'error'); 
                    }
                });
                document.querySelectorAll('.save-system-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const row = btn.closest('tr');
                        const systemId = btn.dataset.systemId;
                        const name = row.querySelector('.system-name-input').value.trim();
                        const description = row.querySelector('.system-desc-input').value.trim();
                        if (name) { 
                            Data.updateSystem(systemId, { name, description }); 
                            this.renderView('settings'); 
                            showToast('System updated', 'success'); 
                        } else { 
                            showToast('System name is required', 'error'); 
                        }
                    });
                });
                document.querySelectorAll('.delete-system-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (confirm('Delete this system?')) {
                            const result = Data.deleteSystem(btn.dataset.systemId);
                            if (result.error) showToast(result.error, 'error');
                            else { this.renderView('settings'); showToast('System deleted', 'success'); }
                        }
                    });
                });
                document.getElementById('add-member-btn')?.addEventListener('click', () => Modal.openMemberModal());
                document.querySelectorAll('.edit-member-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const member = getState().teamMembers.find(m => m.id === btn.dataset.memberId);
                        if (member) Modal.openMemberModal(member);
                    });
                });
                document.querySelectorAll('.delete-member-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (confirm('Delete this team member?')) {
                            const result = Data.deleteTeamMember(btn.dataset.memberId);
                            if (result.error) showToast(result.error, 'error');
                            else { this.renderView('settings'); showToast('Member deleted', 'success'); }
                        }
                    });
                });
                document.getElementById('add-timeoff-btn')?.addEventListener('click', () => Modal.openTimeOffModal());
                document.querySelectorAll('.delete-timeoff-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Data.deleteTimeOff(btn.dataset.timeoffId);
                        this.renderView('settings');
                        showToast('Time off deleted', 'success');
                    });
                });
                document.getElementById('export-json-btn')?.addEventListener('click', () => Export.toJSON());
                document.getElementById('export-excel-btn')?.addEventListener('click', () => Export.toExcel());
                document.getElementById('export-excel-template-btn')?.addEventListener('click', () => Export.toExcelTemplate());
                document.getElementById('import-file')?.addEventListener('change', e => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                            try {
                                const data = JSON.parse(ev.target.result);
                                if (data.version) {
                                    state = data;
                                    Storage.save(state);
                                    this.renderView('settings');
                                    showToast('Data imported successfully', 'success');
                                } else throw new Error('Invalid format');
                            } catch (err) { showToast('Invalid file format', 'error'); }
                        };
                        reader.readAsText(file);
                    }
                });
                document.getElementById('import-excel-file')?.addEventListener('change', e => {
                    const file = e.target.files[0];
                    if (file) {
                        Export.importExcel(file);
                        e.target.value = '';
                    }
                });
                document.getElementById('reset-data-btn')?.addEventListener('click', () => {
                    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                        state.quarters = generateQuarters();
                        Storage.save(state);
                        this.renderView('settings');
                        showToast('Data reset complete', 'success');
                    }
                });
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 10: MODAL MODULE
           Dialog management for forms and confirmations
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Modal module for dialog management
         * Handles project, member, time-off, and bulk assignment modals
         */
        const Modal = {
            log: (msg, data) => console.log(`[Modal] ${msg}`, data || ''),
            open(title, bodyHtml, footerHtml) {
                document.getElementById('modal-title').textContent = title;
                document.getElementById('modal-body').innerHTML = bodyHtml;
                document.getElementById('modal-footer').innerHTML = footerHtml;
                document.getElementById('modal-overlay').classList.add('visible');
            },
            close() {
                document.getElementById('modal-overlay').classList.remove('visible');
            },
            openProjectModal(existingProject = null) {
                const st = getState();
                const isEdit = !!existingProject;
                const defaultSystem = (st.systems && st.systems.length > 0) ? st.systems[0].name : 'ERP';
                const project = existingProject || {
                    name: '', priority: 'Medium', system: defaultSystem, status: 'Planning',
                    phases: [{ id: Data.generateId('phase'), name: 'Main', startQuarter: Data.getCurrentQuarter(), endQuarter: Data.getCurrentQuarter(), requiredSkillIds: [], predecessorPhaseId: null, assignments: [] }]
                };
                
                const bodyHtml = `
                    <div class="form-group">
                        <label class="form-label">Project Name *</label>
                        <input type="text" class="form-input" id="project-name" value="${UI.escapeHtml(project.name)}" placeholder="Enter project name">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
                        <div class="form-group">
                            <label class="form-label">Priority *</label>
                            <select class="form-select" id="project-priority">
                                <option value="High" ${project.priority === 'High' ? 'selected' : ''}>High</option>
                                <option value="Medium" ${project.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="Low" ${project.priority === 'Low' ? 'selected' : ''}>Low</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Systems</label>
                            <div class="system-checkbox-grid" id="project-systems">
                                ${(st.systems || []).map(sys => {
                                    const isChecked = (project.systems || []).includes(sys.id);
                                    return `
                                        <label class="system-checkbox-item ${isChecked ? 'checked' : ''}">
                                            <input type="checkbox" value="${sys.id}" ${isChecked ? 'checked' : ''}>
                                            <span>${UI.escapeHtml(sys.name)}</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status *</label>
                            <select class="form-select" id="project-status">
                                <option value="Planning" ${project.status === 'Planning' ? 'selected' : ''}>Planning</option>
                                <option value="Active" ${project.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="On Hold" ${project.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                                <option value="Completed" ${project.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </div>
                    </div>
                    <hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                        <span style="font-weight:600;color:var(--gray-800);">Phases</span>
                        <button class="btn btn-secondary btn-sm" id="add-phase-btn">+ Add Phase</button>
                    </div>
                    <div id="phases-container">
                        ${project.phases.map((phase, idx) => this.renderPhaseForm(phase, idx, st, project.phases)).join('')}
                    </div>
                `;
                
                const footerHtml = `
                    <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button class="btn btn-primary" id="save-project-btn">${isEdit ? 'Update' : 'Create'} Project</button>
                `;
                
                this.open(isEdit ? 'Edit Project' : 'New Project', bodyHtml, footerHtml);
                this.attachProjectModalEvents(existingProject);
            },
            renderPhaseForm(phase, idx, st, allPhases = []) {
                // Get phases that can be predecessors (phases before this one in the list)
                const availablePredecessors = allPhases.slice(0, idx);
                return `
                    <div class="phase-form" data-phase-idx="${idx}" data-phase-id="${phase.id || ''}" style="padding:16px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:12px;border:1px solid var(--border-light);">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                            <span style="font-weight:600;">Phase ${idx + 1}</span>
                            <button class="btn btn-ghost btn-sm remove-phase-btn" data-phase-idx="${idx}">Remove</button>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phase Name</label>
                            <input type="text" class="form-input phase-name" value="${UI.escapeHtml(phase.name)}" placeholder="Phase name">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
                            <div class="form-group">
                                <label class="form-label">Start Quarter</label>
                                <select class="form-select phase-start">${st.quarters.map(q => `<option value="${q}" ${phase.startQuarter === q ? 'selected' : ''}>${q}</option>`).join('')}</select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">End Quarter</label>
                                <select class="form-select phase-end">${st.quarters.map(q => `<option value="${q}" ${phase.endQuarter === q ? 'selected' : ''}>${q}</option>`).join('')}</select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Depends On</label>
                                <select class="form-select phase-dependency">
                                    <option value="">No dependency</option>
                                    ${availablePredecessors.map((p, i) => `<option value="${p.id || i}" ${phase.predecessorPhaseId === (p.id || String(i)) ? 'selected' : ''}>${UI.escapeHtml(p.name || `Phase ${i + 1}`)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Team Assignments (in workdays)</label>
                            <div class="assignments-container" data-phase-idx="${idx}">
                                ${phase.assignments.map((a, ai) => {
                                    const member = st.teamMembers.find(m => m.id === a.memberId);
                                    return `
                                        <div class="assignment-row" style="margin-bottom:12px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-md);" data-assignment-idx="${ai}">
                                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                            <select class="form-select assignment-member" style="flex:1;min-width:140px;">
                                                <option value="">Select member...</option>
                                                ${st.teamMembers.map(m => `<option value="${m.id}" ${a.memberId === m.id ? 'selected' : ''}>${UI.escapeHtml(m.name)}</option>`).join('')}
                                            </select>
                                            <select class="form-select assignment-quarter" style="width:120px;">
                                                ${st.quarters.map(q => `<option value="${q}" ${a.quarter === q ? 'selected' : ''}>${q}</option>`).join('')}
                                            </select>
                                            <input type="number" class="form-input assignment-days" value="${a.days || 0}" min="0" max="65" step="0.5" style="width:80px;">
                                            <span>days</span>
                                            <button class="btn btn-ghost btn-sm remove-assignment-btn">×</button>
                                            </div>
                                            <div class="weekly-calc">
                                                <span class="weekly-calc-label">Weekly:</span>
                                                <input type="number" class="weekly-input" min="0" max="5" step="0.5" value="0">
                                                <span class="weekly-unit">d/wk</span>
                                                <span class="weekly-result-arrow">→</span>
                                                <div class="weekly-result">
                                                    <span class="weekly-result-days">0</span>
                                                    <span class="weekly-result-label">days/qtr</span>
                                                </div>
                                                <div class="weekly-calc-info"></div>
                                            </div>
                                            <div class="capacity-indicator" style="font-size:11px;margin-top:4px;"></div>
                                        </div>
                                    `;
                                }).join('')}
                                <button class="btn btn-secondary btn-sm add-assignment-btn" data-phase-idx="${idx}" style="margin-top:8px;">+ Add Assignment</button>
                            </div>
                        </div>
                    </div>
                `;
            },
            attachProjectModalEvents(existingProject) {
                const st = getState();
                
                // Helper to get current phases from form
                const getCurrentPhasesFromForm = () => {
                    const phases = [];
                    document.querySelectorAll('.phase-form').forEach((form, idx) => {
                        phases.push({
                            id: form.dataset.phaseId || Data.generateId('phase'),
                            name: form.querySelector('.phase-name')?.value.trim() || `Phase ${idx + 1}`,
                            startQuarter: form.querySelector('.phase-start')?.value || Data.getCurrentQuarter(),
                            endQuarter: form.querySelector('.phase-end')?.value || Data.getCurrentQuarter(),
                            predecessorPhaseId: form.querySelector('.phase-dependency')?.value || null,
                            requiredSkillIds: [],
                            assignments: []
                        });
                    });
                    return phases;
                };
                
                // System checkbox toggle events
                document.querySelectorAll('.system-checkbox-item').forEach(item => {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    item.addEventListener('click', (e) => {
                        if (e.target !== checkbox) {
                            checkbox.checked = !checkbox.checked;
                        }
                        item.classList.toggle('checked', checkbox.checked);
                    });
                });
                
                document.getElementById('add-phase-btn')?.addEventListener('click', () => {
                    const container = document.getElementById('phases-container');
                    const currentPhases = getCurrentPhasesFromForm();
                    const idx = currentPhases.length;
                    const newPhase = { id: Data.generateId('phase'), name: `Phase ${idx + 1}`, startQuarter: Data.getCurrentQuarter(), endQuarter: Data.getCurrentQuarter(), requiredSkillIds: [], predecessorPhaseId: null, assignments: [] };
                    container.insertAdjacentHTML('beforeend', this.renderPhaseForm(newPhase, idx, st, currentPhases));
                    this.attachPhaseEvents(existingProject);
                });
                
                this.attachPhaseEvents(existingProject);
                
                document.getElementById('save-project-btn')?.addEventListener('click', () => {
                    const name = document.getElementById('project-name').value.trim();
                    if (!name) { showToast('Project name is required', 'error'); return; }
                    
                    // First pass: collect phase IDs
                    const phaseIds = [];
                    document.querySelectorAll('.phase-form').forEach((form, idx) => {
                        phaseIds.push(existingProject?.phases[idx]?.id || form.dataset.phaseId || Data.generateId('phase'));
                    });
                    
                    const phases = [];
                    document.querySelectorAll('.phase-form').forEach((form, idx) => {
                        const phaseName = form.querySelector('.phase-name').value.trim() || `Phase ${idx + 1}`;
                        const startQ = form.querySelector('.phase-start').value;
                        const endQ = form.querySelector('.phase-end').value;
                        const dependencySelect = form.querySelector('.phase-dependency');
                        let predecessorPhaseId = dependencySelect?.value || null;
                        
                        // Map dependency index to actual phase ID if needed
                        if (predecessorPhaseId && !predecessorPhaseId.startsWith('phase-')) {
                            const depIdx = parseInt(predecessorPhaseId);
                            if (!isNaN(depIdx) && phaseIds[depIdx]) {
                                predecessorPhaseId = phaseIds[depIdx];
                            }
                        }
                        
                        const assignments = [];
                        form.querySelectorAll('[data-assignment-idx]').forEach(aDiv => {
                            const memberId = aDiv.querySelector('.assignment-member').value;
                            const quarter = aDiv.querySelector('.assignment-quarter').value;
                            const days = parseFloat(aDiv.querySelector('.assignment-days').value) || 0;
                            if (memberId && days > 0) {
                                assignments.push({ memberId, quarter, days });
                            }
                        });
                        phases.push({
                            id: phaseIds[idx],
                            name: phaseName, startQuarter: startQ, endQuarter: endQ,
                            requiredSkillIds: [], predecessorPhaseId: predecessorPhaseId || null, assignments
                        });
                    });
                    
                    // Get selected systems from checkboxes
                    const selectedSystems = Array.from(
                        document.querySelectorAll('#project-systems input[type="checkbox"]:checked')
                    ).map(cb => cb.value);
                    
                    const projectData = {
                        name,
                        priority: document.getElementById('project-priority').value,
                        systems: selectedSystems,
                        status: document.getElementById('project-status').value,
                        phases
                    };
                    
                    // Check for over-allocations before saving
                    const overAllocations = this.checkOverAllocations(phases, existingProject?.id);
                    
                    const doSave = () => {
                        if (existingProject) {
                            Data.updateProject(existingProject.id, projectData);
                            showToast('Project updated', 'success');
                        } else {
                            Data.addProject(projectData);
                            showToast('Project created', 'success');
                        }
                        this.close();
                        UI.renderView('projects');
                    };
                    
                    if (overAllocations.length > 0) {
                        const memberNames = [...new Set(overAllocations.map(o => o.memberName))];
                        const message = `⚠️ The following team members will be over-allocated:\n\n${overAllocations.map(o => `• ${o.memberName} in ${o.quarter}: ${o.newUsed.toFixed(1)}d / ${o.total}d (${o.percent}%)`).join('\n')}\n\nDo you want to save anyway?`;
                        
                        if (confirm(message)) {
                            doSave();
                        }
                    } else {
                        doSave();
                    }
                });
            },
            checkOverAllocations(newPhases, editingProjectId = null) {
                const st = getState();
                const overAllocations = [];
                
                // Collect all assignments from new phases, grouped by member and quarter
                const assignmentsByMemberQuarter = {};
                newPhases.forEach(phase => {
                    phase.assignments.forEach(a => {
                        const key = `${a.memberId}-${a.quarter}`;
                        if (!assignmentsByMemberQuarter[key]) {
                            assignmentsByMemberQuarter[key] = { memberId: a.memberId, quarter: a.quarter, days: 0 };
                        }
                        assignmentsByMemberQuarter[key].days += a.days;
                    });
                });
                
                // Check each member-quarter combination
                Object.values(assignmentsByMemberQuarter).forEach(({ memberId, quarter, days }) => {
                    const member = st.teamMembers.find(m => m.id === memberId);
                    if (!member) return;
                    
                    // Calculate current capacity
                    const cap = Capacity.calculate(memberId, quarter);
                    
                    // If editing an existing project, subtract its original days to avoid double-counting
                    let originalDays = 0;
                    if (editingProjectId) {
                        const project = st.projects.find(p => p.id === editingProjectId);
                        if (project) {
                            project.phases.forEach(phase => {
                                phase.assignments.forEach(a => {
                                    if (a.memberId === memberId && a.quarter === quarter) {
                                        originalDays += a.days || 0;
                                    }
                                });
                            });
                        }
                    }
                    
                    const currentUsed = cap.usedDays - originalDays;
                    const newUsed = currentUsed + days;
                    
                    if (newUsed > cap.totalWorkdays) {
                        overAllocations.push({
                            memberName: member.name,
                            quarter,
                            newUsed,
                            total: cap.totalWorkdays,
                            percent: Math.round((newUsed / cap.totalWorkdays) * 100)
                        });
                    }
                });
                
                return overAllocations;
            },
            attachPhaseEvents(existingProject = null) {
                const st = getState();
                const editingProjectId = existingProject?.id || null;
                
                document.querySelectorAll('.remove-phase-btn').forEach(btn => {
                    btn.onclick = () => {
                        const container = document.getElementById('phases-container');
                        if (container.children.length > 1) {
                            btn.closest('.phase-form').remove();
                            container.querySelectorAll('.phase-form').forEach((form, i) => {
                                form.dataset.phaseIdx = i;
                                form.querySelector('span').textContent = `Phase ${i + 1}`;
                            });
                        } else { showToast('At least one phase is required', 'error'); }
                    };
                });
                document.querySelectorAll('.add-assignment-btn').forEach(btn => {
                    btn.onclick = () => {
                        const container = btn.closest('.assignments-container');
                        const idx = container.querySelectorAll('[data-assignment-idx]').length;
                        const html = `
                            <div class="assignment-row" style="margin-bottom:12px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-md);" data-assignment-idx="${idx}">
                                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <select class="form-select assignment-member" style="flex:1;min-width:140px;">
                                    <option value="">Select member...</option>
                                    ${st.teamMembers.map(m => `<option value="${m.id}">${UI.escapeHtml(m.name)}</option>`).join('')}
                                </select>
                                <select class="form-select assignment-quarter" style="width:120px;">
                                    ${st.quarters.map(q => `<option value="${q}">${q}</option>`).join('')}
                                </select>
                                <input type="number" class="form-input assignment-days" value="10" min="0" max="65" step="0.5" style="width:80px;">
                                <span>days</span>
                                <button class="btn btn-ghost btn-sm remove-assignment-btn">×</button>
                                </div>
                                <div class="weekly-calc">
                                    <span class="weekly-calc-label">Weekly:</span>
                                    <input type="number" class="weekly-input" min="0" max="5" step="0.5" value="0">
                                    <span class="weekly-unit">d/wk</span>
                                    <span class="weekly-result-arrow">→</span>
                                    <div class="weekly-result">
                                        <span class="weekly-result-days">0</span>
                                        <span class="weekly-result-label">days/qtr</span>
                                    </div>
                                    <div class="weekly-calc-info"></div>
                                </div>
                                <div class="capacity-indicator" style="font-size:11px;margin-top:4px;"></div>
                            </div>
                        `;
                        btn.insertAdjacentHTML('beforebegin', html);
                        const newRow = container.querySelector(`[data-assignment-idx="${idx}"]`);
                        this.attachCapacityIndicatorEvents(newRow, editingProjectId);
                        this.attachWeeklyCalcEvents(newRow);
                        container.querySelectorAll('.remove-assignment-btn').forEach(rb => {
                            rb.onclick = () => rb.closest('[data-assignment-idx]').remove();
                        });
                    };
                });
                
                // Attach capacity indicators and weekly calculators to all existing assignment rows
                document.querySelectorAll('.assignment-row').forEach(row => {
                    this.attachCapacityIndicatorEvents(row, editingProjectId);
                    this.attachWeeklyCalcEvents(row);
                });
                document.querySelectorAll('.remove-assignment-btn').forEach(btn => {
                    btn.onclick = () => btn.closest('[data-assignment-idx]').remove();
                });
            },
            attachCapacityIndicatorEvents(row, editingProjectId = null) {
                const memberSelect = row.querySelector('.assignment-member');
                const quarterSelect = row.querySelector('.assignment-quarter');
                const daysInput = row.querySelector('.assignment-days');
                const indicator = row.querySelector('.capacity-indicator');
                
                if (!memberSelect || !quarterSelect || !daysInput || !indicator) return;
                
                const updateIndicator = () => {
                    const memberId = memberSelect.value;
                    const quarter = quarterSelect.value;
                    const days = parseFloat(daysInput.value) || 0;
                    
                    if (!memberId) {
                        indicator.innerHTML = '';
                        return;
                    }
                    
                    const st = getState();
                    const member = st.teamMembers.find(m => m.id === memberId);
                    if (!member) {
                        indicator.innerHTML = '';
                        return;
                    }
                    
                    // Calculate current capacity
                    const cap = Capacity.calculate(memberId, quarter);
                    
                    // If editing an existing project, subtract the original assignment days for this member/quarter
                    // to avoid double-counting
                    let originalDays = 0;
                    if (editingProjectId) {
                        const project = st.projects.find(p => p.id === editingProjectId);
                        if (project) {
                            project.phases.forEach(phase => {
                                phase.assignments.forEach(a => {
                                    if (a.memberId === memberId && a.quarter === quarter) {
                                        originalDays += a.days || 0;
                                    }
                                });
                            });
                        }
                    }
                    
                    // Calculate new capacity after this assignment
                    const currentUsed = cap.usedDays - originalDays;
                    const newUsed = currentUsed + days;
                    const newAvailable = cap.totalWorkdays - newUsed;
                    const newPercent = Math.round((newUsed / cap.totalWorkdays) * 100);
                    
                    // Determine status
                    let statusClass, statusIcon, statusText;
                    if (newUsed > cap.totalWorkdays) {
                        statusClass = 'color:var(--danger);';
                        statusIcon = '⚠️';
                        statusText = `Over by ${(newUsed - cap.totalWorkdays).toFixed(1)}d`;
                    } else if (newPercent > 90) {
                        statusClass = 'color:var(--warning);';
                        statusIcon = '⚡';
                        statusText = `${newAvailable.toFixed(1)}d left`;
                    } else {
                        statusClass = 'color:var(--success);';
                        statusIcon = '✓';
                        statusText = `${newAvailable.toFixed(1)}d available`;
                    }
                    
                    indicator.innerHTML = `
                        <span style="${statusClass}font-weight:500;">
                            ${statusIcon} ${quarter}: ${newUsed.toFixed(1)}d / ${cap.totalWorkdays}d (${newPercent}%) — ${statusText}
                        </span>
                    `;
                };
                
                // Update on any change
                memberSelect.addEventListener('change', updateIndicator);
                quarterSelect.addEventListener('change', updateIndicator);
                daysInput.addEventListener('input', updateIndicator);
                
                // Initial update
                updateIndicator();
            },
            
            /**
             * Attaches weekly calculator events to an assignment row
             * Provides input-based days/week that converts to quarterly days
             */
            attachWeeklyCalcEvents(row) {
                const memberSelect = row.querySelector('.assignment-member');
                const quarterSelect = row.querySelector('.assignment-quarter');
                const daysInput = row.querySelector('.assignment-days');
                const weeklyInput = row.querySelector('.weekly-input');
                const resultDays = row.querySelector('.weekly-result-days');
                const calcInfo = row.querySelector('.weekly-calc-info');
                
                if (!weeklyInput || !daysInput || !resultDays) return;
                
                /**
                 * Get workdays in quarter for the selected member and quarter
                 */
                const getQuarterWorkdays = () => {
                    const memberId = memberSelect?.value;
                    const quarter = quarterSelect?.value;
                    if (!quarter) return 65;
                    
                    if (memberId) {
                        return Calendar.getWorkdaysForMember(memberId, quarter);
                    } else {
                        return Calendar.getWorkdaysInQuarter(quarter, []);
                    }
                };
                
                /**
                 * Get work weeks in the quarter (workdays / 5)
                 * This ensures 5 days/week = 100% capacity
                 */
                const getWorkWeeks = () => {
                    const quarterWorkdays = getQuarterWorkdays();
                    // Work weeks = workdays / 5 (standard 5-day work week)
                    return quarterWorkdays / 5;
                };
                
                /**
                 * Convert days/week to quarterly total based on work weeks
                 */
                const weeklyToQuarterly = (daysPerWeek) => {
                    const workWeeks = getWorkWeeks();
                    return Math.round(daysPerWeek * workWeeks * 10) / 10;
                };
                
                /**
                 * Convert quarterly total to days/week based on work weeks
                 */
                const quarterlyToWeekly = (totalDays) => {
                    const workWeeks = getWorkWeeks();
                    if (workWeeks === 0) return 0;
                    return Math.round((totalDays / workWeeks) * 10) / 10;
                };
                
                /**
                 * Update quarterly days from weekly input
                 */
                const updateFromWeekly = () => {
                    const daysPerWeek = parseFloat(weeklyInput.value) || 0;
                    const quarterlyTotal = weeklyToQuarterly(daysPerWeek);
                    const quarterWorkdays = getQuarterWorkdays();
                    const workWeeks = getWorkWeeks();
                    
                    resultDays.textContent = quarterlyTotal;
                    daysInput.value = quarterlyTotal;
                    
                    const quarter = quarterSelect?.value || 'quarter';
                    calcInfo.textContent = `${workWeeks.toFixed(1)} work wks × ${daysPerWeek} d/wk = ${quarterlyTotal}d (${quarterWorkdays}d available)`;
                    
                    // Trigger input event for capacity indicator
                    daysInput.dispatchEvent(new Event('input', { bubbles: true }));
                };
                
                /**
                 * Update weekly input from quarterly days (reverse calculation)
                 */
                const updateFromDays = () => {
                    const totalDays = parseFloat(daysInput.value) || 0;
                    const daysPerWeek = quarterlyToWeekly(totalDays);
                    const quarterWorkdays = getQuarterWorkdays();
                    const workWeeks = getWorkWeeks();
                    
                    weeklyInput.value = daysPerWeek;
                    resultDays.textContent = totalDays;
                    
                    const quarter = quarterSelect?.value || 'quarter';
                    calcInfo.textContent = `${totalDays}d ÷ ${workWeeks.toFixed(1)} work wks = ${daysPerWeek} d/wk (${quarterWorkdays}d available)`;
                };
                
                /**
                 * Recalculate when member or quarter changes
                 */
                const recalculate = () => {
                    const currentDays = parseFloat(daysInput.value) || 0;
                    if (currentDays > 0) {
                        updateFromDays();
                    }
                };
                
                // Event listeners
                weeklyInput.addEventListener('input', updateFromWeekly);
                daysInput.addEventListener('change', updateFromDays);
                memberSelect?.addEventListener('change', recalculate);
                quarterSelect?.addEventListener('change', recalculate);
                
                // Initialize with existing days value
                const initialDays = parseFloat(daysInput.value) || 0;
                if (initialDays > 0) {
                    updateFromDays();
                }
            },
            openMemberModal(existingMember = null) {
                const st = getState();
                const isEdit = !!existingMember;
                const member = existingMember || { name: '', role: 'ERP Specialist', countryId: st.settings.defaultCountryId || 'country-nl', skillIds: [], maxConcurrentProjects: 2 };
                const countries = st.countries || [];
                
                const bodyHtml = `
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input type="text" class="form-input" id="member-name" value="${UI.escapeHtml(member.name)}" placeholder="Team member name">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div class="form-group">
                            <label class="form-label">Role *</label>
                            <select class="form-select" id="member-role">
                                ${(st.roles || []).map(r => `<option value="${r.name}" ${member.role === r.name ? 'selected' : ''}>${UI.escapeHtml(r.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Country *</label>
                            <select class="form-select" id="member-country">
                                ${countries.map(c => `<option value="${c.id}" ${member.countryId === c.id ? 'selected' : ''}>${c.code} - ${UI.escapeHtml(c.name)}</option>`).join('')}
                            </select>
                            <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">Determines public holidays for this member</div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Skills</label>
                        <div class="checkbox-group" id="member-skills">
                            ${st.skills.map(s => `
                                <label class="checkbox-label ${member.skillIds.includes(s.id) ? 'checked' : ''}" data-skill-id="${s.id}">
                                    <input type="checkbox" class="checkbox-input" ${member.skillIds.includes(s.id) ? 'checked' : ''}>
                                    ${UI.escapeHtml(s.name)}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Max Concurrent Projects</label>
                        <input type="number" class="form-input" id="member-max-projects" value="${member.maxConcurrentProjects}" min="1" max="10" style="width:100px;">
                    </div>
                `;
                
                const footerHtml = `
                    <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button class="btn btn-primary" id="save-member-btn">${isEdit ? 'Update' : 'Add'} Member</button>
                `;
                
                this.open(isEdit ? 'Edit Team Member' : 'Add Team Member', bodyHtml, footerHtml);
                
                document.querySelectorAll('.checkbox-label').forEach(label => {
                    label.addEventListener('click', () => {
                        const input = label.querySelector('input');
                        input.checked = !input.checked;
                        label.classList.toggle('checked', input.checked);
                    });
                });
                
                document.getElementById('save-member-btn')?.addEventListener('click', () => {
                    const name = document.getElementById('member-name').value.trim();
                    if (!name) { showToast('Name is required', 'error'); return; }
                    
                    const skillIds = [];
                    document.querySelectorAll('#member-skills .checkbox-label.checked').forEach(label => {
                        skillIds.push(label.dataset.skillId);
                    });
                    
                    const memberData = {
                        name,
                        role: document.getElementById('member-role').value,
                        countryId: document.getElementById('member-country').value,
                        skillIds,
                        maxConcurrentProjects: parseInt(document.getElementById('member-max-projects').value) || 2
                    };
                    
                    if (isEdit) {
                        Data.updateTeamMember(existingMember.id, memberData);
                        showToast('Member updated', 'success');
                    } else {
                        Data.addTeamMember(memberData);
                        showToast('Member added', 'success');
                    }
                    
                    this.close();
                    UI.renderView('settings');
                });
            },
            openTimeOffModal() {
                const st = getState();
                const currentQ = Data.getCurrentQuarter();
                const quarterInfo = Calendar.getQuarterBreakdown(currentQ, st.publicHolidays || []);
                const bodyHtml = `
                    <div class="form-group">
                        <label class="form-label">Team Member *</label>
                        <select class="form-select" id="timeoff-member">
                            <option value="">Select member...</option>
                            ${st.teamMembers.map(m => `<option value="${m.id}">${UI.escapeHtml(m.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Quarter *</label>
                        <select class="form-select" id="timeoff-quarter">
                            ${st.quarters.map(q => {
                                const qInfo = Calendar.getQuarterBreakdown(q, st.publicHolidays || []);
                                return `<option value="${q}">${q} (${qInfo?.workdays || 0} workdays)</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Days Off</label>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <input type="number" class="form-input" id="timeoff-days" min="0.5" max="65" step="0.5" value="5" style="width:100px;">
                            <span style="color:var(--gray-500);">days</span>
                            <span style="font-size:12px;color:var(--gray-400);">(Current quarter has ${quarterInfo?.workdays || 0} workdays)</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Reason</label>
                        <input type="text" class="form-input" id="timeoff-reason" placeholder="Vacation, training, parental leave, etc.">
                    </div>
                `;
                
                const footerHtml = `
                    <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button class="btn btn-primary" id="save-timeoff-btn">Add Time Off</button>
                `;
                
                this.open('Add Time Off', bodyHtml, footerHtml);
                
                document.getElementById('save-timeoff-btn')?.addEventListener('click', () => {
                    const memberId = document.getElementById('timeoff-member').value;
                    if (!memberId) { showToast('Please select a team member', 'error'); return; }
                    
                    Data.addTimeOff({
                        memberId,
                        quarter: document.getElementById('timeoff-quarter').value,
                        days: parseFloat(document.getElementById('timeoff-days').value) || 0,
                        reason: document.getElementById('timeoff-reason').value.trim()
                    });
                    
                    showToast('Time off added', 'success');
                    this.close();
                    UI.renderView('settings');
                });
            },
            openBulkAssignModal() {
                const st = getState();
                if (st.projects.length === 0) {
                    showToast('No projects available. Create a project first.', 'warning');
                    return;
                }
                
                const currentQ = Data.getCurrentQuarter();
                const quarterInfo = Calendar.getQuarterBreakdown(currentQ, st.publicHolidays || []);
                
                const bodyHtml = `
                    <div style="margin-bottom:20px;">
                        <p style="color:var(--gray-600);margin-bottom:16px;">Select team members and assign them to a project phase in bulk.</p>
                    </div>
                    
                    <div class="bulk-assignment-grid">
                        <div>
                            <div class="form-group">
                                <label class="form-label">Project *</label>
                                <select class="form-select" id="bulk-project">
                                    <option value="">Select project...</option>
                                    ${st.projects.filter(p => p.status !== 'Completed').map(p => `<option value="${p.id}">${UI.escapeHtml(p.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Phase *</label>
                                <select class="form-select" id="bulk-phase" disabled>
                                    <option value="">Select project first...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Quarter *</label>
                                <select class="form-select" id="bulk-quarter">
                                    ${st.quarters.map(q => {
                                        const qInfo = Calendar.getQuarterBreakdown(q, st.publicHolidays || []);
                                        return `<option value="${q}">${q} (${qInfo?.workdays || 0} days)</option>`;
                                    }).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Days per Member</label>
                                <div style="display:flex;align-items:center;gap:12px;">
                                    <input type="number" class="form-input" id="bulk-days" min="0.5" max="65" step="0.5" value="10" style="width:100px;">
                                    <span style="color:var(--gray-500);">days</span>
                                </div>
                                <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">Current quarter: ${quarterInfo?.workdays || 0} workdays</div>
                            </div>
                        </div>
                        <div>
                            <div class="form-group">
                                <label class="form-label">Select Team Members</label>
                                <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);padding:8px;">
                                    <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-light);">
                                        <label class="bulk-select-row" id="bulk-select-all" style="background:var(--primary-subtle);">
                                            <div class="bulk-select-checkbox"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                                            <div class="bulk-select-info"><div class="bulk-select-name">Select All</div></div>
                                        </label>
                                    </div>
                                    ${st.teamMembers.map(m => {
                                        const cap = Capacity.calculate(m.id, currentQ);
                                        return `
                                            <label class="bulk-select-row" data-member-id="${m.id}">
                                                <div class="bulk-select-checkbox"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                                                <div class="bulk-select-info">
                                                    <div class="bulk-select-name">${UI.escapeHtml(m.name)}</div>
                                                    <div class="bulk-select-meta">${m.role} · <span style="color:${cap.availableDaysRaw < 0 ? 'var(--danger);font-weight:600' : cap.availableDaysRaw < 5 ? 'var(--warning)' : 'var(--success)'};">${cap.availableDaysRaw < 0 ? cap.availableDaysRaw.toFixed(1) + 'd over' : cap.availableDaysRaw.toFixed(1) + 'd available'}</span></div>
                                                </div>
                                            </label>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="bulk-preview" style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:var(--radius-md);display:none;">
                        <div style="font-weight:600;color:var(--gray-700);margin-bottom:8px;">Preview</div>
                        <div id="bulk-preview-content" style="font-size:13px;color:var(--gray-600);"></div>
                    </div>
                `;
                
                const footerHtml = `
                    <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button class="btn btn-primary" id="apply-bulk-btn" disabled>Apply Assignments</button>
                `;
                
                this.open('Bulk Assignment', bodyHtml, footerHtml);
                this.attachBulkAssignEvents();
            },
            attachBulkAssignEvents() {
                const st = getState();
                let selectedMembers = [];
                
                // Project change - populate phases
                document.getElementById('bulk-project')?.addEventListener('change', e => {
                    const phaseSelect = document.getElementById('bulk-phase');
                    const quarterSelect = document.getElementById('bulk-quarter');
                    const projectId = e.target.value;
                    
                    if (projectId) {
                        const project = st.projects.find(p => p.id === projectId);
                        phaseSelect.disabled = false;
                        phaseSelect.innerHTML = project.phases.map(ph => 
                            `<option value="${ph.id}">${UI.escapeHtml(ph.name)} (${ph.startQuarter} → ${ph.endQuarter})</option>`
                        ).join('');
                        
                        // Auto-select quarter based on first phase
                        if (project.phases[0]) {
                            quarterSelect.value = project.phases[0].startQuarter;
                        }
                    } else {
                        phaseSelect.disabled = true;
                        phaseSelect.innerHTML = '<option value="">Select project first...</option>';
                    }
                    updatePreview();
                });
                
                // Days input
                document.getElementById('bulk-days')?.addEventListener('input', () => {
                    updatePreview();
                });
                
                // Quarter change - update member availability display
                document.getElementById('bulk-quarter')?.addEventListener('change', e => {
                    const quarter = e.target.value;
                    document.querySelectorAll('.bulk-select-row[data-member-id]').forEach(row => {
                        const memberId = row.dataset.memberId;
                        const cap = Capacity.calculate(memberId, quarter);
                        const meta = row.querySelector('.bulk-select-meta');
                        const member = st.teamMembers.find(m => m.id === memberId);
                        if (meta && member) {
                            const statusColor = cap.availableDaysRaw < 0 ? 'var(--danger)' : cap.availableDaysRaw < 5 ? 'var(--warning)' : 'var(--success)';
                            const availText = cap.availableDaysRaw < 0 ? `${cap.availableDaysRaw.toFixed(1)}d over` : `${cap.availableDaysRaw.toFixed(1)}d available`;
                            meta.innerHTML = `${member.role} · <span style="color:${statusColor};font-weight:${cap.availableDaysRaw < 0 ? '600' : '500'};">${availText}</span>`;
                        }
                    });
                    updatePreview();
                });
                
                // Select all toggle
                document.getElementById('bulk-select-all')?.addEventListener('click', () => {
                    const selectAllRow = document.getElementById('bulk-select-all');
                    const isSelected = selectAllRow.classList.contains('selected');
                    
                    document.querySelectorAll('.bulk-select-row[data-member-id]').forEach(row => {
                        if (isSelected) {
                            row.classList.remove('selected');
                        } else {
                            row.classList.add('selected');
                        }
                    });
                    
                    selectAllRow.classList.toggle('selected');
                    updateSelectedMembers();
                });
                
                // Individual member selection
                document.querySelectorAll('.bulk-select-row[data-member-id]').forEach(row => {
                    row.addEventListener('click', () => {
                        row.classList.toggle('selected');
                        updateSelectedMembers();
                    });
                });
                
                function updateSelectedMembers() {
                    selectedMembers = [];
                    document.querySelectorAll('.bulk-select-row.selected[data-member-id]').forEach(row => {
                        selectedMembers.push(row.dataset.memberId);
                    });
                    updatePreview();
                }
                
                function updatePreview() {
                    const preview = document.getElementById('bulk-preview');
                    const previewContent = document.getElementById('bulk-preview-content');
                    const applyBtn = document.getElementById('apply-bulk-btn');
                    const projectId = document.getElementById('bulk-project').value;
                    const phaseId = document.getElementById('bulk-phase').value;
                    const quarter = document.getElementById('bulk-quarter').value;
                    const days = parseFloat(document.getElementById('bulk-days').value) || 0;
                    
                    if (projectId && phaseId && selectedMembers.length > 0) {
                        const project = st.projects.find(p => p.id === projectId);
                        const phase = project.phases.find(ph => ph.id === phaseId);
                        
                        // Calculate capacity impact for each member
                        const memberDetails = selectedMembers.map(id => {
                            const member = st.teamMembers.find(m => m.id === id);
                            if (!member) return null;
                            const cap = Capacity.calculate(id, quarter);
                            const newUsed = cap.usedDays + days;
                            const newPercent = Math.round((newUsed / cap.totalWorkdays) * 100);
                            const isOver = newUsed > cap.totalWorkdays;
                            const isHigh = newPercent > 90;
                            return {
                                name: member.name,
                                currentUsed: cap.usedDays,
                                newUsed,
                                total: cap.totalWorkdays,
                                newPercent,
                                isOver,
                                isHigh
                            };
                        }).filter(Boolean);
                        
                        const overAllocated = memberDetails.filter(m => m.isOver);
                        const highUtilization = memberDetails.filter(m => m.isHigh && !m.isOver);
                        
                        let warningHtml = '';
                        if (overAllocated.length > 0) {
                            warningHtml += `
                                <div style="margin-top:12px;padding:10px;background:var(--danger-light);border-radius:var(--radius-md);border-left:3px solid var(--danger);">
                                    <div style="font-weight:600;color:var(--danger);margin-bottom:4px;">⚠️ Over-allocation Warning</div>
                                    <div style="font-size:12px;color:var(--gray-700);">
                                        ${overAllocated.map(m => `<div>${UI.escapeHtml(m.name)}: ${m.newUsed.toFixed(1)}d / ${m.total}d (${m.newPercent}%)</div>`).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        if (highUtilization.length > 0) {
                            warningHtml += `
                                <div style="margin-top:12px;padding:10px;background:var(--warning-light);border-radius:var(--radius-md);border-left:3px solid var(--warning);">
                                    <div style="font-weight:600;color:var(--warning);margin-bottom:4px;">⚡ High Utilization</div>
                                    <div style="font-size:12px;color:var(--gray-700);">
                                        ${highUtilization.map(m => `<div>${UI.escapeHtml(m.name)}: ${m.newUsed.toFixed(1)}d / ${m.total}d (${m.newPercent}%)</div>`).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        preview.style.display = 'block';
                        previewContent.innerHTML = `
                            <strong>${selectedMembers.length} member(s)</strong> will be assigned to 
                            <strong>${UI.escapeHtml(project.name)} → ${UI.escapeHtml(phase.name)}</strong> 
                            in <strong>${quarter}</strong> for <strong>${days} days</strong> each.
                            ${warningHtml}
                        `;
                        applyBtn.disabled = false;
                    } else {
                        preview.style.display = 'none';
                        applyBtn.disabled = true;
                    }
                }
                
                // Apply bulk assignments
                document.getElementById('apply-bulk-btn')?.addEventListener('click', () => {
                    const projectId = document.getElementById('bulk-project').value;
                    const phaseId = document.getElementById('bulk-phase').value;
                    const quarter = document.getElementById('bulk-quarter').value;
                    const days = parseFloat(document.getElementById('bulk-days').value) || 0;
                    
                    if (!projectId || !phaseId || selectedMembers.length === 0) {
                        showToast('Please select project, phase, and at least one member', 'error');
                        return;
                    }
                    
                    const assignments = selectedMembers.map(memberId => ({
                        projectId, phaseId, memberId, quarter, days
                    }));
                    
                    const count = Data.bulkAssign(assignments);
                    showToast(`${count} assignments created`, 'success');
                    Modal.close();
                    UI.renderView(currentView);
                });
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 11: EXPORT MODULE
           Data import/export functionality (JSON, Excel, CSV)
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Export module for data import/export
         * Supports JSON, Excel (XLSX), and CSV formats
         */
        const Export = {
            log: (msg, data) => console.log(`[Export] ${msg}`, data || ''),
            downloadFile(content, filename, mimeType) {
                try {
                    // Try using data URI approach which works in more environments
                    const dataUri = 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content);
                    const a = document.createElement('a');
                    a.href = dataUri;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    return true;
                } catch (e) {
                    this.log('Download error', e);
                    // Fallback: open in new window
                    const newWindow = window.open();
                    if (newWindow) {
                        newWindow.document.write('<pre>' + content + '</pre>');
                        newWindow.document.title = filename;
                        showToast('Data opened in new window. Use Ctrl+S to save.', 'warning');
                    } else {
                        showToast('Export failed. Please check popup blocker.', 'error');
                    }
                    return false;
                }
            },
            toJSON() {
                this.log('Exporting to JSON');
                const st = getState();
                const content = JSON.stringify(st, null, 2);
                const filename = `capacity-planner-${new Date().toISOString().split('T')[0]}.json`;
                if (this.downloadFile(content, filename, 'application/json')) {
                    showToast('Data exported as JSON', 'success');
                }
            },
            toExcel() {
                this.log('Exporting to Excel');
                const st = getState();
                
                // Check if XLSX is available
                if (typeof XLSX === 'undefined') {
                    // Try loading it dynamically
                    this.log('XLSX not loaded, attempting dynamic load');
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                    script.onload = () => {
                        this.log('XLSX loaded dynamically');
                        this.generateExcel(st);
                    };
                    script.onerror = () => {
                        showToast('Could not load Excel library. Exporting as CSV instead.', 'warning');
                        this.toCSV();
                    };
                    document.head.appendChild(script);
                    return;
                }
                
                this.generateExcel(st);
            },
            generateExcel(st) {
                try {
                    const wb = XLSX.utils.book_new();
                    const addSheet = (data, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
                    const today = new Date().toISOString().split('T')[0];
                    const defaultCountryCode = st.countries.find(c => c.id === st.settings.defaultCountryId)?.code || '';
                    
                    // Settings
                    addSheet([
                        ['Setting', 'Value'],
                        ['bauReserveDays', st.settings.bauReserveDays ?? 5],
                        ['hoursPerDay', st.settings.hoursPerDay ?? 8],
                        ['quartersToShow', st.settings.quartersToShow ?? 4],
                        ['defaultCountryCode', defaultCountryCode],
                        ['darkMode', st.settings.darkMode ? 'TRUE' : 'FALSE'],
                    ], 'Settings');
                    
                    // Countries
                    addSheet([
                        ['Code', 'Name'],
                        ...st.countries.map(c => [c.code, c.name])
                    ], 'Countries');
                    
                    // Public Holidays
                    addSheet([
                        ['CountryCode', 'Date', 'Name'],
                        ...st.publicHolidays.map(h => {
                            const code = st.countries.find(c => c.id === h.countryId)?.code || '';
                            return [code, h.date, h.name];
                        })
                    ], 'PublicHolidays');
                    
                    // Systems
                    addSheet([
                        ['Name', 'Description'],
                        ...st.systems.map(s => [s.name, s.description || ''])
                    ], 'Systems');
                    
                    // Roles
                    addSheet([
                        ['Name'],
                        ...st.roles.map(r => [r.name])
                    ], 'Roles');
                    
                    // Skills
                    addSheet([
                        ['Name', 'Category'],
                        ...st.skills.map(s => [s.name, s.category || ''])
                    ], 'Skills');
                    
                    // Team
                    addSheet([
                        ['Name', 'Role', 'CountryCode', 'Skills', 'MaxConcurrentProjects'],
                        ...st.teamMembers.map(m => {
                            const code = st.countries.find(c => c.id === m.countryId)?.code || defaultCountryCode;
                            const skills = (m.skillIds || []).map(id => st.skills.find(s => s.id === id)?.name || '').filter(Boolean).join(', ');
                            return [m.name, m.role || '', code, skills, m.maxConcurrentProjects ?? 2];
                        })
                    ], 'Team');
                    
                    // Projects
                    addSheet([
                        ['Name', 'Priority', 'System', 'Status'],
                        ...st.projects.map(p => [p.name, p.priority || '', p.system || '', p.status || 'Planning'])
                    ], 'Projects');
                    
                    // Phases
                    addSheet([
                        ['Project', 'Phase', 'StartQuarter', 'EndQuarter', 'RequiredSkills', 'PredecessorPhase'],
                        ...st.projects.flatMap(p => (p.phases || []).map(ph => {
                            const skills = (ph.requiredSkillIds || []).map(id => st.skills.find(s => s.id === id)?.name || '').filter(Boolean).join(', ');
                            const predecessor = (p.phases || []).find(x => x.id === ph.predecessorPhaseId)?.name || '';
                            return [p.name, ph.name, ph.startQuarter, ph.endQuarter, skills, predecessor];
                        }))
                    ], 'Phases');
                    
                    // Assignments
                    addSheet([
                        ['Project', 'Phase', 'Member', 'Quarter', 'Days'],
                        ...st.projects.flatMap(p => (p.phases || []).flatMap(ph => (ph.assignments || []).map(a => {
                            const member = st.teamMembers.find(m => m.id === a.memberId);
                            return [p.name, ph.name, member?.name || '', a.quarter, a.days ?? 0];
                        })))
                    ], 'Assignments');
                    
                    // Time Off
                    addSheet([
                        ['Member', 'Quarter', 'Days', 'Reason'],
                        ...st.timeOff.map(t => {
                            const member = st.teamMembers.find(m => m.id === t.memberId);
                            return [member?.name || '', t.quarter, t.days ?? 0, t.reason || ''];
                        })
                    ], 'TimeOff');
                    
                    // Summary (human readable)
                    addSheet([
                        ['Capacity Planner Export'],
                        ['Generated', new Date().toLocaleString()],
                        ['Version', st.version || ''],
                        [''],
                        ['Counts'],
                        ['Team Members', st.teamMembers.length],
                        ['Projects', st.projects.length],
                        ['Phases', st.projects.reduce((sum, p) => sum + (p.phases?.length || 0), 0)],
                        ['Assignments', st.projects.reduce((sum, p) => sum + (p.phases || []).reduce((s, ph) => s + (ph.assignments?.length || 0), 0), 0)],
                        ['Time Off Entries', st.timeOff.length],
                        ['Public Holidays', st.publicHolidays.length],
                    ], 'Summary');
                    
                    XLSX.writeFile(wb, `capacity-planner-${today}.xlsx`);
                    showToast('Data exported as Excel', 'success');
                } catch (e) {
                    this.log('Excel export error', e);
                    showToast('Excel export failed. Trying CSV...', 'warning');
                    this.toCSV();
                }
            },
            toExcelTemplate() {
                this.log('Exporting Excel template');
                const templateState = JSON.parse(JSON.stringify(DEFAULT_STATE));
                templateState.projects = [];
                templateState.teamMembers = [];
                templateState.timeOff = [];
                templateState.publicHolidays = [];
                this.generateExcel(templateState);
            },
            importExcel(file) {
                this.log('Importing from Excel');
                
                const proceed = () => {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        try {
                            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                            const { state: incomingState, report } = this.parseWorkbook(wb);
                            if (!incomingState) throw new Error('Parsed state is empty');
                            
                            if (report.errors.length) {
                                showToast(`Import blocked: ${report.errors.length} errors`, 'error');
                                alert(this.formatValidationReport(report, true));
                                return;
                            }
                            
                            state = this.mergeState(state, incomingState, report);
                            Storage.save(state);
                            History.clear();
                            currentView = state.settings?.defaultView || 'dashboard';
                            const warningNote = report.warnings.length ? ` with ${report.warnings.length} warnings` : '';
                            showToast(`Excel imported successfully${warningNote}`, report.warnings.length ? 'warning' : 'success');
                            if (report.warnings.length) {
                                alert(this.formatValidationReport(report, false));
                            }
                            UI.renderView(currentView);
                        } catch (err) {
                            console.error('[Import] Excel parse error', err);
                            showToast('Excel import failed. Please use the provided template.', 'error');
                        }
                    };
                    reader.readAsArrayBuffer(file);
                };
                
                if (typeof XLSX === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                    script.onload = proceed;
                    script.onerror = () => showToast('Could not load Excel library for import.', 'error');
                    document.head.appendChild(script);
                } else {
                    proceed();
                }
            },
            parseWorkbook(wb) {
                const toRows = (sheetName) => {
                    const sheet = wb.Sheets[sheetName];
                    if (!sheet) return [];
                    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
                };
                
                const report = { errors: [], warnings: [], stats: {} };
                const newState = JSON.parse(JSON.stringify(DEFAULT_STATE));
                newState.lastModified = new Date().toISOString();
                newState.quarters = generateQuarters();
                newState.projects = [];
                newState.teamMembers = [];
                newState.timeOff = [];
                newState.publicHolidays = [];
                newState.countries = [];
                newState.systems = [];
                newState.roles = [];
                newState.skills = [];
                
                // Countries
                const countryCodeToId = {};
                const countryRows = toRows('Countries');
                if (countryRows.length) {
                    countryRows.forEach(row => {
                        if (!row.Code && !row.Name) return;
                        if (!row.Code) {
                            report.warnings.push(`Countries: skipped row missing code (Name="${row.Name || ''}")`);
                            return;
                        }
                        const id = Data.generateId('country');
                        const code = (row.Code || '').toUpperCase();
                        countryCodeToId[code] = id;
                        newState.countries.push({ id, code, name: row.Name || code });
                    });
                } else {
                    DEFAULT_STATE.countries.forEach(c => { countryCodeToId[c.code.toUpperCase()] = c.id; newState.countries.push({ ...c }); });
                }
                
                // Settings
                const settingsRows = toRows('Settings');
                const settingsMap = {};
                settingsRows.forEach(r => { if (r.Setting) settingsMap[r.Setting] = r.Value; });
                newState.settings.bauReserveDays = parseFloat(settingsMap.bauReserveDays) || DEFAULT_STATE.settings.bauReserveDays;
                newState.settings.hoursPerDay = parseFloat(settingsMap.hoursPerDay) || DEFAULT_STATE.settings.hoursPerDay;
                newState.settings.quartersToShow = parseInt(settingsMap.quartersToShow) || DEFAULT_STATE.settings.quartersToShow;
                const defaultCountryCode = (settingsMap.defaultCountryCode || '').toUpperCase();
                newState.settings.defaultCountryId = countryCodeToId[defaultCountryCode] || newState.countries[0]?.id || DEFAULT_STATE.settings.defaultCountryId;
                if (!countryCodeToId[defaultCountryCode] && defaultCountryCode) {
                    report.warnings.push(`Settings: defaultCountryCode "${defaultCountryCode}" not found; using ${newState.settings.defaultCountryId}`);
                }
                newState.settings.darkMode = (settingsMap.darkMode || '').toString().toLowerCase() === 'true';
                
                // Systems
                const systemRows = toRows('Systems');
                systemRows.forEach(row => {
                    if (!row.Name) return;
                    newState.systems.push({ id: Data.generateId('sys'), name: row.Name, description: row.Description || '' });
                });
                if (newState.systems.length === 0) newState.systems = [...DEFAULT_STATE.systems];
                
                // Roles
                const roleRows = toRows('Roles');
                roleRows.forEach(row => { if (row.Name) newState.roles.push({ id: Data.generateId('role'), name: row.Name }); });
                if (newState.roles.length === 0) newState.roles = [...DEFAULT_STATE.roles || []];
                
                // Skills
                const skillRows = toRows('Skills');
                const skillNameToId = {};
                skillRows.forEach(row => {
                    if (!row.Name) return;
                    const id = Data.generateId('skill');
                    skillNameToId[row.Name.toLowerCase()] = id;
                    newState.skills.push({ id, name: row.Name, category: row.Category || '' });
                });
                
                // Team
                const memberNameToId = {};
                const teamRows = toRows('Team');
                teamRows.forEach(row => {
                    if (!row.Name) return;
                    const id = Data.generateId('member');
                    memberNameToId[row.Name.toLowerCase()] = id;
                    const role = row.Role || '';
                    const skillIds = (row.Skills || '').split(',').map(s => s.trim()).filter(Boolean).map(name => {
                        const key = name.toLowerCase();
                        if (!skillNameToId[key]) {
                            const sid = Data.generateId('skill');
                            skillNameToId[key] = sid;
                            newState.skills.push({ id: sid, name, category: '' });
                        }
                        return skillNameToId[key];
                    });
                    const countryCode = (row.CountryCode || defaultCountryCode || '').toUpperCase();
                    const countryId = countryCodeToId[countryCode] || newState.settings.defaultCountryId;
                    if (!countryCodeToId[countryCode] && countryCode) {
                        report.warnings.push(`Team: member "${row.Name}" country "${countryCode}" not found; defaulting to ${newState.settings.defaultCountryId}`);
                    }
                    newState.teamMembers.push({
                        id,
                        name: row.Name,
                        role,
                        skillIds,
                        countryId,
                        maxConcurrentProjects: parseInt(row.MaxConcurrentProjects) || 2
                    });
                });
                
                // Rebuild skill map with defaults if still empty
                if (newState.skills.length === 0) newState.skills = [...DEFAULT_STATE.skills || []];
                newState.skills.forEach(s => { skillNameToId[s.name.toLowerCase()] = s.id; });
                
                // Projects
                const projectNameToId = {};
                const projectMap = {};
                const projectRows = toRows('Projects');
                projectRows.forEach(row => {
                    if (!row.Name) return;
                    const id = Data.generateId('proj');
                    const project = {
                        id,
                        name: row.Name,
                        priority: row.Priority || 'Medium',
                        system: row.System || '',
                        status: row.Status || 'Planning',
                        phases: []
                    };
                    projectNameToId[row.Name.toLowerCase()] = id;
                    projectMap[id] = project;
                    newState.projects.push(project);
                });
                
                // Ensure at least default project list is not empty
                if (newState.projects.length === 0) {
                    newState.projects = [];
                }
                
                // Phases
                const phaseNameMap = {}; // projectId => { phaseNameLower: phaseId }
                const phaseRows = toRows('Phases');
                phaseRows.forEach(row => {
                    if (!row.Project || !row.Phase) return;
                    let projectId = projectNameToId[row.Project.toLowerCase()];
                    if (!projectId) {
                        // Create a stub project if it was not listed in Projects sheet
                        projectId = Data.generateId('proj');
                        projectNameToId[row.Project.toLowerCase()] = projectId;
                        const stubProject = {
                            id: projectId,
                            name: row.Project,
                            priority: 'Medium',
                            system: '',
                            status: 'Planning',
                            phases: []
                        };
                        projectMap[projectId] = stubProject;
                        newState.projects.push(stubProject);
                        report.warnings.push(`Phases: created stub project "${row.Project}" (not in Projects sheet)`);
                    }
                    const phaseId = Data.generateId('phase');
                    phaseNameMap[projectId] = phaseNameMap[projectId] || {};
                    phaseNameMap[projectId][row.Phase.toLowerCase()] = phaseId;
                    const reqSkills = (row.RequiredSkills || '').split(',').map(s => s.trim()).filter(Boolean).map(name => {
                        const key = name.toLowerCase();
                        if (!skillNameToId[key]) {
                            const sid = Data.generateId('skill');
                            skillNameToId[key] = sid;
                            newState.skills.push({ id: sid, name, category: '' });
                        }
                        return skillNameToId[key];
                    });
                    const phase = {
                        id: phaseId,
                        name: row.Phase,
                        startQuarter: row.StartQuarter || newState.quarters[0],
                        endQuarter: row.EndQuarter || row.StartQuarter || newState.quarters[0],
                        requiredSkillIds: reqSkills,
                        predecessorPhaseId: null,
                        predecessorName: row.PredecessorPhase || '',
                        assignments: []
                    };
                    projectMap[projectId]?.phases.push(phase);
                });
                
                // Resolve predecessors
                Object.values(projectMap).forEach(project => {
                    project.phases?.forEach(ph => {
                        const predName = (ph.predecessorName || '').toLowerCase();
                        if (predName && phaseNameMap[project.id]?.[predName]) {
                            ph.predecessorPhaseId = phaseNameMap[project.id][predName];
                        }
                    });
                    // Ensure at least one phase
                    if (!project.phases || project.phases.length === 0) {
                        project.phases = [{
                            id: Data.generateId('phase'),
                            name: 'Main',
                            startQuarter: newState.quarters[0],
                            endQuarter: newState.quarters[0],
                            requiredSkillIds: [],
                            predecessorPhaseId: null,
                            assignments: []
                        }];
                    }
                });
                
                // Public Holidays
                const holidayRows = toRows('PublicHolidays');
                holidayRows.forEach(row => {
                    if (!row.Date || !row.CountryCode) {
                        report.warnings.push('PublicHolidays: skipped row missing Date or CountryCode');
                        return;
                    }
                    const code = (row.CountryCode || '').toUpperCase();
                    const countryId = countryCodeToId[code] || newState.settings.defaultCountryId;
                    if (!countryCodeToId[code]) {
                        report.warnings.push(`PublicHolidays: country "${code}" not found; defaulting to ${newState.settings.defaultCountryId}`);
                    }
                    newState.publicHolidays.push({
                        id: Data.generateId('hol'),
                        countryId,
                        date: row.Date,
                        name: row.Name || 'Holiday'
                    });
                });
                
                // Assignments
                const assignmentRows = toRows('Assignments');
                assignmentRows.forEach(row => {
                    if (!row.Project || !row.Phase || !row.Member) return;
                    let projectId = projectNameToId[row.Project.toLowerCase()];
                    if (!projectId) {
                        projectId = Data.generateId('proj');
                        projectNameToId[row.Project.toLowerCase()] = projectId;
                        const stubProject = {
                            id: projectId,
                            name: row.Project,
                            priority: 'Medium',
                            system: '',
                            status: 'Planning',
                            phases: []
                        };
                        projectMap[projectId] = stubProject;
                        newState.projects.push(stubProject);
                    }
                    const project = projectMap[projectId];
                    let phase = project?.phases?.find(p => p.name.toLowerCase() === row.Phase.toLowerCase());
                    if (!phase) {
                        // Create a phase placeholder if missing
                        phase = {
                            id: Data.generateId('phase'),
                            name: row.Phase,
                            startQuarter: row.Quarter || newState.quarters[0],
                            endQuarter: row.Quarter || newState.quarters[0],
                            requiredSkillIds: [],
                            predecessorPhaseId: null,
                            assignments: []
                        };
                        project.phases = project.phases || [];
                        project.phases.push(phase);
                        phaseNameMap[projectId] = phaseNameMap[projectId] || {};
                        phaseNameMap[projectId][row.Phase.toLowerCase()] = phase.id;
                        report.warnings.push(`Assignments: created phase "${row.Phase}" in project "${project.name}" (missing in Phases sheet)`);
                    }
                    const memberId = memberNameToId[row.Member.toLowerCase()];
                    if (!memberId) {
                        report.warnings.push(`Assignments: member "${row.Member}" not found; row skipped`);
                        return;
                    }
                    if (!phase) {
                        report.warnings.push(`Assignments: phase "${row.Phase}" not found; row skipped`);
                        return;
                    }
                    const days = parseFloat(row.Days);
                    if (isNaN(days)) {
                        report.warnings.push(`Assignments: invalid days value for ${row.Project}/${row.Phase}/${row.Member}; row skipped`);
                        return;
                    }
                    phase.assignments.push({
                        memberId,
                        quarter: row.Quarter || phase.startQuarter,
                        days
                    });
                });
                
                // Time Off
                const timeOffRows = toRows('TimeOff');
                timeOffRows.forEach(row => {
                    if (!row.Member || !row.Quarter) return;
                    const memberId = memberNameToId[row.Member.toLowerCase()];
                    if (!memberId) {
                        report.warnings.push(`TimeOff: member "${row.Member}" not found; row skipped`);
                        return;
                    }
                    const days = parseFloat(row.Days);
                    if (isNaN(days)) {
                        report.warnings.push(`TimeOff: invalid days for member "${row.Member}"; row skipped`);
                        return;
                    }
                    newState.timeOff.push({
                        id: Data.generateId('to'),
                        memberId,
                        quarter: row.Quarter,
                        days,
                        reason: row.Reason || ''
                    });
                });
                
                return { state: newState, report };
            },
            mergeState(current, incoming, report) {
                // Work on a clone to avoid side effects
                const next = JSON.parse(JSON.stringify(current));
                
                const toMap = (arr, keyFn) => {
                    const m = {};
                    arr.forEach(item => { const k = keyFn(item); if (k) m[k] = item; });
                    return m;
                };
                
                // Countries
                const nextCountryByCode = toMap(next.countries, c => c.code?.toUpperCase());
                const incomingCountryByCode = toMap(incoming.countries, c => c.code?.toUpperCase());
                Object.values(incomingCountryByCode).forEach(ic => {
                    const code = ic.code?.toUpperCase();
                    if (!code) return;
                    const existing = nextCountryByCode[code];
                    if (existing) {
                        existing.name = ic.name || existing.name;
                    } else {
                        const newCountry = { id: Data.generateId('country'), code, name: ic.name || code };
                        next.countries.push(newCountry);
                        nextCountryByCode[code] = newCountry;
                    }
                });
                
                // Settings (update, do not delete)
                const defaultCode = incoming.settings.defaultCountryId ? (incoming.countries.find(c => c.id === incoming.settings.defaultCountryId)?.code || '') : '';
                if (incoming.settings) {
                    next.settings.bauReserveDays = incoming.settings.bauReserveDays ?? next.settings.bauReserveDays;
                    next.settings.hoursPerDay = incoming.settings.hoursPerDay ?? next.settings.hoursPerDay;
                    next.settings.quartersToShow = incoming.settings.quartersToShow ?? next.settings.quartersToShow;
                    const mappedDefault = defaultCode ? nextCountryByCode[defaultCode.toUpperCase()]?.id : null;
                    if (mappedDefault) next.settings.defaultCountryId = mappedDefault;
                    next.settings.darkMode = typeof incoming.settings.darkMode === 'boolean' ? incoming.settings.darkMode : next.settings.darkMode;
                }
                
                // Systems
                const nextSystemByName = toMap(next.systems, s => s.name?.toLowerCase());
                incoming.systems.forEach(is => {
                    if (!is.name) return;
                    const key = is.name.toLowerCase();
                    const existing = nextSystemByName[key];
                    if (existing) {
                        existing.description = is.description || existing.description;
                    } else {
                        const sys = { id: Data.generateId('sys'), name: is.name, description: is.description || '' };
                        next.systems.push(sys);
                        nextSystemByName[key] = sys;
                    }
                });
                
                // Roles
                const nextRoleByName = toMap(next.roles, r => r.name?.toLowerCase());
                incoming.roles.forEach(ir => {
                    if (!ir.name) return;
                    const key = ir.name.toLowerCase();
                    if (!nextRoleByName[key]) {
                        const role = { id: Data.generateId('role'), name: ir.name };
                        next.roles.push(role);
                        nextRoleByName[key] = role;
                    }
                });
                
                // Skills
                const nextSkillByName = toMap(next.skills, s => s.name?.toLowerCase());
                incoming.skills.forEach(is => {
                    if (!is.name) return;
                    const key = is.name.toLowerCase();
                    const existing = nextSkillByName[key];
                    if (existing) {
                        existing.category = is.category || existing.category;
                    } else {
                        const skill = { id: Data.generateId('skill'), name: is.name, category: is.category || '' };
                        next.skills.push(skill);
                        nextSkillByName[key] = skill;
                    }
                });
                
                // Team members
                const nextMemberByName = toMap(next.teamMembers, m => m.name?.toLowerCase());
                const incomingMembersById = toMap(incoming.teamMembers, m => m.id);
                const incomingMemberByName = toMap(incoming.teamMembers, m => m.name?.toLowerCase());
                const incomingCountryById = toMap(incoming.countries, c => c.id);
                incoming.teamMembers.forEach(im => {
                    if (!im.name) return;
                    const key = im.name.toLowerCase();
                    const existing = nextMemberByName[key];
                    // Map skills
                    const mappedSkillIds = (im.skillIds || []).map(sid => {
                        const incSkill = incoming.skills.find(s => s.id === sid);
                        if (!incSkill) return null;
                        return nextSkillByName[incSkill.name.toLowerCase()]?.id || null;
                    }).filter(Boolean);
                    // Map country
                    const incCountry = incomingCountryById[im.countryId];
                    const mappedCountryId = incCountry ? nextCountryByCode[incCountry.code.toUpperCase()]?.id : next.settings.defaultCountryId;
                    if (existing) {
                        existing.role = im.role || existing.role;
                        existing.skillIds = mappedSkillIds.length ? mappedSkillIds : existing.skillIds;
                        existing.countryId = mappedCountryId || existing.countryId;
                        existing.maxConcurrentProjects = im.maxConcurrentProjects ?? existing.maxConcurrentProjects;
                    } else {
                        const member = {
                            id: Data.generateId('member'),
                            name: im.name,
                            role: im.role || '',
                            skillIds: mappedSkillIds,
                            countryId: mappedCountryId || next.settings.defaultCountryId,
                            maxConcurrentProjects: im.maxConcurrentProjects ?? 2
                        };
                        next.teamMembers.push(member);
                        nextMemberByName[key] = member;
                    }
                });
                
                // Projects and phases
                const nextProjectByName = toMap(next.projects, p => p.name?.toLowerCase());
                incoming.projects.forEach(ip => {
                    if (!ip.name) return;
                    const key = ip.name.toLowerCase();
                    let project = nextProjectByName[key];
                    if (!project) {
                        project = { id: Data.generateId('proj'), name: ip.name, priority: ip.priority || 'Medium', system: ip.system || '', status: ip.status || 'Planning', phases: [] };
                        next.projects.push(project);
                        nextProjectByName[key] = project;
                    } else {
                        project.priority = ip.priority || project.priority;
                        project.system = ip.system || project.system;
                        project.status = ip.status || project.status;
                        project.phases = project.phases || [];
                    }
                    
                    const projectPhaseByName = toMap(project.phases, ph => ph.name?.toLowerCase());
                    const incomingPhaseByName = toMap(ip.phases || [], ph => ph.name?.toLowerCase());
                    
                    // Add/update phases
                    Object.values(incomingPhaseByName).forEach(iph => {
                        if (!iph.name) return;
                        const pKey = iph.name.toLowerCase();
                        let phase = projectPhaseByName[pKey];
                        const mappedSkillIds = (iph.requiredSkillIds || []).map(sid => {
                            const incSkill = incoming.skills.find(s => s.id === sid);
                            return incSkill ? nextSkillByName[incSkill.name.toLowerCase()]?.id : null;
                        }).filter(Boolean);
                        if (!phase) {
                            phase = {
                                id: Data.generateId('phase'),
                                name: iph.name,
                                startQuarter: iph.startQuarter || next.quarters[0],
                                endQuarter: iph.endQuarter || iph.startQuarter || next.quarters[0],
                                requiredSkillIds: mappedSkillIds,
                                predecessorPhaseId: null,
                                predecessorName: iph.predecessorName || '',
                                assignments: []
                            };
                            project.phases.push(phase);
                            projectPhaseByName[pKey] = phase;
                        } else {
                            phase.startQuarter = iph.startQuarter || phase.startQuarter;
                            phase.endQuarter = iph.endQuarter || phase.endQuarter;
                            phase.requiredSkillIds = mappedSkillIds.length ? mappedSkillIds : phase.requiredSkillIds;
                            phase.predecessorName = iph.predecessorName || phase.predecessorName || '';
                            phase.assignments = phase.assignments || [];
                        }
                    });
                    
                    // Resolve predecessors by name
                    project.phases.forEach(ph => {
                        const predName = ph.predecessorName ? ph.predecessorName.toLowerCase() : '';
                        if (predName && projectPhaseByName[predName]) {
                            ph.predecessorPhaseId = projectPhaseByName[predName].id;
                        }
                    });
                    
                    // Assignments merge (per phase)
                    Object.values(incomingPhaseByName).forEach(iph => {
                        const phase = projectPhaseByName[iph.name?.toLowerCase()];
                        if (!phase) return;
                        const incomingAssignments = iph.assignments || [];
                        incomingAssignments.forEach(a => {
                            const incMember = incomingMembersById[a.memberId];
                            if (!incMember) return;
                            const member = nextMemberByName[incMember.name.toLowerCase()];
                            if (!member) {
                                report.warnings.push(`Assignments: member "${incMember.name}" not found; row skipped`);
                                return;
                            }
                            const key = `${member.id}-${a.quarter || phase.startQuarter}`;
                            const existing = (phase.assignments || []).find(x => `${x.memberId}-${x.quarter}` === key);
                            if (existing) {
                                if (!isNaN(a.days)) existing.days = a.days;
                            } else if (!isNaN(a.days)) {
                                phase.assignments.push({
                                    memberId: member.id,
                                    quarter: a.quarter || phase.startQuarter,
                                    days: a.days
                                });
                            }
                        });
                    });
                });
                
                // Time Off merge by member+quarter
                const timeOffKey = (t) => `${t.memberId}-${t.quarter}`;
                const nextTimeOffMap = toMap(next.timeOff, t => timeOffKey(t));
                incoming.timeOff.forEach(it => {
                    const incMember = incomingMembersById[it.memberId];
                    if (!incMember) return;
                    const member = nextMemberByName[incMember.name.toLowerCase()];
                    if (!member) {
                        report.warnings.push(`TimeOff: member "${incMember.name}" not found; row skipped`);
                        return;
                    }
                    const key = `${member.id}-${it.quarter}`;
                    const existing = nextTimeOffMap[key];
                    if (existing) {
                        if (!isNaN(it.days)) existing.days = it.days;
                        existing.reason = it.reason || existing.reason;
                    } else if (!isNaN(it.days)) {
                        const entry = { id: Data.generateId('to'), memberId: member.id, quarter: it.quarter, days: it.days, reason: it.reason || '' };
                        next.timeOff.push(entry);
                        nextTimeOffMap[key] = entry;
                    }
                });
                
                // Public Holidays merge by country+date
                const nextHolidayKey = h => `${h.countryId}-${h.date}`;
                const nextHolidayMap = toMap(next.publicHolidays, h => nextHolidayKey(h));
                incoming.publicHolidays.forEach(ih => {
                    const incCountry = incoming.countries.find(c => c.id === ih.countryId);
                    const code = incCountry?.code?.toUpperCase();
                    const mappedCountryId = code ? nextCountryByCode[code]?.id : null;
                    if (!mappedCountryId) {
                        report.warnings.push(`PublicHolidays: country code "${code || 'unknown'}" not found; row skipped`);
                        return;
                    }
                    const key = `${mappedCountryId}-${ih.date}`;
                    const existing = nextHolidayMap[key];
                    if (existing) {
                        existing.name = ih.name || existing.name;
                    } else {
                        const entry = { id: Data.generateId('hol'), countryId: mappedCountryId, date: ih.date, name: ih.name || 'Holiday' };
                        next.publicHolidays.push(entry);
                        nextHolidayMap[key] = entry;
                    }
                });
                
                return next;
            },
            formatValidationReport(report, errorsOnly = false) {
                const lines = [];
                lines.push('Excel Import Validation Report');
                lines.push(`Errors: ${report.errors.length} · Warnings: ${report.warnings.length}`);
                const list = errorsOnly ? report.errors : [...report.errors, ...report.warnings];
                if (list.length === 0) {
                    lines.push('No issues detected.');
                } else {
                    const maxItems = 15;
                    list.slice(0, maxItems).forEach((msg, idx) => lines.push(`${idx + 1}. ${msg}`));
                    if (list.length > maxItems) lines.push(`...and ${list.length - maxItems} more`);
                }
                return lines.join('\n');
            },
            toCSV() {
                this.log('Exporting to CSV');
                const st = getState();
                let csv = 'Team Capacity Report (days-based)\n\n';
                
                // Team section
                csv += 'TEAM MEMBERS\nName,Role,Country,Skills,Max Projects\n';
                st.teamMembers.forEach(m => {
                    const skills = m.skillIds.map(sid => st.skills.find(s => s.id === sid)?.name || '').join('; ');
                    const country = st.countries.find(c => c.id === m.countryId)?.code || '';
                    csv += `"${m.name}","${m.role}","${country}","${skills}",${m.maxConcurrentProjects}\n`;
                });
                
                // Projects section
                csv += '\nPROJECTS\nName,Priority,System,Status\n';
                st.projects.forEach(p => {
                    csv += `"${p.name}","${p.priority}","${p.system}","${p.status}"\n`;
                });
                
                // Phases section
                csv += '\nPHASES\nProject,Phase,StartQuarter,EndQuarter,RequiredSkills,Predecessor\n';
                st.projects.forEach(p => {
                    p.phases.forEach(ph => {
                        const skills = (ph.requiredSkillIds || []).map(id => st.skills.find(s => s.id === id)?.name || '').join('; ');
                        const predecessor = p.phases.find(x => x.id === ph.predecessorPhaseId)?.name || '';
                        csv += `"${p.name}","${ph.name}","${ph.startQuarter}","${ph.endQuarter}","${skills}","${predecessor}"\n`;
                    });
                });
                
                // Assignments section
                csv += '\nASSIGNMENTS\nProject,Phase,Member,Quarter,Days\n';
                st.projects.forEach(p => {
                    p.phases.forEach(ph => {
                        ph.assignments.forEach(a => {
                            const member = st.teamMembers.find(m => m.id === a.memberId);
                            csv += `"${p.name}","${ph.name}","${member?.name || ''}","${a.quarter}",${a.days ?? 0}\n`;
                        });
                    });
                });
                
                // Time Off section
                csv += '\nTIME OFF\nMember,Quarter,Days,Reason\n';
                st.timeOff.forEach(t => {
                    const member = st.teamMembers.find(m => m.id === t.memberId);
                    csv += `"${member?.name || ''}","${t.quarter}",${t.days ?? 0},"${t.reason || ''}"\n`;
                });
                
                const filename = `capacity-planner-${new Date().toISOString().split('T')[0]}.csv`;
                if (this.downloadFile(csv, filename, 'text/csv')) {
                    showToast('Data exported as CSV', 'success');
                }
            }
        };
        
        /* ═══════════════════════════════════════════════════════════════════════════
           JS SECTION 12: GLOBAL FUNCTIONS & INITIALIZATION
           Toast notifications, What-If mode, and app initialization
           ═══════════════════════════════════════════════════════════════════════════ */
        
        /**
         * Show a toast notification
         * @param {string} message - Notification message
         * @param {string} [type='info'] - Toast type (info, success, warning, error)
         */
        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        
        // What-If Mode
        function toggleWhatIfMode() {
            console.log('[WhatIf] Toggling mode');
            if (!isWhatIfMode) {
                whatIfState = JSON.parse(JSON.stringify(state));
                isWhatIfMode = true;
                document.getElementById('app').classList.add('whatif-mode');
                document.getElementById('whatif-toggle').classList.add('active');
                document.getElementById('whatif-banner').classList.add('visible');
                showToast('What-If Mode enabled', 'warning');
            } else {
                exitWhatIfMode(false);
            }
            UI.renderView(currentView);
        }
        
        function exitWhatIfMode(save) {
            if (save) {
                state = whatIfState;
                Storage.save(state);
                showToast('Changes saved', 'success');
            } else {
                showToast('Changes discarded', 'info');
            }
            isWhatIfMode = false;
            whatIfState = null;
            document.getElementById('app').classList.remove('whatif-mode');
            document.getElementById('whatif-toggle').classList.remove('active');
            document.getElementById('whatif-banner').classList.remove('visible');
            UI.renderView(currentView);
        }
        
        // Initialization
        function init() {
            console.log('[App] Initializing...');
            
            // Load state
            const savedState = Storage.load();
            if (savedState) {
                state = savedState;
                if (!state.quarters || state.quarters.length === 0) {
                    state.quarters = generateQuarters();
                }
                // Migrate: add roles if not present
                if (!state.roles || state.roles.length === 0) {
                    state.roles = [
                        { id: 'role-1', name: 'Service Manager' },
                        { id: 'role-2', name: 'ERP Specialist' },
                        { id: 'role-3', name: 'Manager ERP' },
                        { id: 'role-4', name: 'TMS Specialist' },
                        { id: 'role-5', name: 'iWMS Specialist' },
                        { id: 'role-6', name: 'EPM Specialist' }
                    ];
                    Storage.save(state);
                    console.log('[App] Migrated: Added roles');
                }
            } else {
                state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                state.quarters = generateQuarters();
                Storage.save(state);
            }
            
            console.log('[App] State loaded', { projects: state.projects.length, members: state.teamMembers.length });
            
            // Initialize history with current state
            History.clear();
            
            // Set up navigation
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', () => UI.renderView(btn.dataset.view));
            });
            
            // Modal close handlers
            document.getElementById('modal-close')?.addEventListener('click', Modal.close);
            document.getElementById('modal-overlay')?.addEventListener('click', e => {
                if (e.target.id === 'modal-overlay') Modal.close();
            });
            
            // What-If mode handlers
            document.getElementById('whatif-toggle')?.addEventListener('click', toggleWhatIfMode);
            document.getElementById('whatif-save')?.addEventListener('click', () => exitWhatIfMode(true));
            document.getElementById('whatif-discard')?.addEventListener('click', () => exitWhatIfMode(false));
            
            // Theme toggle handler
            const themeToggle = document.getElementById('theme-toggle');
            const themeIconLight = document.getElementById('theme-icon-light');
            const themeIconDark = document.getElementById('theme-icon-dark');
            
            function updateThemeIcons(isDark) {
                if (themeIconLight && themeIconDark) {
                    themeIconLight.style.display = isDark ? 'none' : 'block';
                    themeIconDark.style.display = isDark ? 'block' : 'none';
                }
            }
            
            function toggleTheme() {
                const app = document.getElementById('app');
                const isDark = app.classList.toggle('dark-mode');
                localStorage.setItem('capacity-planner-theme', isDark ? 'dark' : 'light');
                updateThemeIcons(isDark);
            }
            
            // Load saved theme preference
            const savedTheme = localStorage.getItem('capacity-planner-theme');
            if (savedTheme === 'dark') {
                document.getElementById('app').classList.add('dark-mode');
                updateThemeIcons(true);
            }
            
            themeToggle?.addEventListener('click', toggleTheme);
            
            // Floating Action Button (FAB) handlers
            const fabContainer = document.getElementById('fab-container');
            const fabMain = document.getElementById('fab-main');
            const fabBackdrop = document.getElementById('fab-backdrop');
            
            function toggleFab() {
                fabContainer?.classList.toggle('open');
            }
            
            function closeFab() {
                fabContainer?.classList.remove('open');
            }
            
            fabMain?.addEventListener('click', toggleFab);
            fabBackdrop?.addEventListener('click', closeFab);
            
            document.getElementById('fab-add-project')?.addEventListener('click', () => {
                closeFab();
                Modal.openProjectModal();
            });
            
            document.getElementById('fab-add-timeoff')?.addEventListener('click', () => {
                closeFab();
                Modal.openTimeOffModal();
            });
            
            document.getElementById('fab-add-member')?.addEventListener('click', () => {
                closeFab();
                Modal.openMemberModal();
            });
            
            // Close FAB on escape key
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && fabContainer?.classList.contains('open')) {
                    closeFab();
                }
            });
            
            // Undo/Redo button handlers
            document.getElementById('undo-btn')?.addEventListener('click', () => History.undo());
            document.getElementById('redo-btn')?.addEventListener('click', () => History.redo());
            
            // Keyboard shortcuts
            document.addEventListener('keydown', e => {
                // Undo: Ctrl+Z
                if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                    e.preventDefault();
                    History.undo();
                    return;
                }
                // Redo: Ctrl+Y or Ctrl+Shift+Z
                if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
                    e.preventDefault();
                    History.redo();
                    return;
                }
                if (e.ctrlKey && e.shiftKey && e.key === 'W') {
                    e.preventDefault();
                    toggleWhatIfMode();
                }
                if (e.key === 'Escape') {
                    Modal.close();
                }
                if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                    const views = ['dashboard', 'timeline', 'projects', 'team', 'settings'];
                    const num = parseInt(e.key);
                    if (num >= 1 && num <= 5 && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                        UI.renderView(views[num - 1]);
                    }
                }
                if (e.key === 'n' && currentView === 'projects' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    Modal.openProjectModal();
                }
            });
            
            // Render initial view
            UI.renderView(state.settings.defaultView || 'dashboard');
            
            console.log('[App] Initialization complete');
        }
        
        // Public API
        return {
            init,
            getState,
            Data,
            Capacity,
            Calendar,
            UI,
            Modal,
            Export,
            History,
            showToast
        };
    })();
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', App.init);
    
    // Make Modal accessible globally for onclick handlers
    window.Modal = App.Modal;
