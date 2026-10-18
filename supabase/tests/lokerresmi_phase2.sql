-- LokerResmi.id Phase 2 tests.
-- Run only after the local fixture and migration; never point this at production.
-- Every fixture row and RPC increment is rolled back at the end.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() <> 'local_lokerresmi_rls_test' THEN
    RAISE EXCEPTION 'Tes ini hanya boleh di database lokal khusus';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Role fixture anon/authenticated tidak ditemukan';
  END IF;
END $$;

BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'GAGAL: %', label; END IF;
  RAISE NOTICE 'LULUS: %', label;
END $$;
CREATE FUNCTION pg_temp.expect_denied(statement text, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'LULUS ditolak: %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'GAGAL: operasi seharusnya ditolak: %', label;
END $$;

SELECT pg_temp.assert_true(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.jobs'::regclass),
  'jobs RLS aktif');
SELECT pg_temp.assert_true(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.site_stats'::regclass),
  'site_stats RLS aktif');
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.increment_site_views()'::regprocedure
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
  ),
  'RPC SECURITY DEFINER memakai search_path kosong');

-- Fixture identifiers are unique and all changes are protected by the final ROLLBACK.
INSERT INTO public.jobs (title, company, status, featured, created_at)
VALUES ('__phase2_active_fixture__', '__phase2__', 'Aktif', false, now())
RETURNING id \gset phase2_active_
INSERT INTO public.jobs (title, company, status, featured, created_at)
VALUES ('__phase2_pending_fixture__', '__phase2__', 'Menunggu Persetujuan', false, now())
RETURNING id \gset phase2_pending_
INSERT INTO public.site_stats (id, total_views, updated_at)
VALUES (1, 0, now())
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE anon;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 FROM public.jobs WHERE id = :phase2_active_id),
  'anon membaca jobs Aktif');
SELECT pg_temp.assert_true(
  (SELECT count(*) = 0 FROM public.jobs WHERE id = :phase2_pending_id),
  'anon tidak membaca jobs pending');
SELECT pg_temp.expect_denied('INSERT INTO public.site_stats(id,total_views) VALUES (900001,1)', 'anon tidak insert stats');
SELECT pg_temp.expect_denied('UPDATE public.site_stats SET total_views = total_views + 1 WHERE id = 1', 'anon tidak update stats');
SELECT pg_temp.expect_denied('DELETE FROM public.site_stats WHERE id = 1', 'anon tidak delete stats');
SELECT pg_temp.expect_denied('TRUNCATE public.site_stats', 'anon tidak truncate stats');
SELECT pg_temp.assert_true(public.increment_site_views() >= 1, 'anon dapat memakai RPC increment');

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{}}', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 0 FROM public.jobs WHERE id = :phase2_pending_id),
  'pengguna biasa tidak membaca pending');
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 FROM public.jobs WHERE id = :phase2_active_id),
  'pengguna biasa membaca Aktif');

SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"lokerresmi_admin":true}}', true);
SELECT pg_temp.assert_true(public.is_lokerresmi_admin(), 'claim admin tepercaya diterima');
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1 FROM public.jobs WHERE id = :phase2_pending_id),
  'admin membaca jobs pending');
SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.site_stats', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.site_stats', 'INSERT'),
  'authenticated hanya memiliki SELECT stats');

RESET ROLE;
ROLLBACK;
\echo 'Seluruh pengujian LokerResmi Phase 2 lulus; fixture di-rollback.'
