<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Vishalakshi Packaging — Architectural Decisions & Flow Guide

This section records significant architectural decisions, patterns, and flows.
Update after every major change so future debugging sessions have full context.

## Project Overview

**App**: Stock management web app for Vishalakshi Packaging  
**Stack**: Next.js 15 (App Router) · Supabase (PostgreSQL + Auth) · Tailwind CSS + shadcn/ui · Vercel  
**Users**: 2 admins + 1 operator (credentials pre-created in Supabase)

---

## Decision Log

### [2026-05-26] Authentication Strategy
- **Decision**: Supabase Auth with SSR cookie-based sessions via `@supabase/ssr`
- **Why**: First-class Next.js App Router support; server components can read user/session without client round-trips
- **Pattern**: Three Supabase client files:
  - `lib/supabase/client.ts` — browser client for Client Components
  - `lib/supabase/server.ts` — server client for RSC/Server Actions (reads cookies)
  - `lib/supabase/middleware-client.ts` — middleware client for session refresh + route guards
- **Middleware**: Runs on every request. Refreshes session, redirects unauthenticated to `/login`, redirects authenticated away from `/login`, blocks non-admins from `/settings`

### [2026-05-26] Role-Based Access
- **Roles**: `admin` | `operator` (stored in `profiles.role`)
- **Operator**: Create entries, view entries, view reports. No edit, no settings.
- **Admin**: Everything + edit/delete entries + manage enum settings
- **Edit mode**: `?edit=true` query param on detail page triggers edit form (admin only)

### [2026-05-26] Database Schema Design
- **`profiles`**: Extends `auth.users` via DB trigger. Stores full_name and role.
- **`stock_entries`**: Header. `invoice_number` UNIQUE.
- **`stock_entry_items`**: Line items. `reel_no` UNIQUE across entire system (each physical reel = one SKU).
- **`app_settings`**: Admin-managed dropdown option lists. `setting_values` is JSONB string array.
- **RLS**: All tables. Operator INSERT+SELECT; admin full CRUD. Enforced at DB layer.

### [2026-05-26] Settings / Enum Management
- **Pattern**: `app_settings` rows upserted on conflict. Admin adds/removes options instantly.
- **Fallback**: Hardcoded defaults if DB has no row for a key — prevents blank dropdowns on fresh deploy.

### [2026-05-26] Backup / Cron System
- **Triggers**: Vercel Cron → `/api/cron/daily-backup` at 23:30 UTC; `/api/cron/monthly-backup` at 00:00 UTC on the 30th
- **Security**: `CRON_SECRET` env var, sent by Vercel as `Authorization: Bearer` header
- **Data access**: Service role key (bypasses RLS) — server-only
- **Email**: Resend API with SheetJS `.xlsx` attachment to `BACKUP_EMAIL` env
- **Keep-alive bonus**: Daily cron prevents Supabase free-tier from pausing due to inactivity

### [2026-05-26] Logging System
- **Gate**: `ENABLE_DEBUG_LOGS=true` enables logs. Default `false` (silent in production).
- **File**: `lib/logger.ts` — levels: info, warn, error, debug
- **Coverage**: Auth, page loads, form submit, DB errors, cron, email sends

---

## Key File Map

| File | Purpose |
|---|---|
| `middleware.ts` | Session refresh + route protection entry point |
| `lib/supabase/middleware-client.ts` | Route guard logic (auth + role checks) |
| `lib/supabase/server.ts` | Server-side Supabase client + service role client |
| `lib/logger.ts` | Gated debug logger |
| `lib/excel.ts` | SheetJS workbook builders |
| `lib/email.ts` | Resend email sender |
| `supabase/schema.sql` | Full DB schema with RLS + seed data |
| `vercel.json` | Cron schedules |
| `.env.local.example` | All required env vars |
| `components/stock-entry/EntryForm.tsx` | Core create/edit form |
| `components/settings/EnumManager.tsx` | Admin dropdown option manager |
| `components/reports/ReportTable.tsx` | Monthly reel-wise report + export |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only, bypasses RLS) |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `BACKUP_EMAIL` | Yes | Backup Excel delivery address |
| `CRON_SECRET` | Yes | Cron endpoint security token |
| `ENABLE_DEBUG_LOGS` | No | `true` = verbose logs |

---

## Next.js 16 Breaking Changes (discovered during build)

- **`proxy.ts` instead of `middleware.ts`**: Next.js 16 deprecated the middleware convention. File is `proxy.ts` and must export `proxy` function (not `middleware`).
- **Base UI in shadcn**: `@base-ui/react` replaces Radix UI. No `asChild` prop on Button. Use `Link` with `buttonVariants()` for link-style buttons. Use `render={<Component />}` on primitive triggers.
- **Resend lazy init required**: Must not instantiate `new Resend(key)` at module level — crashes build when env var absent. Use lazy getter pattern.
