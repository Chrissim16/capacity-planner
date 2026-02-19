# Technology Stack

## Overview

The Capacity Planner is a **single-page application (SPA)** built with modern web technologies, designed for simplicity and maintainability.

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │  React  │  │   TS    │  │ Tailwind│  │ Zustand │    │
│  │   18    │  │  5.x    │  │   3.x   │  │   4.x   │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
├─────────────────────────────────────────────────────────┤
│                    Build Tools                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │  Vite   │  │ PostCSS │  │  ESLint │                 │
│  │   5.x   │  │         │  │         │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
├─────────────────────────────────────────────────────────┤
│                    Deployment                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ Vercel  │  │ GitHub  │  │  Local  │                 │
│  │ Hosting │  │  Repo   │  │ Storage │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
├─────────────────────────────────────────────────────────┤
│                   External APIs                          │
│  ┌─────────────────────────────────────┐               │
│  │         Jira Cloud REST API          │               │
│  └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

## Core Technologies

### React 18
- **Why**: Component-based UI, large ecosystem, team familiarity
- **Features used**: Hooks, functional components, memo
- **Not used**: Class components, Context (using Zustand instead)

### TypeScript 5.x
- **Why**: Type safety, better IDE support, self-documenting code
- **Strictness**: Strict mode enabled
- **Convention**: All files are `.tsx` or `.ts`

### Tailwind CSS 3.x
- **Why**: Rapid styling, consistent design system, dark mode support
- **Configuration**: Custom color palette, responsive breakpoints
- **Convention**: Utility classes directly in JSX, no separate CSS files

### Zustand 4.x
- **Why**: Simple state management, no boilerplate, good TypeScript support
- **Pattern**: Single store with slices for data and UI state
- **Persistence**: localStorage via built-in middleware

### Vite 5.x
- **Why**: Fast development server, modern build tooling
- **Configuration**: Minimal, works out of the box
- **Output**: Optimized production bundle

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/           # Base components (Button, Card, Modal)
│   │   ├── forms/        # Form components
│   │   └── layout/       # Layout components (Header, Layout)
│   ├── pages/            # Page components (Dashboard, Team, etc.)
│   ├── stores/           # Zustand store and actions
│   │   ├── appStore.ts   # Store definition
│   │   └── actions.ts    # State mutation functions
│   ├── services/         # External API integrations
│   │   └── jira.ts       # Jira Cloud API client
│   ├── utils/            # Helper functions
│   │   ├── calendar.ts   # Date/quarter calculations
│   │   ├── capacity.ts   # Capacity calculation logic
│   │   └── importExport.ts
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts      # All interfaces and types
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── docs/                 # Documentation (this folder)
├── public/               # Static assets
├── index.html            # HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Coding Conventions

### Components
```typescript
// Functional components with explicit return types
export function MyComponent({ prop }: MyComponentProps): JSX.Element {
  // Hooks at top
  const [state, setState] = useState<Type>(initial);
  const data = useAppStore((s) => s.data);
  
  // Event handlers
  const handleClick = () => { ... };
  
  // Render
  return (
    <div className="...tailwind classes...">
      {/* JSX */}
    </div>
  );
}
```

### State Actions
```typescript
// Pure functions that mutate store state
export function addProject(projectData: Omit<Project, 'id'>): Project {
  const state = useAppStore.getState();
  const newProject: Project = {
    ...projectData,
    id: generateId('project'),
  };
  state.updateData({ projects: [...state.getCurrentState().projects, newProject] });
  return newProject;
}
```

### Type Definitions
```typescript
// Interfaces for objects, types for unions/primitives
interface Project {
  id: string;
  name: string;
}

type ProjectStatus = 'Planning' | 'Active' | 'Completed';
```

### Imports
```typescript
// Order: React, external libs, internal (absolute), internal (relative)
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useAppStore } from '../stores/appStore';
import { Button } from './ui/Button';
import type { Project } from '../types';
```

## Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | React DOM renderer |
| zustand | ^4.4.0 | State management |
| clsx | ^2.0.0 | Conditional class names |
| lucide-react | ^0.300.0 | Icon library |
| xlsx | ^0.18.5 | Excel import/export |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3.0 | Type checking |
| vite | ^5.0.0 | Build tool |
| @vitejs/plugin-react | ^4.2.0 | React plugin for Vite |
| tailwindcss | ^3.4.0 | CSS framework |
| postcss | ^8.4.0 | CSS processing |
| autoprefixer | ^10.4.0 | CSS vendor prefixes |
| eslint | ^8.56.0 | Linting |

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Edge (latest 2 versions)
- Safari (latest 2 versions)

No IE11 support (uses modern JavaScript features).

## Performance Considerations

1. **Bundle splitting**: Vite automatically code-splits
2. **Memoization**: Use `useMemo` for expensive calculations
3. **Selective subscriptions**: Zustand selectors prevent unnecessary re-renders
4. **Lazy loading**: Not currently used (small app), available if needed

## Security Notes

1. **API tokens**: Currently stored in localStorage (acceptable for single-user)
2. **CORS**: Jira API calls may require proxy in production
3. **XSS**: React's JSX escaping provides protection
4. **No server**: All data local, no server-side vulnerabilities
