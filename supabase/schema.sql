-- ═══════════════════════════════════════════════════════════════════════════════
-- MILEWAY IT CAPACITY PLANNER - SUPABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════
-- Database: PostgreSQL (Supabase)
-- This schema defines all tables for the capacity planning application
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════
-- REFERENCE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Countries table for location-based holiday management
CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public holidays by country
CREATE TABLE public_holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_id, date)
);

-- Roles for team members
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills that can be assigned to team members
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('System', 'Process', 'Technical')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, category)
);

-- Systems/Applications
CREATE TABLE systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Team members
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    max_concurrent_projects INT DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team member skills (many-to-many)
CREATE TABLE team_member_skills (
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (member_id, skill_id)
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
    status VARCHAR(50) NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled')),
    devops_link TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project systems (many-to-many)
CREATE TABLE project_systems (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, system_id)
);

-- Project phases
CREATE TABLE project_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    start_quarter VARCHAR(20) NOT NULL,  -- Format: "Q1 2026"
    end_quarter VARCHAR(20) NOT NULL,
    predecessor_phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase required skills (many-to-many)
CREATE TABLE phase_required_skills (
    phase_id UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (phase_id, skill_id)
);

-- Phase assignments (team member allocation to phases)
CREATE TABLE phase_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_id UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    quarter VARCHAR(20) NOT NULL,  -- Format: "Q1 2026"
    days DECIMAL(5,1) NOT NULL DEFAULT 0,  -- Days allocated in the quarter
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phase_id, member_id, quarter)
);

-- Time off records
CREATE TABLE time_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    quarter VARCHAR(20) NOT NULL,  -- Format: "Q1 2026"
    days DECIMAL(5,1) NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, quarter)
);

-- Application settings (key-value store)
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_public_holidays_country ON public_holidays(country_id);
CREATE INDEX idx_public_holidays_date ON public_holidays(date);
CREATE INDEX idx_team_members_country ON team_members(country_id);
CREATE INDEX idx_team_members_role ON team_members(role_id);
CREATE INDEX idx_team_members_active ON team_members(is_active);
CREATE INDEX idx_project_phases_project ON project_phases(project_id);
CREATE INDEX idx_phase_assignments_phase ON phase_assignments(phase_id);
CREATE INDEX idx_phase_assignments_member ON phase_assignments(member_id);
CREATE INDEX idx_phase_assignments_quarter ON phase_assignments(quarter);
CREATE INDEX idx_time_off_member ON time_off(member_id);
CREATE INDEX idx_time_off_quarter ON time_off(quarter);
CREATE INDEX idx_projects_status ON projects(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Enable for all tables - configure policies based on your auth needs
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_required_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (allow all for now, can restrict later)
-- You can customize these based on your organization's needs

CREATE POLICY "Allow all for authenticated users" ON countries
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public_holidays
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON roles
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON skills
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON systems
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON team_members
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON team_member_skills
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON projects
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_systems
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_phases
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON phase_required_skills
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON phase_assignments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON time_off
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON settings
    FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON project_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase_assignments_updated_at BEFORE UPDATE ON phase_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_updated_at BEFORE UPDATE ON time_off
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA - Default reference data
-- ═══════════════════════════════════════════════════════════════════════════════

-- Insert default countries
INSERT INTO countries (code, name) VALUES
    ('NL', 'Netherlands'),
    ('UK', 'United Kingdom'),
    ('CZ', 'Czech Republic'),
    ('LU', 'Luxembourg');

-- Insert default roles
INSERT INTO roles (name) VALUES
    ('Service Manager'),
    ('ERP Specialist'),
    ('Manager ERP'),
    ('TMS Specialist'),
    ('iWMS Specialist'),
    ('EPM Specialist');

-- Insert default skills
INSERT INTO skills (name, category) VALUES
    ('SAP ECC', 'System'),
    ('SAP S/4HANA', 'System'),
    ('Yardi Voyager', 'System'),
    ('FIS Integrity', 'System'),
    ('Planon', 'System'),
    ('OneStream', 'System'),
    ('Basware', 'System'),
    ('Treasury Management', 'Process'),
    ('Financial Close', 'Process'),
    ('P2P Process', 'Process'),
    ('Integration/API', 'Technical'),
    ('Data Migration', 'Technical'),
    ('Testing', 'Technical');

-- Insert default systems
INSERT INTO systems (name, description) VALUES
    ('ERP', 'Enterprise Resource Planning'),
    ('TMS', 'Treasury Management System'),
    ('iWMS', 'Integrated Workplace Management System'),
    ('EPM', 'Enterprise Performance Management');

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('bau_reserve_days', '5'),
    ('hours_per_day', '8'),
    ('default_view', '"dashboard"'),
    ('quarters_to_show', '4'),
    ('default_country_code', '"NL"'),
    ('dark_mode', 'false'),
    ('sprint_duration_weeks', '3'),
    ('sprint_start_date', '"2026-01-05"'),
    ('sprints_to_show', '6'),
    ('sprints_per_year', '16'),
    ('bye_weeks_after', '[8, 12]'),
    ('holiday_weeks_at_end', '2');

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS (optional, for easier querying)
-- ═══════════════════════════════════════════════════════════════════════════════

-- View: Team member with country and role
CREATE OR REPLACE VIEW v_team_members AS
SELECT 
    tm.id,
    tm.name,
    tm.max_concurrent_projects,
    tm.is_active,
    r.name AS role_name,
    c.code AS country_code,
    c.name AS country_name,
    tm.created_at,
    tm.updated_at
FROM team_members tm
LEFT JOIN roles r ON tm.role_id = r.id
LEFT JOIN countries c ON tm.country_id = c.id;

-- View: Project with systems
CREATE OR REPLACE VIEW v_projects AS
SELECT 
    p.id,
    p.name,
    p.priority,
    p.status,
    p.devops_link,
    p.description,
    COALESCE(
        json_agg(
            json_build_object('id', s.id, 'name', s.name)
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
    ) AS systems,
    p.created_at,
    p.updated_at
FROM projects p
LEFT JOIN project_systems ps ON p.id = ps.project_id
LEFT JOIN systems s ON ps.system_id = s.id
GROUP BY p.id;

-- View: Phase assignments with member info
CREATE OR REPLACE VIEW v_phase_assignments AS
SELECT 
    pa.id,
    pa.phase_id,
    pa.quarter,
    pa.days,
    tm.id AS member_id,
    tm.name AS member_name,
    pp.name AS phase_name,
    pr.name AS project_name
FROM phase_assignments pa
JOIN team_members tm ON pa.member_id = tm.id
JOIN project_phases pp ON pa.phase_id = pp.id
JOIN projects pr ON pp.project_id = pr.id;
