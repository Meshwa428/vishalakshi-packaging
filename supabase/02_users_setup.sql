-- ============================================================
-- Vishalakshi Packaging — User Setup SQL
-- Run this in Supabase → SQL Editor AFTER running 01_schema.sql
--
-- BEFORE RUNNING: Replace all placeholder values marked with
-- <<REPLACE_THIS>> with your actual values.
-- ============================================================

-- ============================================================
-- STEP 1 — Create 3 users in Supabase Auth
-- ============================================================
-- This inserts directly into Supabase's internal auth tables.
-- Passwords are hashed using bcrypt via crypt().
-- email_confirmed_at = NOW() means no email confirmation needed.
-- ============================================================

-- Columns: 15 total — values must match exactly
-- instance_id | id | aud | role | email | encrypted_password | email_confirmed_at
-- | raw_app_meta_data | raw_user_meta_data | created_at | updated_at
-- | confirmation_token | email_change | email_change_token_new | recovery_token

-- Admin One
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- instance_id
  gen_random_uuid(),                       -- id
  'authenticated', 'authenticated',        -- aud, role
  'admin1@test.com',                       -- ← change email
  crypt('abcdef', gen_salt('bf')),         -- ← change password
  NOW(),                                   -- email_confirmed_at (1 value, not 2)
  '{"provider":"email","providers":["email"]}', -- raw_app_meta_data
  '{"full_name":"Admin One"}',             -- ← change name if needed
  NOW(), NOW(),                            -- created_at, updated_at
  '', '', '', ''                           -- confirmation_token, email_change, email_change_token_new, recovery_token
);

-- Admin Two
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'admin2@test.com',                       -- ← change email
  crypt('abcdef', gen_salt('bf')),         -- ← change password
  NOW(),                                   -- email_confirmed_at
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Two"}',             -- ← change name if needed
  NOW(), NOW(),
  '', '', '', ''
);

-- Operator
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'operator@test.com',                     -- ← change email
  crypt('123456', gen_salt('bf')),         -- ← change password
  NOW(),                                   -- email_confirmed_at
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Operator Name"}',         -- ← change name if needed
  NOW(), NOW(),
  '', '', '', ''
);

-- ============================================================
-- STEP 2 — Create auth identities (required for email login)
-- ============================================================

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,
  format('{"sub":"%s","email":"%s"}', u.id::text, u.email)::jsonb,
  'email',
  NOW(), NOW(), NOW()
FROM auth.users u
WHERE u.email IN (
  'admin1@test.com',    -- ← same emails as above
  'admin2@test.com',
  'operator@test.com'
);

-- ============================================================
-- STEP 3 — Assign roles in profiles table
-- (The trigger auto-creates profiles with role='operator'.
--  We just need to promote the two admins.)
-- ============================================================

UPDATE profiles SET
  full_name = 'Admin One',          -- ← change to real name
  role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin1@test.com');

UPDATE profiles SET
  full_name = 'Admin Two',          -- ← change to real name
  role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin2@test.com');

UPDATE profiles SET
  full_name = 'Operator Name'       -- ← change to real name
  -- role stays 'operator' (default)
WHERE id = (SELECT id FROM auth.users WHERE email = 'operator@test.com');

-- ============================================================
-- STEP 4 — Verify everything looks correct
-- ============================================================

SELECT
  u.email,
  p.full_name,
  p.role,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email IN (
  'admin1@test.com',
  'admin2@test.com',
  'operator@test.com'
);

-- Expected output:
-- email                        | full_name   | role     | email_confirmed
-- admin1@...                   | Admin One   | admin    | true
-- admin2@...                   | Admin Two   | admin    | true
-- operator@...                 | Operator... | operator | true
