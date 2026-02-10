# Scaling Roadmap: Capacity Planner

A strategic guide to transform the Capacity Planner into a scalable, multi-tenant SaaS product.

---

## Executive Summary

| Current State | Target State |
|---------------|--------------|
| Single HTML file | Modular React/TypeScript app |
| localStorage | PostgreSQL (Supabase) |
| No auth | Multi-tenant with SSO |
| Manual deployment | CI/CD with preview environments |
| Single user | Teams & organizations |

**Estimated effort:** 12-16 weeks for full transformation

---

## Phase 1: Foundation (Weeks 1-4)

### 1.1 Modern Frontend Architecture

**Current:** Vanilla JS with IIFE pattern (~6000 lines in one file)

**Recommended:** React + TypeScript + Vite

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Design system (Button, Modal, Badge)
│   ├── dashboard/       # Dashboard-specific components
│   ├── timeline/        # Gantt chart components
│   ├── projects/        # Project management
│   └── team/            # Team management
├── hooks/               # Custom React hooks
│   ├── useCapacity.ts   # Capacity calculations
│   ├── useProjects.ts   # Project data
│   └── useAuth.ts       # Authentication
├── stores/              # State management (Zustand)
│   ├── appStore.ts      # Global app state
│   └── filterStore.ts   # Filter/view state
├── services/            # API layer
│   ├── supabase.ts      # Database client
│   └── api.ts           # API utilities
├── utils/               # Pure utility functions
│   ├── calendar.ts      # Date/workday calculations
│   ├── capacity.ts      # Capacity formulas
│   └── format.ts        # Formatting helpers
├── types/               # TypeScript interfaces
│   └── index.ts         # All type definitions
└── pages/               # Route pages
    ├── Dashboard.tsx
    ├── Timeline.tsx
    ├── Projects.tsx
    ├── Team.tsx
    └── Settings.tsx
```

**Benefits:**
- Type safety catches bugs at compile time
- Component reusability
- Better developer experience
- Easier testing
- Tree-shaking reduces bundle size

### 1.2 Extract Calculation Logic

**Critical:** Move all business logic to pure TypeScript functions:

```typescript
// utils/capacity.ts
export interface CapacityResult {
  totalWorkdays: number;
  usedDays: number;
  availableDays: number;
  usedPercent: number;
  status: 'normal' | 'warning' | 'overallocated';
  breakdown: CapacityBreakdownItem[];
}

