# Vishalakshi Packaging — Stock Management System

A web app for managing stock in/out entries and generating reel-wise stock reports.

---

## What It Does

- **Stock In** — Record incoming reels with invoice details, reel numbers, GSM, type, weight, and more
- **Stock Out** — Record dispatched/consumed reels by selecting GSM and picking from available reel numbers
- **Stock Report** — Generate a date-range report showing each reel's stock in, total consumption, and current balance
- **Settings** — Admin can manage dropdown options (Type, GSM, BF, Quality) used in forms
- **Draft support** — Save any entry as a draft; admin can review and submit later
- **Dark / Light mode** — Fully themed, respects system preference
- **Excel export** — Download any report view as `.xlsx`
- **Automated backups** — Daily and monthly Excel backups emailed automatically via Vercel Cron + Resend

---

## User Roles

| Role | Can Do |
|---|---|
| **Admin** | Create entries · Edit/delete entries · View reports · Manage settings · Submit drafts |
| **Operator** | Create entries · View entries · View reports · Save drafts |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL + Auth) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| Excel | SheetJS (xlsx) |
| Email | Resend |
| Deployment | Vercel |

---

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (full_name, role) — auto-created via trigger on signup |
| `stock_entries` | Stock In entry headers (invoice, date, party, etc.) |
| `stock_entry_items` | Stock In line items — one row per reel. `reel_no` is UNIQUE. |
| `stock_out_entries` | Stock Out entry headers |
| `stock_out_items` | Stock Out line items — references reel_no from stock_entry_items |
| `app_settings` | Admin-managed dropdown option lists (JSONB arrays) |

---

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd vishalakshi-packaging
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/01_schema.sql`
3. Go to **Authentication → Users** and create 3 users manually:
   - Two admins (any email + password)
   - One operator (any email + password)
4. Run the role-assignment SQL from `supabase/02_users_setup.sql` (update emails to match what you created)

### 3. Create `.env.local`

Copy `.env.local.example` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
RESEND_API_KEY=re_...
BACKUP_EMAIL=you@example.com
CRON_SECRET=any-random-secret
ENABLE_DEBUG_LOGS=false
```

Get the Supabase keys from **Dashboard → Settings → API**.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

---

## Deploying to Vercel

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` in Vercel project settings
4. Deploy — `vercel.json` configures the cron jobs automatically

**Important**: Set `CRON_SECRET` in Vercel environment variables. Vercel sends this automatically as `Authorization: Bearer <secret>` to the cron endpoints.

---

## Cron Jobs (Automated Backups)

Configured in `vercel.json`:

| Schedule | Endpoint | What it does |
|---|---|---|
| Daily at 11:30 PM UTC | `/api/cron/daily-backup` | All stock entries → Excel → email to `BACKUP_EMAIL` |
| Monthly on 30th at 12:00 AM UTC | `/api/cron/monthly-backup` | Monthly report → Excel → email to `BACKUP_EMAIL` |

> The daily cron also prevents the Supabase free-tier project from auto-pausing due to inactivity.

---

## Key Pages

| URL | Page |
|---|---|
| `/login` | Login page |
| `/stock-entries` | List of all Stock In + Stock Out entries |
| `/stock-entries/new` | Create new entry (toggle Stock In / Stock Out) |
| `/stock-entries/[id]?type=stock_in` | View / edit a Stock In entry |
| `/stock-entries/[id]?type=stock_out` | View / edit a Stock Out entry |
| `/reports` | Stock Report with date range filter |
| `/settings` | Admin-only: manage dropdown options |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable API key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Yes | Secret API key (`sb_secret_...`) — server-only, bypasses RLS |
| `RESEND_API_KEY` | Yes | API key from resend.com |
| `BACKUP_EMAIL` | Yes | Email address to receive Excel backups |
| `CRON_SECRET` | Yes | Random secret to secure cron endpoints |
| `ENABLE_DEBUG_LOGS` | No | Set to `true` to enable verbose console logs |
