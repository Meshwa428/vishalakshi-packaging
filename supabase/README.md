# Supabase Setup — Run Order

Go to: **Supabase Dashboard → SQL Editor → New query**

## Run in this exact order:

### 1. `01_schema.sql`
Creates all tables, triggers, RLS policies, and seeds default dropdown options.
Run as-is — no changes needed.

### 2. `02_users_setup.sql`
Creates the 3 users (2 admins + 1 operator) with login credentials.

**Before running — replace all `<<REPLACE_THIS>>` placeholders:**

| Placeholder | Replace with |
|---|---|
| `admin1@<<REPLACE_THIS>>.com` | Real email for Admin 1 |
| `admin2@<<REPLACE_THIS>>.com` | Real email for Admin 2 |
| `operator@<<REPLACE_THIS>>.com` | Real email for Operator |
| `<<REPLACE_PASSWORD_ADMIN1>>` | Password for Admin 1 |
| `<<REPLACE_PASSWORD_ADMIN2>>` | Password for Admin 2 |
| `<<REPLACE_PASSWORD_OPERATOR>>` | Password for Operator |
| `'Admin One'` in full_name | Real name of Admin 1 |
| `'Admin Two'` in full_name | Real name of Admin 2 |
| `'Operator Name'` in full_name | Real name of Operator |

After running, the final SELECT at the bottom shows a summary — confirm all 3 users appear with correct roles.

---

## .env.local values (get from Dashboard → Settings → API)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxx
```
