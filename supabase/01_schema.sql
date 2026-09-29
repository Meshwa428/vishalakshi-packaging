-- ============================================================
-- Vishalakshi Packaging — Supabase Schema (complete, current)
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
--
-- Creates every table the app uses (Stock In + Stock Out), triggers,
-- RLS policies and default dropdown options. Safe to re-run.
-- 03_stock_out_simplify.sql is already folded in here; it only needs to be
-- run on databases created from the older version of this file.
-- ============================================================

-- ============================================================
-- 1. Profiles (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at  timestamptz DEFAULT now()
);

-- Auto-create a profile (role = operator) when an auth user is created.
-- SECURITY DEFINER is required: the trigger fires as the auth service role,
-- which has no rights on public.profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'operator');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin check used by RLS policies. Lives in a non-exposed schema so it is
-- not callable through the Data API.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

-- ============================================================
-- 2. Stock In — header + reel line items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text UNIQUE NOT NULL,
  date             date NOT NULL,
  truck_number     text,
  party_name       text NOT NULL,
  shipped_from     text,
  delivery_address text,
  status           text NOT NULL DEFAULT 'done' CHECK (status IN ('draft', 'done')),
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Each physical reel enters the system exactly once → reel_no UNIQUE.
CREATE TABLE IF NOT EXISTS public.stock_entry_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_entry_id  uuid NOT NULL REFERENCES public.stock_entries(id) ON DELETE CASCADE,
  reel_no         text UNIQUE NOT NULL,
  size            text,
  type            text,
  gsm             text,
  bf              text,
  quality         text,
  weight          numeric(10, 2),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Stock Out — header + consumed reels
-- Header only needs a date; invoice is auto-generated (SO-0001…).
-- Legacy header fields kept nullable for older rows.
-- reel_no references Stock In by text key (not FK) and may repeat.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_out_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text UNIQUE NOT NULL,
  date             date NOT NULL,
  truck_number     text,
  party_name       text,
  shipped_from     text,
  delivery_address text,
  status           text NOT NULL DEFAULT 'done' CHECK (status IN ('draft', 'done')),
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_out_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_out_entry_id  uuid NOT NULL REFERENCES public.stock_out_entries(id) ON DELETE CASCADE,
  reel_no             text NOT NULL,
  gsm                 text,
  size                text,
  type                text,
  bf                  text,
  quality             text,
  weight              numeric(10, 2),
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 4. App Settings (admin-managed dropdown lists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key    text UNIQUE NOT NULL,
  setting_values jsonb NOT NULL DEFAULT '[]',
  updated_by     uuid REFERENCES public.profiles(id),
  updated_at     timestamptz DEFAULT now()
);

-- ============================================================
-- 5. Indexes (foreign keys + hot query paths)
-- ============================================================
CREATE INDEX IF NOT EXISTS stock_entries_date_idx           ON public.stock_entries (date);
CREATE INDEX IF NOT EXISTS stock_entries_created_by_idx     ON public.stock_entries (created_by);
CREATE INDEX IF NOT EXISTS stock_entry_items_entry_idx      ON public.stock_entry_items (stock_entry_id);
CREATE INDEX IF NOT EXISTS stock_entry_items_gsm_idx        ON public.stock_entry_items (gsm);   -- Stock Out reel picker
CREATE INDEX IF NOT EXISTS stock_out_entries_date_idx       ON public.stock_out_entries (date);
CREATE INDEX IF NOT EXISTS stock_out_entries_created_by_idx ON public.stock_out_entries (created_by);
CREATE INDEX IF NOT EXISTS stock_out_items_entry_idx        ON public.stock_out_items (stock_out_entry_id);
CREATE INDEX IF NOT EXISTS stock_out_items_reel_no_idx      ON public.stock_out_items (reel_no); -- Stock Report join
CREATE INDEX IF NOT EXISTS app_settings_updated_by_idx      ON public.app_settings (updated_by);