export function calculateCapacity(
  memberId: string,
  quarter: string,
  state: AppState
): CapacityResult {
  // Pure function - no side effects
  // Easy to test
  // Can run on server or client
}
```

**Why this matters:**
- Calculations can run server-side for reports/exports
- Unit testable (currently impossible)
- Consistent results across platforms
- Enables real-time collaboration later

### 1.3 Database Schema Optimization

**Current Supabase schema is good, but add:**

```sql
-- Organizations (multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add org_id to all tables
ALTER TABLE team_members ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN org_id UUID REFERENCES organizations(id);
-- etc.

-- Audit log for compliance
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_team_members_org ON team_members(org_id);
CREATE INDEX idx_projects_org ON projects(org_id);
CREATE INDEX idx_audit_log_org_created ON audit_log(org_id, created_at DESC);
```

---

## Phase 2: Authentication & Multi-Tenancy (Weeks 5-8)

### 2.1 Authentication Options

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **Supabase Auth** | Built-in, free | Limited SSO | Small teams |
| **Azure AD** | Enterprise SSO, existing infra | Complex setup | Mileway internal |
| **Auth0** | Feature-rich, many providers | Cost at scale | Public SaaS |
| **Clerk** | Great DX, modern | Newer product | Startups |

**Recommended for Mileway:** Azure AD (already in your ecosystem)

```typescript
// hooks/useAuth.ts
import { useMsal } from '@azure/msal-react';

export function useAuth() {
  const { instance, accounts } = useMsal();
  
  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();
  
  return {
    user: accounts[0],
    isAuthenticated: accounts.length > 0,
    login,
    logout
  };
}
```

### 2.2 Multi-Tenancy Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
├─────────────────────────────────────────────────────────────┤
│  Organization A        │  Organization B        │  Org C    │
│  ┌─────────────────┐   │  ┌─────────────────┐   │  ...      │
│  │ Team Members    │   │  │ Team Members    │   │           │
│  │ Projects        │   │  │ Projects        │   │           │
│  │ Settings        │   │  │ Settings        │   │           │
│  └─────────────────┘   │  └─────────────────┘   │           │
└─────────────────────────────────────────────────────────────┘
```

**Row Level Security (critical!):**

```sql
-- All queries automatically filtered by organization
CREATE POLICY "Users can only see their org's data" ON projects
    FOR ALL USING (
        org_id = (
            SELECT org_id FROM user_memberships 
            WHERE user_id = auth.uid()
        )
    );
```

### 2.3 Role-Based Access Control (RBAC)

```typescript
type Role = 'viewer' | 'member' | 'manager' | 'admin' | 'owner';

interface Permission {
  projects: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  team: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  settings: { view: boolean; edit: boolean };
  reports: { view: boolean; export: boolean };
}

const ROLE_PERMISSIONS: Record<Role, Permission> = {
  viewer: {
    projects: { view: true, create: false, edit: false, delete: false },
    team: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, edit: false },
    reports: { view: true, export: false }
  },
  member: { /* ... */ },
  manager: { /* ... */ },
  admin: { /* ... */ },
  owner: { /* all true */ }
};
```

---

## Phase 3: Real-Time & Collaboration (Weeks 9-12)

### 3.1 Real-Time Updates

**Use Supabase Realtime:**

```typescript
// Subscribe to changes
const subscription = supabase
  .channel('projects')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'projects' },
    (payload) => {
      // Update local state
      queryClient.invalidateQueries(['projects']);
    }
  )
  .subscribe();
```

**Benefits:**
- Multiple users see changes instantly
- No manual refresh needed
- Conflict-free collaboration

### 3.2 Optimistic Updates

```typescript
// React Query with optimistic updates
const updateProject = useMutation({
  mutationFn: (data) => supabase.from('projects').update(data),
  onMutate: async (newData) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries(['projects']);
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['projects']);
    
    // Optimistically update
    queryClient.setQueryData(['projects'], (old) => 
      old.map(p => p.id === newData.id ? { ...p, ...newData } : p)
    );
    
    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['projects'], context.previous);
  }
});
```

### 3.3 Conflict Resolution

For capacity planning, conflicts matter! Two managers assigning the same person:

```typescript
// Option 1: Last-write-wins (simple but can lose data)
// Option 2: Merge with conflict UI (better UX)

interface Conflict {
  field: string;
  localValue: any;
  remoteValue: any;
  timestamp: Date;
}

function resolveConflict(local: Assignment, remote: Assignment): Assignment {
  // If same quarter assignment, show conflict modal
  if (local.quarter === remote.quarter && local.memberId === remote.memberId) {
    return showConflictModal(local, remote);
  }
  // Otherwise, merge
  return { ...local, ...remote };
}
```

---

## Phase 4: Performance & Scale (Weeks 13-16)

### 4.1 Frontend Performance

| Technique | Implementation | Impact |
|-----------|----------------|--------|
| **Code splitting** | `React.lazy()` for routes | -50% initial bundle |
| **Virtual scrolling** | `react-window` for lists | Handle 1000+ items |
| **Memoization** | `useMemo`, `React.memo` | Prevent re-renders |
| **Service Worker** | Offline support | Works without network |

```typescript
// Code splitting example
const Timeline = lazy(() => import('./pages/Timeline'));
const Projects = lazy(() => import('./pages/Projects'));

// Virtual scrolling for large team lists
import { FixedSizeList } from 'react-window';

function TeamList({ members }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={members.length}
      itemSize={60}
    >
      {({ index, style }) => (
        <TeamMemberRow member={members[index]} style={style} />
      )}
    </FixedSizeList>
  );
}
```

### 4.2 Database Performance

```sql
-- Materialized view for dashboard stats (refresh periodically)
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
    org_id,
    quarter,
    COUNT(DISTINCT tm.id) as total_members,
    COUNT(DISTINCT p.id) as active_projects,
    AVG(utilization) as avg_utilization
FROM team_members tm
JOIN organizations o ON tm.org_id = o.id
-- ... complex joins ...
GROUP BY org_id, quarter;

-- Refresh every hour
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Caching Strategy

```typescript
// React Query with smart caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      cacheTime: 30 * 60 * 1000,    // 30 minutes
      refetchOnWindowFocus: true,
      retry: 3
    }
  }
});

// Cache capacity calculations (expensive)
const useCapacity = (memberId: string, quarter: string) => {
  return useQuery({
    queryKey: ['capacity', memberId, quarter],
    queryFn: () => calculateCapacity(memberId, quarter),
    staleTime: 10 * 60 * 1000,  // Cache for 10 min
  });
};
```

---

## Phase 5: Enterprise Features (Future)

### 5.1 Advanced Reporting

```typescript
// Scheduled reports via Supabase Edge Functions
// supabase/functions/weekly-report/index.ts

