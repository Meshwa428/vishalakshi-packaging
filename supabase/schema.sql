-- ============================================================
-- Vishalakshi Packaging — Supabase Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at  timestamptz DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'operator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 2. Stock Entries (header)
CREATE TABLE IF NOT EXISTS stock_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text UNIQUE NOT NULL,
  date             date NOT NULL,
  truck_number     text,
  party_name       text NOT NULL,
  shipped_from     text,
  delivery_address text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON stock_entries;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON stock_entries
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- 3. Stock Entry Items (reel line items)
CREATE TABLE IF NOT EXISTS stock_entry_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_entry_id  uuid NOT NULL REFERENCES stock_entries(id) ON DELETE CASCADE,
  reel_no         text UNIQUE NOT NULL,
  size            text,
  type            text,
  gsm             text,
  bf              text,
  quality         text,
  weight          numeric(10, 2),
  created_at      timestamptz DEFAULT now()
);

-- 4. App Settings (admin-managed dropdown lists)
CREATE TABLE IF NOT EXISTS app_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key    text UNIQUE NOT NULL,
  setting_values jsonb NOT NULL DEFAULT '[]',
  updated_by     uuid REFERENCES profiles(id),
  updated_at     timestamptz DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own row
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Stock Entries: all authenticated users can SELECT
CREATE POLICY "entries_select" ON stock_entries FOR SELECT USING (auth.role() = 'authenticated');
-- All authenticated users can INSERT (operator + admin)
CREATE POLICY "entries_insert" ON stock_entries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only admin can UPDATE/DELETE
CREATE POLICY "entries_update_admin" ON stock_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "entries_delete_admin" ON stock_entries FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Stock Entry Items: same permissions as parent
CREATE POLICY "items_select" ON stock_entry_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "items_insert" ON stock_entry_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "items_update_admin" ON stock_entry_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "items_delete_admin" ON stock_entry_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- App Settings: admin full access, operator SELECT only
CREATE POLICY "settings_select" ON app_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "settings_insert_admin" ON app_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "settings_delete_admin" ON app_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- Seed default app_settings
-- ============================================================

INSERT INTO app_settings (setting_key, setting_values) VALUES
  ('type_options',    '["Kraft","Duplex","Corrugated","White Back","Brown"]'),
  ('gsm_options',     '["80","90","100","120","150","180","200","250"]'),
  ('bf_options',      '["14","16","18","20","22","24","26"]'),
  ('quality_options', '["Natural","Golden","Imported","Duplex","Cadbory"]')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- AFTER running this schema:
-- 1. Go to Authentication → Users → Invite user (or Add user)
-- 2. Create 3 users with email/password
-- 3. Then update their profiles:
--    UPDATE profiles SET full_name = 'Admin One', role = 'admin' WHERE id = '<user-uuid>';
--    UPDATE profiles SET full_name = 'Admin Two', role = 'admin' WHERE id = '<user-uuid>';
--    UPDATE profiles SET full_name = 'Operator Name', role = 'operator' WHERE id = '<user-uuid>';
-- ============================================================
