# Deployment

## Overview

The Capacity Planner is deployed as a static site on **Vercel**, with source code hosted on **GitHub**.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Local     │────>│   GitHub    │────>│   Vercel    │
│   Dev       │push │    Repo     │auto │   Hosting   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Repository

- **URL**: https://github.com/Chrissim16/capacity-planner
- **Branch**: `main` (production)
- **Structure**: Monorepo with `frontend/` subdirectory

## Vercel Configuration

### vercel.json (root)
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install",
  "framework": null
}
```

### Build Settings
| Setting | Value |
|---------|-------|
| Framework | Other |
| Build Command | `cd frontend && npm install && npm run build` |
| Output Directory | `frontend/dist` |
| Install Command | `cd frontend && npm install` |

## Deployment Flow

### Automatic Deployments

1. Push to `main` branch
2. GitHub webhook triggers Vercel
3. Vercel clones repo
4. Runs install and build commands
5. Deploys to production URL
6. Previous deployment becomes rollback option

### Preview Deployments

- Every PR gets a preview URL
- Format: `capacity-planner-{branch}-{hash}.vercel.app`
- Useful for testing changes before merge

## Local Development

### Prerequisites
- Node.js 20.x or later
- npm 10.x or later

### Setup
```bash
cd frontend
npm install
npm run dev
```

### Available Scripts
```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

## Environment Variables

Currently none required. The app runs entirely client-side.

### Future Considerations
If server-side features are added:
```
JIRA_API_PROXY_URL=    # Proxy for Jira API (CORS)
SENTRY_DSN=            # Error tracking
ANALYTICS_ID=          # Usage analytics
```

## Domain Configuration

### Current
- Production: Vercel-provided URL
- Custom domain: Not configured

### To Add Custom Domain
1. Go to Vercel project settings
2. Add domain under "Domains"
3. Configure DNS (CNAME or A record)
4. SSL automatically provisioned

## Rollback Procedure

1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find previous working deployment
4. Click "..." menu → "Promote to Production"

## Troubleshooting

### White Page After Deploy
- Check `vercel.json` output directory
- Verify build command runs in `frontend/`
- Check browser console for errors

### Build Failures
- Check Node.js version compatibility
- Review build logs in Vercel dashboard
- Test build locally: `npm run build`

### CORS Issues with Jira
- Jira API may block browser requests
- Solution: Use Vercel serverless function as proxy
- Or configure Jira's CORS settings (if you have access)

## Monitoring

### Vercel Analytics
- Enabled by default
- View in Vercel dashboard
- Tracks page views, performance

### Error Tracking
- Not currently configured
- Recommend: Sentry integration

## CI/CD Future Improvements

1. **GitHub Actions**: Run tests before deploy
2. **Preview comments**: Auto-comment preview URLs on PRs
3. **Lighthouse CI**: Performance checks
4. **Dependabot**: Automated dependency updates
