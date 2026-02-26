# Deployment Setup Guide

This guide walks you through deploying the Capacity Planner using **Supabase**, **GitHub**, and **Vercel**.

## Prerequisites

- GitHub account
- Supabase account (free tier available)
- Vercel account (free tier available)

---

## Step 1: Set Up Supabase Database

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name:** `capacity-planner`
   - **Database Password:** (save this securely!)
   - **Region:** Choose closest to your users (e.g., West Europe)
4. Click **"Create new project"**
5. Wait for the project to be ready (~2 minutes)

### 1.2 Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the contents of `supabase/schema.sql` and paste it
4. Click **"Run"**
5. Verify tables were created in **Table Editor**

### 1.3 Get Your API Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### 1.4 Configure Row Level Security (Optional)

For production use, you may want to:
1. Go to **Authentication** → **Providers**
2. Enable your preferred auth method (Email, Google, Azure AD)
3. Update RLS policies in `supabase/schema.sql` if needed

---

## Step 2: Set Up GitHub Repository

### 2.1 Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Fill in:
   - **Repository name:** `capacity-planner`
   - **Visibility:** Private (recommended)
3. Click **"Create repository"**

### 2.2 Push Code to GitHub

Open your terminal in the `capacity-planner-app` folder and run:

```bash
# Configure Git (if not already done)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/capacity-planner.git
git add .
git commit -m "Initial commit: Capacity Planner app"
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel

### 3.1 Import Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Click **"Import"** on your `capacity-planner` repository
4. Configure project:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
5. Click **"Deploy"**

### 3.2 Set Environment Variables

1. After deployment, go to **Settings** → **Environment Variables**
2. Add these variables:
   
   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase anon key |

3. Redeploy for changes to take effect

### 3.3 Update Config in Code

Edit `js/config.js` with your Supabase credentials:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'eyJ...',
    USE_SUPABASE: true,  // Enable Supabase backend
    // ...
};
```

Commit and push the changes:

```bash
git add js/config.js
git commit -m "Configure Supabase credentials"
git push
```

Vercel will automatically redeploy.

---

## Step 4: Migrate Existing Data (Optional)

If you have existing data in localStorage, you can migrate it:

1. Open your app in the browser
2. Open browser DevTools (F12) → Console
3. Run this to export your data:

```javascript
const data = localStorage.getItem('capacity-planner-data');
console.log(data);
// Copy the output
```

4. Use the Excel export feature to backup data
5. After Supabase is configured, re-import using Excel

---

## Step 5: Custom Domain (Optional)

### Add Your Domain in Vercel

1. Go to your project in Vercel
2. Click **Settings** → **Domains**
3. Enter your domain (e.g., `capacity.mileway.com`)
4. Follow the DNS configuration instructions

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Vercel    │────▶│  Supabase   │
│  (Frontend) │     │  (Hosting)  │     │  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   GitHub    │
                    │    (CI/CD)  │
                    └─────────────┘
```

- **Vercel**: Hosts the static frontend files
- **Supabase**: PostgreSQL database with REST API
- **GitHub**: Version control and automatic deployments

---

## Costs (Free Tier)

| Service | Free Tier Limits |
|---------|------------------|
| **Supabase** | 500 MB database, 2 GB bandwidth/month, 50,000 monthly active users |
| **Vercel** | 100 GB bandwidth/month, unlimited static deployments |
| **GitHub** | Unlimited private repos, 2000 Actions minutes/month |

For a team of ~10 users, these free tiers should be more than sufficient.

---

## Troubleshooting

### Common Issues

**"Supabase not connecting"**
- Check that `USE_SUPABASE` is set to `true` in `config.js`
- Verify URL and key are correct
- Check browser console for errors

**"Data not saving"**
- Ensure RLS policies allow insert/update
- Check Supabase logs in dashboard

**"Deployment failed"**
- Check Vercel deployment logs
- Ensure all files are committed to Git

### Support

For issues, check:
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [GitHub Docs](https://docs.github.com)

---

## Next Steps

After deployment:

1. ✅ Test the application at your Vercel URL
2. ✅ Import your existing data via Excel
3. ✅ Share the URL with your team
4. ✅ Consider enabling authentication for security
5. ✅ Set up database backups in Supabase (Settings → Database → Backups)