import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (req) => {
  const report = await generateWeeklyReport();
  await sendEmail(report);
  return new Response('OK');
});
```

### 5.2 Integrations

| Integration | Purpose | Priority |
|-------------|---------|----------|
| **Azure DevOps** | Sync projects/tasks | High |
| **Outlook Calendar** | Sync time off | High |
| **Teams** | Notifications | Medium |
| **Power BI** | Advanced analytics | Medium |
| **Jira** | Alternative PM tool | Low |

### 5.3 API for External Access

```typescript
// RESTful API with Supabase Edge Functions
// or Next.js API routes

// GET /api/v1/capacity/:memberId/:quarter
export async function GET(req: Request) {
  const { memberId, quarter } = req.params;
  const capacity = await calculateCapacity(memberId, quarter);
  return Response.json(capacity);
}
```

### 5.4 White-Labeling

```typescript
// Tenant-specific branding
interface TenantBranding {
  logo: string;
  primaryColor: string;
  companyName: string;
  favicon: string;
}

// CSS variables per tenant
:root {
  --brand-primary: var(--tenant-primary, #2563eb);
  --brand-logo: var(--tenant-logo, url('/logo.svg'));
}
```

---

## Technology Stack Recommendation

### Frontend
| Tool | Purpose | Why |
|------|---------|-----|
| **React 18** | UI Framework | Industry standard, great ecosystem |
| **TypeScript** | Type safety | Catch bugs early, better DX |
| **Vite** | Build tool | Fast, modern, great DX |
| **TanStack Query** | Data fetching | Caching, optimistic updates |
| **Zustand** | State management | Simple, performant |
| **Tailwind CSS** | Styling | Utility-first, consistent |
| **Radix UI** | Accessible components | Unstyled, accessible |

### Backend
| Tool | Purpose | Why |
|------|---------|-----|
| **Supabase** | Database + Auth + Realtime | All-in-one, great free tier |
| **Edge Functions** | Serverless compute | Near-user execution |
| **PostgreSQL** | Database | Robust, scalable |

### Infrastructure
| Tool | Purpose | Why |
|------|---------|-----|
| **Vercel** | Hosting | Auto-scaling, preview deploys |
| **GitHub Actions** | CI/CD | Integrated, free |
| **Sentry** | Error tracking | Debug production issues |
| **PostHog** | Analytics | Open-source, privacy-focused |

---

## Migration Strategy

### Approach: Strangler Fig Pattern

Don't rewrite everything at once. Gradually replace:

```
Week 1-2:   Set up new React project alongside existing app
Week 3-4:   Migrate Dashboard view to React
Week 5-6:   Migrate Timeline view
Week 7-8:   Migrate Projects view
Week 9-10:  Migrate Team view
Week 11-12: Migrate Settings + cleanup
Week 13-14: Testing + polish
Week 15-16: Gradual rollout
```

### Data Migration

```typescript
// One-time migration script
async function migrateFromLocalStorage() {
  const localData = JSON.parse(localStorage.getItem('capacity-planner-data'));
  
  // Map old IDs to new UUIDs
  const idMap = new Map();
  
  // Migrate in dependency order
  await migrateCountries(localData.countries, idMap);
  await migrateRoles(localData.roles, idMap);
  await migrateSkills(localData.skills, idMap);
  await migrateSystems(localData.systems, idMap);
  await migrateTeamMembers(localData.teamMembers, idMap);
  await migrateProjects(localData.projects, idMap);
  await migrateTimeOff(localData.timeOff, idMap);
  
  console.log('Migration complete!');
}
```

---

## Cost Projections

### Small Team (5-20 users)
| Service | Monthly Cost |
|---------|--------------|
| Supabase Free | $0 |
| Vercel Free | $0 |
| **Total** | **$0** |

### Medium Team (20-100 users)
| Service | Monthly Cost |
|---------|--------------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| **Total** | **$45/month** |

### Enterprise (100+ users)
| Service | Monthly Cost |
|---------|--------------|
| Supabase Team | $599 |
| Vercel Team | $150 |
| Sentry | $26 |
| **Total** | **~$800/month** |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Page load time | ~2s | <500ms |
| Time to interactive | ~3s | <1s |
| Lighthouse score | ~70 | >90 |
| Test coverage | 0% | >80% |
| Uptime | N/A | 99.9% |
| User satisfaction | Unknown | >4.5/5 |

---

## Next Steps

1. **Immediate:** Continue using current app with Supabase backend
2. **Short-term:** Set up React project structure, migrate one view
3. **Medium-term:** Complete React migration, add auth
4. **Long-term:** Real-time collaboration, enterprise features

Would you like me to detail any specific phase?