-- ============================================================
-- 6. Triggers
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.stock_entries;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_stock_out_entries_updated_at ON public.stock_out_entries; -- legacy duplicate
DROP TRIGGER IF EXISTS set_updated_at ON public.stock_out_entries;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.stock_out_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Invoice numbers must be unique ACROSS Stock In and Stock Out.
-- Raises 23505 (unique_violation) so the app's existing duplicate handling
-- applies. Skips the check on UPDATE when the invoice number is unchanged.
CREATE OR REPLACE FUNCTION public.check_invoice_number_global_unique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.invoice_number = OLD.invoice_number THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'stock_entries' THEN
    IF EXISTS (SELECT 1 FROM public.stock_out_entries WHERE invoice_number = NEW.invoice_number) THEN
      RAISE EXCEPTION 'Invoice number "%" already exists in Stock Out', NEW.invoice_number
        USING ERRCODE = '23505';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.stock_entries WHERE invoice_number = NEW.invoice_number) THEN
      RAISE EXCEPTION 'Invoice number "%" already exists in Stock In', NEW.invoice_number
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_unique_stock_entries ON public.stock_entries;
CREATE TRIGGER trg_invoice_unique_stock_entries
  BEFORE INSERT OR UPDATE ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_number_global_unique();

DROP TRIGGER IF EXISTS trg_invoice_unique_stock_out_entries ON public.stock_out_entries;
CREATE TRIGGER trg_invoice_unique_stock_out_entries
  BEFORE INSERT OR UPDATE ON public.stock_out_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_invoice_number_global_unique();

-- Trigger functions are never called directly — keep them off the Data API.
-- (EXECUTE is only checked at CREATE TRIGGER time, so triggers still fire.)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_invoice_number_global_unique()  FROM PUBLIC, anon, authenticated;

REVOKE ALL     ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT  USAGE   ON SCHEMA private             TO authenticated;
GRANT  EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- ============================================================
-- 7. Table privileges
-- Only signed-in users touch these tables; anon gets nothing.
-- profiles is read-only through the API (roles are changed via SQL only).
-- ============================================================
REVOKE ALL ON public.profiles, public.stock_entries, public.stock_entry_items,
              public.stock_out_entries, public.stock_out_items, public.app_settings
  FROM anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.stock_entries, public.stock_entry_items,
     public.stock_out_entries, public.stock_out_items, public.app_settings
  TO authenticated;
GRANT ALL ON public.profiles, public.stock_entries, public.stock_entry_items,
             public.stock_out_entries, public.stock_out_items, public.app_settings
  TO service_role;

-- ============================================================
-- 8. Row Level Security
-- Operator: SELECT + INSERT (own entries).  Admin: full CRUD.
-- ============================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_out_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_out_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings      ENABLE ROW LEVEL SECURITY;

-- Profiles: every signed-in user can read names/roles (entry "Created By").
-- No UPDATE policy — otherwise a user could promote themselves to admin.
DROP POLICY IF EXISTS "profiles_select_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"      ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Stock In header
DROP POLICY IF EXISTS "entries_select"       ON public.stock_entries;
DROP POLICY IF EXISTS "entries_insert"       ON public.stock_entries;
DROP POLICY IF EXISTS "entries_update_admin" ON public.stock_entries;
DROP POLICY IF EXISTS "entries_delete_admin" ON public.stock_entries;
CREATE POLICY "entries_select" ON public.stock_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "entries_insert" ON public.stock_entries FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "entries_update_admin" ON public.stock_entries FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "entries_delete_admin" ON public.stock_entries FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- Stock In items: insert only into your own entry (or any entry, if admin)
DROP POLICY IF EXISTS "items_select"       ON public.stock_entry_items;
DROP POLICY IF EXISTS "items_insert"       ON public.stock_entry_items;
DROP POLICY IF EXISTS "items_update_admin" ON public.stock_entry_items;
DROP POLICY IF EXISTS "items_delete_admin" ON public.stock_entry_items;
CREATE POLICY "items_select" ON public.stock_entry_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_insert" ON public.stock_entry_items FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_admin())
    OR EXISTS (SELECT 1 FROM public.stock_entries e
               WHERE e.id = stock_entry_id AND e.created_by = (SELECT auth.uid()))
  );
