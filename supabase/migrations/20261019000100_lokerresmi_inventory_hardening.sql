-- LokerResmi.id Phase 2 inventory hardening.
-- Reviewed and explicitly authorized for production hardening on 2026-10-19.
-- The migration deliberately does not alter existing requirements JSONB/text[] data.
BEGIN;

DO $$
DECLARE
  item record;
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    RAISE EXCEPTION 'Target tidak cocok: public.jobs tidak ditemukan';
  END IF;
  IF to_regclass('public.site_stats') IS NULL THEN
    RAISE EXCEPTION 'Target tidak cocok: public.site_stats tidak ditemukan';
  END IF;
  IF to_regprocedure('public.is_lokerresmi_admin()') IS NULL THEN
    RAISE EXCEPTION 'Jalankan migration admin predicate terlebih dahulu';
  END IF;

  -- Remove every legacy jobs policy so permissive policies cannot be OR-ed in.
  FOR item IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.jobs', item.policyname);
  END LOOP;

  -- Remove every legacy site_stats policy and all API-facing grants first.
  FOR item IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_stats'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.site_stats', item.policyname);
  END LOOP;

  FOR item IN
    SELECT attname FROM pg_attribute
    WHERE attrelid IN ('public.jobs'::regclass, 'public.site_stats'::regclass)
      AND attnum > 0 AND NOT attisdropped
  LOOP
    IF item.attname IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = 'public.jobs'::regclass
          AND a.attname = item.attname AND a.attnum > 0 AND NOT a.attisdropped
      ) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.jobs FROM PUBLIC, anon, authenticated', item.attname);
      END IF;
      IF EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = 'public.site_stats'::regclass
          AND a.attname = item.attname AND a.attnum > 0 AND NOT a.attisdropped
      ) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.site_stats FROM PUBLIC, anon, authenticated', item.attname);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Future factual metadata only; existing rows remain NULL and unconstrained.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS valid_through timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS date_posted date;

-- Stable feed/filter access paths; no data rewrite or type conversion.
CREATE INDEX IF NOT EXISTS lokerresmi_jobs_status_featured_created_id_idx
  ON public.jobs (status, featured DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS lokerresmi_jobs_category_lower_idx
  ON public.jobs (lower(category));
CREATE INDEX IF NOT EXISTS lokerresmi_jobs_location_lower_idx
  ON public.jobs (lower(location));

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.jobs TO authenticated;
CREATE POLICY lokerresmi_jobs_public_read
  ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (status = 'Aktif' OR (SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_jobs_admin_insert
  ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_jobs_admin_update
  ON public.jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_lokerresmi_admin()))
  WITH CHECK ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_jobs_admin_delete
  ON public.jobs
  FOR DELETE TO authenticated
  USING ((SELECT public.is_lokerresmi_admin()));

-- site_stats is read-only through the table API. Writes go only through the RPC.
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.site_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.site_stats TO anon, authenticated;
CREATE POLICY lokerresmi_site_stats_public_read
  ON public.site_stats
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.increment_site_views()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_views bigint;
BEGIN
  INSERT INTO public.site_stats (id, total_views, updated_at)
  VALUES (1, 1, now())
  ON CONFLICT (id) DO UPDATE
    SET total_views = public.site_stats.total_views + 1,
        updated_at = now()
  RETURNING total_views::bigint INTO new_views;

  RETURN new_views;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_site_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_site_views() TO anon, authenticated;

COMMIT;
