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

### [2026-05-26] Stock In / Stock Out Architecture
- **Two separate entry types**: Stock In = receiving reels; Stock Out = consuming/dispatching reels
- **Separate tables**: `stock_entries` + `stock_entry_items` (Stock In); `stock_out_entries` + `stock_out_items` (Stock Out)
- **Why separate tables**: Different item schemas. Stock Out items have GSM-first selection flow (GSM → Reel No dropdown) instead of free-text reel entry. Clean separation of concerns.
- **Reel No is UNIQUE** in `stock_entry_items` — each physical reel enters the system exactly once. Stock Out references reel_no as a text key (not FK) and can reference the same reel multiple times across different consumption invoices.
- **Entry list**: Merges both tables client-side, sorted by date. URL includes `?type=stock_in` or `?type=stock_out` to tell the detail page which table to query.
- **Stock Out item row**: Selecting GSM triggers a live Supabase query to fetch matching reels. Selecting a reel auto-fills Size, Type, BF, Quality (read-only from stock record).
- **Totals row**: Both forms show a live-updating totals tfoot row (count + weight).
- **Draft system**: Both entry types support `status = 'draft' | 'done'`. Draft entries show amber banner; admin sees "Edit & Submit" button.

### [2026-05-26] Stock Report (replaced Monthly Report)
- **Title change**: "Monthly Report" → "Stock Report"
- **Date filter**: Replaced month/year selector with free date range (from → to) + Generate button. Shows a placeholder state before first generate.
- **Report logic**: Queries `stock_entries` by date range, flattens to per-item rows, then cross-references `stock_out_items` by `reel_no` to compute stock out totals.
- **Columns**: Reel No, Date, Invoice No, Party Name, GSM, BF, Type, Quality + Stock In (green +), Stock Out (red −), Balance
- **Totals footer**: Sum of all three weight columns across visible rows.
- **Why client-side join**: Supabase JS client doesn't reliably support filtering/aggregating on embedded tables. Fetching both datasets and merging in JS is simpler and faster for this scale.

### [2026-05-26] Client-Side Navigation (instant page transitions)
- **Problem**: Server components caused visible delay on every tab click (auth check + DB query before render).
- **Fix**: All dashboard pages converted to `"use client"`. Data fetched in `useEffect` after instant shell render.
- **ProfileProvider**: React context at layout level — fetches profile once, shared to all pages and DashboardNav. No per-page profile re-fetch.
- **Skeleton loaders**: Every page shows skeleton while data loads, so no blank flash.
- **Layout is still server**: `(dashboard)/layout.tsx` remains a server component for the initial session cookie check (fast — no DB query). Only the children are client components.

### [2026-05-26] Logging System
- **Gate**: `ENABLE_DEBUG_LOGS=true` enables logs. Default `false` (silent in production).
- **File**: `lib/logger.ts` — levels: info, warn, error, debug
- **Coverage**: Auth, page loads, form submit, DB errors, cron, email sends

### [2026-05-26] Invoice Number Global Uniqueness
- **Problem**: `invoice_number` had a UNIQUE constraint per table, but the same number could exist in both `stock_entries` and `stock_out_entries`.
- **DB fix**: Trigger function `check_invoice_number_global_unique()` on `BEFORE INSERT OR UPDATE` of both tables — checks the OTHER table for the same invoice number. Skips check on UPDATE when the invoice number hasn't changed (no false positives on edits).
- **App fix**: Both `EntryForm` and `StockOutForm` do a cross-table query before submitting. Error shown immediately without touching the DB. Also skips the check on edit when invoice hasn't changed.
- **Triggers**: `trg_invoice_unique_stock_entries` on `stock_entries`; `trg_invoice_unique_stock_out_entries` on `stock_out_entries`.

### [2026-05-26] Pre-Check Pattern for Data Integrity (no orphaned rows)
- **Problem**: Header row inserted first, then items insert fails (e.g. duplicate `reel_no`). Rollback delete was unreliable — RLS blocks operators from DELETE, causing orphaned header rows with 0 items.
- **Fix**: Validate everything that could fail BEFORE any DB write:
  1. Cross-table invoice uniqueness check (see above)
  2. `EntryForm`: queries `stock_entry_items` for all reel numbers in the form before inserting. If any exist in another entry, abort with a clear toast.
  3. Edit mode: only checks reel numbers that are NEW to the entry (not already on the entry being edited) — avoids false positives when re-saving unchanged reels.
- **Rule**: Never insert the header row until all pre-conditions are confirmed clean. The items insert should never fail after the header is in.

### [2026-05-26] New Entry Page — Form State Preservation & Reset
- **Problem**: Switching between Stock In / Stock Out tabs unmounted the inactive form, wiping filled data.
- **Fix**: Both `<EntryForm>` and `<StockOutForm>` are always mounted in `new/page.tsx`. The inactive form gets `className="hidden"` (CSS only — no unmount). React Hook Form state is preserved across tab switches.
- **Reset button**: Sits top-right of the toggle row. Increments `stockInResetKey` or `stockOutResetKey` (separate per tab). Each form accepts a `resetSignal?: number` prop and watches it in a `useEffect` — calls `methods.reset()` to blank values when the signal increments. The two reset keys are independent.

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
| `components/stock-entry/EntryForm.tsx` | Stock In create/edit form (pre-checks invoice + reel uniqueness) |
| `components/stock-entry/StockOutForm.tsx` | Stock Out create/edit form (pre-checks invoice uniqueness) |
| `components/stock-entry/StockOutItemRow.tsx` | Stock Out item row (GSM → Reel dropdown + auto-fill) |
| `components/settings/EnumManager.tsx` | Admin dropdown option manager |
| `components/reports/StockReport.tsx` | Reel-wise stock report table + Excel download |
| `components/reports/DateRangeSelector.tsx` | From/To date inputs + Generate button |
| `components/shared/ProfileProvider.tsx` | React context — fetches profile once, shared app-wide |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key `sb_publishable_...` (replaces legacy anon key — browser-safe) |
| `SUPABASE_SECRET_KEY` | Yes | Secret key `sb_secret_...` (replaces legacy service_role key — server only, bypasses RLS) |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `BACKUP_EMAIL` | Yes | Backup Excel delivery address |
| `CRON_SECRET` | Yes | Cron endpoint security token |
| `ENABLE_DEBUG_LOGS` | No | `true` = verbose logs |

---

## Next.js 16 Breaking Changes (discovered during build)

- **`proxy.ts` instead of `middleware.ts`**: Next.js 16 deprecated the middleware convention. File is `proxy.ts` and must export `proxy` function (not `middleware`).
- **Base UI in shadcn**: `@base-ui/react` replaces Radix UI. No `asChild` prop on Button. Use `Link` with `buttonVariants()` for link-style buttons. Use `render={<Component />}` on primitive triggers.
- **Resend lazy init required**: Must not instantiate `new Resend(key)` at module level — crashes build when env var absent. Use lazy getter pattern.
- **New Supabase key format (2026)**: Use `sb_publishable_...` (env: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) instead of legacy anon key. Use `sb_secret_...` (env: `SUPABASE_SECRET_KEY`) instead of legacy service_role key. Legacy keys retire late 2026. Same `createClient()` API — drop-in replacement.
