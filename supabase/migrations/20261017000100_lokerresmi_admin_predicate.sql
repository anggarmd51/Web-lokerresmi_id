-- LokerResmi.id saja. Pastikan project target sebelum menjalankan berkas ini.
-- Prasyarat: Supabase Auth. Bukan profiles/user_metadata/email/localStorage.
-- Claim app_metadata.lokerresmi_admin=true hanya boleh diterbitkan backend tepercaya.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_lokerresmi_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL
    AND (auth.jwt() -> 'app_metadata') @> '{"lokerresmi_admin": true}'::jsonb,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_lokerresmi_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_lokerresmi_admin() TO anon, authenticated;
COMMENT ON FUNCTION public.is_lokerresmi_admin() IS
  'LokerResmi.id: admin dari claim app_metadata tepercaya; bukan semua pengguna login.';

COMMIT;
