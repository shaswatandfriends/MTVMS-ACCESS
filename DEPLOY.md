# Deployment Guide — Medefis Parent Control System

This guide deploys the gateway on **Vercel** (Next.js app) + **Supabase** (PostgreSQL database). The optional headless-browser service runs on a separate host (Railway/Render/Fly).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel  (Next.js app — the gateway)                        │
│  • Admin login, employee management, activity log           │
│  • Medefis reverse proxy + OIDC token injection             │
│  • Manual cookie/token paste                                 │
└───────────────┬──────────────────────────┬─────────────────┘
                │                          │ (optional)
        ┌───────▼───────┐          ┌───────▼──────────────────┐
        │  Supabase     │          │  Browser service          │
        │  (PostgreSQL) │          │  (Railway/Render/Fly)     │
        │  • Users      │          │  • Playwright + Chromium   │
        │  • Sessions   │          │  • Automated Medefis login │
        │  • Credentials│          │  • MFA live view           │
        │  • Activity   │          └────────────────────────────┘
        └───────────────┘
```

## Step 1 — Create the Supabase database

1. Go to **https://supabase.com** → New Project
2. Set a database password, choose a region close to your users
3. Once created: **Project Settings → Database → Connection string → URI**
4. Copy the connection string. It looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. Save this as your `DATABASE_URL` — you'll need it for Vercel.

## Step 2 — Push to GitHub

The repo is already initialized. If starting fresh:

```bash
git init
git add .
git commit -m "Medefis Parent Control System"
git branch -M main
git remote add origin https://github.com/shaswatandfriends/MTVMS-ACCESS.git
git push -u origin main
```

## Step 3 — Deploy to Vercel

1. Go to **https://vercel.com** → New Project → import `MTVMS-ACCESS`
2. **Environment Variables** (Project Settings → Environment Variables):
   | Name | Value | Required |
   |------|-------|----------|
   | `DATABASE_URL` | Supabase connection string | **Yes** |
   | `PARENT_SYSTEM_SECRET` | `openssl rand -base64 32` output | **Yes** |
   | `MEDEFIS_BROWSER_URL` | URL of the browser service (Step 5) | No |
3. **Deploy**. Vercel runs `prisma generate` (postinstall) + `next build` automatically.
4. After the first deploy, run the database migration. Either:
   - Locally: `DATABASE_URL="<your-supabase-url>" bun run db:push`
   - Or use Prisma's migrate workflow.

## Step 4 — First run

1. Open your Vercel URL.
2. The first-run setup screen appears → create your admin account.
3. Go to the **Medefis** tab → **Replace Medefis credentials** → enter your Medefis entry URL + username + password.
4. **To establish the session**, use **Paste Medefis session**:
   - Log into Medefis in your own browser
   - Run in the console: `copy(JSON.stringify({localStorage: {...localStorage}, sessionStorage: {...sessionStorage}}))`
   - Paste the blob + the cookie header + the app URL into the gateway
5. Add employees in the **Employees** tab.
6. Employees sign in at the same URL (Employee tab) and see the logged-in Medefis.

## Step 5 (optional) — Deploy the headless-browser service

This enables the **"Log in to Medefis automatically"** button so you don't have to paste cookies manually. It runs Playwright + Chromium, so it **cannot run on Vercel** (serverless). Use one of:

### Railway (recommended — easiest)
1. Go to **https://railway.app** → New Project → Deploy from GitHub
2. Root directory: `mini-services/medefis-browser`
3. Railway auto-detects the `package.json`. Set:
   - **Start command**: `bun run dev` (or `bun index.ts` for production)
   - **Port**: 3003 (set `PORT=3003` if Railway assigns dynamically — the service hardcodes 3003)
4. Railway installs Playwright. Chromium binaries download automatically on `bun install`.
5. After deploy, copy the Railway URL (e.g. `https://medefis-browser.up.railway.app`).
6. Set `MEDEFIS_BROWSER_URL=https://medefis-browser.up.railway.app` on Vercel.

### Render
1. New → Web Service → connect repo, root `mini-services/medefis-browser`
2. Build: `bun install`, Start: `bun index.ts`
3. May need to install Chromium system deps in a Dockerfile.

### Fly.io / VPS
Use the Dockerfile approach (install Chromium deps, run `bun index.ts`).

## Important — Incapsula / IP considerations

Medefis sits behind Imperva (Incapsula), which **blocks datacenter IPs**. Vercel, Railway, and most cloud hosts use datacenter IPs. If your gateway server's IP is blocked:

- **Best option**: ask AMN Healthcare / Medefis to **whitelist your gateway server's IP** in their Incapsula config.
- **Alternative**: run the gateway on your **own office server** (residential/business IP that Incapsula accepts — the same network where your browser can already open Medefis).

The manual cookie/token paste (Step 4) captures the session from *your* browser's IP. The proxy then needs to fetch Medefis from the gateway server's IP. If those IPs differ and Incapsula enforces IP binding, employees will see the Incapsula block page. Whitelisting the gateway IP fixes this permanently.

## Environment variables reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Vercel | Supabase PostgreSQL connection string |
| `PARENT_SYSTEM_SECRET` | Vercel | AES-256-GCM encryption key for credentials/tokens |
| `MEDEFIS_BROWSER_URL` | Vercel | URL of the headless-browser service (optional) |
| `PARENT_SYSTEM_SECRET` | Browser service | Same value (for token decryption if shared) |

## Local development

```bash
bun install
bun run db:push          # create tables
bun run dev              # Next.js on :3000

# In another terminal (optional, for automated login):
cd mini-services/medefis-browser
bun install
bun run dev              # browser service on :3003
```
