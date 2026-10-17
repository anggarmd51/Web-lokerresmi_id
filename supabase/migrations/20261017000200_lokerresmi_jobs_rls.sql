-- Modul 2/3: jalankan setelah 20261017000100. Hanya public.jobs.
BEGIN;

DO $$
DECLARE item record; seq_name text;
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    RAISE EXCEPTION 'Target tidak cocok: public.jobs tidak ditemukan';
  END IF;
  IF to_regprocedure('public.is_lokerresmi_admin()') IS NULL THEN
    RAISE EXCEPTION 'Jalankan modul admin predicate terlebih dahulu';
  END IF;
  -- Policy permissive digabung OR: nama policy lama tidak boleh diasumsikan.
  FOR item IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.jobs', item.policyname);
  END LOOP;
  -- REVOKE tingkat tabel tidak menghapus grant tingkat kolom.
  FOR item IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.jobs'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.jobs FROM PUBLIC, anon, authenticated', item.attname);
  END LOOP;
  seq_name := pg_get_serial_sequence('public.jobs', 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq_name);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', seq_name);
  END IF;
END;
$$;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.jobs TO authenticated;

CREATE POLICY lokerresmi_jobs_public_read ON public.jobs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lokerresmi_jobs_admin_insert ON public.jobs
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_jobs_admin_update ON public.jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_lokerresmi_admin()))
  WITH CHECK ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_jobs_admin_delete ON public.jobs
  FOR DELETE TO authenticated USING ((SELECT public.is_lokerresmi_admin()));

COMMIT;
