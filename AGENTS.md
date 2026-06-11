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

### [2026-06-11] Stock Out — Date-only header + Auto-generated invoice
- **Decision**: Stock Out no longer collects Truck/Party/Shipped From/Delivery Address. The operator enters **only the Date**; reel details come from the selected Stock In reel; the invoice number is **auto-generated**. Applies to everyone (admin + operator).
- **Why**: Those header fields were already captured at Stock In time — re-entering them on Stock Out was redundant.
- **Invoice format**: `SO-0001` (zero-padded, sequential). Generated in `StockOutForm` via `generateStockOutInvoice()` — reads the current max `SO-####` and increments. The `SO-` prefix keeps it globally unique vs. Stock In invoice numbers (plain digits), so it never collides under the cross-table uniqueness trigger. Insert retries up to 5× on a 23505 collision.
- **DB**: `stock_out_entries.party_name` made nullable (`supabase/03_stock_out_simplify.sql`). New Stock Out rows insert `party_name = null`. Detail page shows the legacy Party/Truck/etc cards **only if present** (old rows keep their data). `EntryList` guards null party names.
- **Edit mode**: Only Date + reel list are editable; existing invoice number and any legacy header fields are preserved untouched (the update payload no longer writes them).

### [2026-06-11] Party Name autocomplete (Stock In) + Suppliers setting
- **Decision**: The Stock In Party Name field is now an autocomplete. Suggestions come from **both** (a) an admin-managed `supplier_options` list in Settings, and (b) distinct party names already used in past entries (auto-remembered).
- **Implementation**: Native `<datalist>` on the existing `<Input>` (free-text still allowed; no new dependency, works on mobile). `hooks/usePartySuggestions.ts` merges `settings.supplier_options` with distinct DB party names (de-duped case-insensitively, sorted). New `supplier_options` key added to `AppSettings`, `useSettings` defaults, the Settings page, and seeded (back-filled from existing party names) in `03_stock_out_simplify.sql`. The generic `EnumManager` renders the Suppliers card with no code changes.

### [2026-06-11] Performance — local JWT verification + client caches
- **Problem**: Navigation randomly hung on loading states and buttons felt unresponsive. Root cause: `supabase.auth.getUser()` runs in the proxy on **every** navigation, making a **network round-trip to Supabase Auth** (slow/cold on free tier). The same network call repeated in the layout and `ProfileProvider`.
- **Fix**:
  - Replaced `getUser()` with `getClaims()` in `middleware-client.ts`, `(dashboard)/layout.tsx`, `ProfileProvider`, and the form/settings submit paths. `getClaims()` verifies the JWT **locally** (no network) when the project uses asymmetric JWT signing keys. **To get the full benefit, enable asymmetric (ECC) JWT signing keys in the Supabase dashboard** (Project Settings → JWT Keys / Signing Keys). Without it, `getClaims()` falls back to a network call — no worse than before.
  - Browser Supabase client is now a **singleton** (`lib/supabase/client.ts`) — avoids duplicate auth listeners / refresh timers per page.
  - Stale-while-revalidate **module caches** for `useSettings`, `usePartySuggestions`, `ProfileProvider`, and the stock-entries list page — render last-known data instantly, refresh in the background instead of showing a skeleton on every visit. Caches are module-level (cleared on full reload), which is the right scope for this 3-user app.

### [2026-06-11] Stock Out reel picker — searchable server-side combobox
- **Problem**: The reel-number selector was a `<Select>` that pre-fetched **every** reel for the chosen GSM. Doesn't scale (imagine 1M reels) and there was no way to type-search.
- **Fix**: New `components/stock-entry/ReelCombobox.tsx` — a Base UI `Combobox` (`@base-ui/react/combobox`) with `filter={null}` so filtering is **server-side**. As the user types it queries `stock_entry_items` scoped to the selected GSM, `ilike '%query%'`, `limit(50)`, debounced 250ms, with a request-id guard against out-of-order responses. Picking a reel returns the full row so the form auto-fills size/type/bf/quality/weight (unchanged behavior).
- **StockOutItemRow**: dropped the prefetch `useEffect` + `reelOptions` state. GSM-change now only clears the dependent fields — and skips the first mount (via a `prevGsm` ref) so prefilled edit values survive. Both desktop and mobile use `<ReelCombobox>`; the hidden registered `reel_no` input is retained for RHF.

### [2026-06-11] Reel-row animations removed
- The framer-motion enter/exit/layout animations on reel rows (`ItemRow`, `StockOutItemRow`) and their `AnimatePresence` wrappers in both forms were removed per request — adding/removing rows is now instant. `EntryList` animations are unchanged.

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
| `components/stock-entry/StockOutItemRow.tsx` | Stock Out item row (GSM → searchable Reel combobox + auto-fill) |
| `components/stock-entry/ReelCombobox.tsx` | Searchable, server-side reel-number picker (debounced, GSM-scoped) |
| `components/settings/EnumManager.tsx` | Admin dropdown option manager |
| `components/reports/StockReport.tsx` | Reel-wise stock report table + Excel download |
| `components/reports/DateRangeSelector.tsx` | From/To date inputs + Generate button |
| `components/shared/ProfileProvider.tsx` | React context — fetches profile once (cached), shared app-wide |
| `hooks/usePartySuggestions.ts` | Party/supplier autocomplete source (suppliers setting + past entries, cached) |
| `hooks/useSettings.ts` | Loads admin dropdown lists (cached, stale-while-revalidate) |
| `supabase/03_stock_out_simplify.sql` | Migration: party_name nullable + seed supplier_options |
| `lib/supabase/client.ts` | Singleton browser Supabase client |

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