CREATE POLICY "items_update_admin" ON public.stock_entry_items FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "items_delete_admin" ON public.stock_entry_items FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- Stock Out: drop policies created ad hoc during early development
DROP POLICY IF EXISTS "All authenticated users can view stock_out_entries"   ON public.stock_out_entries;
DROP POLICY IF EXISTS "All authenticated users can insert stock_out_entries" ON public.stock_out_entries;
DROP POLICY IF EXISTS "Admins can update stock_out_entries"                  ON public.stock_out_entries;
DROP POLICY IF EXISTS "Admins can delete stock_out_entries"                  ON public.stock_out_entries;
DROP POLICY IF EXISTS "All authenticated users can view stock_out_items"     ON public.stock_out_items;
DROP POLICY IF EXISTS "All authenticated users can insert stock_out_items"   ON public.stock_out_items;
DROP POLICY IF EXISTS "Admins can update stock_out_items"                    ON public.stock_out_items;
DROP POLICY IF EXISTS "Admins can delete stock_out_items"                    ON public.stock_out_items;

-- Stock Out header
DROP POLICY IF EXISTS "out_entries_select"       ON public.stock_out_entries;
DROP POLICY IF EXISTS "out_entries_insert"       ON public.stock_out_entries;
DROP POLICY IF EXISTS "out_entries_update_admin" ON public.stock_out_entries;
DROP POLICY IF EXISTS "out_entries_delete_admin" ON public.stock_out_entries;
CREATE POLICY "out_entries_select" ON public.stock_out_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "out_entries_insert" ON public.stock_out_entries FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY "out_entries_update_admin" ON public.stock_out_entries FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "out_entries_delete_admin" ON public.stock_out_entries FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- Stock Out items
DROP POLICY IF EXISTS "out_items_select"       ON public.stock_out_items;
DROP POLICY IF EXISTS "out_items_insert"       ON public.stock_out_items;
DROP POLICY IF EXISTS "out_items_update_admin" ON public.stock_out_items;
DROP POLICY IF EXISTS "out_items_delete_admin" ON public.stock_out_items;
CREATE POLICY "out_items_select" ON public.stock_out_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "out_items_insert" ON public.stock_out_items FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_admin())
    OR EXISTS (SELECT 1 FROM public.stock_out_entries e
               WHERE e.id = stock_out_entry_id AND e.created_by = (SELECT auth.uid()))
  );
CREATE POLICY "out_items_update_admin" ON public.stock_out_items FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "out_items_delete_admin" ON public.stock_out_items FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- App Settings: everyone reads, admin writes (upsert needs INSERT + UPDATE)
DROP POLICY IF EXISTS "settings_select"       ON public.app_settings;
DROP POLICY IF EXISTS "settings_insert_admin" ON public.app_settings;
DROP POLICY IF EXISTS "settings_update_admin" ON public.app_settings;
DROP POLICY IF EXISTS "settings_delete_admin" ON public.app_settings;
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_insert_admin" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "settings_update_admin" ON public.app_settings FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "settings_delete_admin" ON public.app_settings FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- ============================================================
-- 9. Seed default app_settings
-- ============================================================
INSERT INTO public.app_settings (setting_key, setting_values) VALUES
  ('type_options',     '["Kraft","Duplex","Corrugated","White Back","Brown"]'),
  ('gsm_options',      '["80","90","100","120","150","180","200","250"]'),
  ('bf_options',       '["14","16","18","20","22","24","26"]'),
  ('quality_options',  '["Natural","Golden","Imported","Duplex","Cadbory"]'),
  ('supplier_options', '[]')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- AFTER running this schema, create the 3 users:
-- Authentication → Users → Add user → "Create new user"
-- (tick "Auto Confirm User"). Each gets a profile with role = operator.
-- Then promote the admins:
--    UPDATE public.profiles SET full_name = 'Admin One', role = 'admin'
--      WHERE id = (SELECT id FROM auth.users WHERE email = 'admin1@example.com');
-- ============================================================
