# Supabase Setup — Run Order

Go to: **Supabase Dashboard → SQL Editor → New query**

## Fresh project

### 1. `01_schema.sql`
Creates every table the app uses (Stock In + Stock Out), triggers (profile
auto-create, `updated_at`, cross-table invoice uniqueness), RLS policies and
default dropdown options. Run as-is. Safe to re-run — it also upgrades a
database created from an older version of this file.

### 2. Create the 3 users
**Authentication → Users → Add user → Create new user** (tick "Auto Confirm User").
Each user automatically gets a `profiles` row with `role = 'operator'`.
Then promote the two admins:

```sql
UPDATE public.profiles SET full_name = 'Admin One', role = 'admin'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'admin1@example.com');
```

### 3. Disable public sign-ups
**Authentication → Sign In / Providers → "Allow new users to sign up" → off.**
Users are pre-created; with sign-ups on, anyone could register as an operator.

## Other scripts

- `02_users_setup.sql` — inserts test users straight into `auth.users` with
  placeholder credentials. For local/dev only; prefer step 2 above.
- `03_stock_out_simplify.sql` — only needed for databases created from the old
  `01_schema.sql`; its changes are already included in the current one.

---

## .env.local values (Dashboard → Project Settings → API Keys)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxx
```
