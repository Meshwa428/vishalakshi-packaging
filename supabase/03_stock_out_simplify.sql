-- ============================================================
-- Vishalakshi Packaging — Stock Out simplification + Suppliers list
-- Run this in Supabase SQL Editor AFTER 01_schema.sql
-- ============================================================

-- 1. Stock Out now collects only the date manually. Party name (and the other
--    header fields) are no longer captured, so allow NULL.
ALTER TABLE stock_out_entries ALTER COLUMN party_name DROP NOT NULL;

-- 2. Suppliers list — admin-managed party/supplier names shown as suggestions
--    in the Stock In form. Seeded by backfilling every distinct party name
--    already used across existing entries (so nothing is lost).
INSERT INTO app_settings (setting_key, setting_values)
VALUES (
  'supplier_options',
  COALESCE(
    (
      SELECT to_jsonb(array_agg(DISTINCT name ORDER BY name))
      FROM (
        SELECT trim(party_name) AS name FROM stock_entries
        WHERE party_name IS NOT NULL AND trim(party_name) <> ''
        UNION
        SELECT trim(party_name) AS name FROM stock_out_entries
        WHERE party_name IS NOT NULL AND trim(party_name) <> ''
      ) s
    ),
    '[]'::jsonb
  )
)
ON CONFLICT (setting_key) DO NOTHING;
