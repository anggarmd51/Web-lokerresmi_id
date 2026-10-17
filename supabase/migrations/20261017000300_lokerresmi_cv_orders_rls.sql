-- Modul 3/3: jalankan setelah modul admin predicate. Tidak ada asumsi user_id.
BEGIN;

DO $$
DECLARE item record; seq_name text; missing_columns text;
BEGIN
  IF to_regclass('public.cv_orders') IS NULL THEN
    RAISE EXCEPTION 'Target tidak cocok: public.cv_orders tidak ditemukan';
  END IF;
  IF to_regprocedure('public.is_lokerresmi_admin()') IS NULL THEN
    RAISE EXCEPTION 'Jalankan modul admin predicate terlebih dahulu';
  END IF;
  SELECT string_agg(required.column_name, ', ') INTO missing_columns
  FROM unnest(ARRAY['id','name','whatsapp','package','status','date']) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'cv_orders'
      AND c.column_name = required.column_name
  );
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Payload aplikasi tidak cocok; kolom hilang: %', missing_columns;
  END IF;
  -- Contoh: client_name boleh ada, tetapi aplikasi tidak mengirimkannya.
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.cv_orders'::regclass AND attnum > 0 AND NOT attisdropped
      AND attnotnull AND NOT atthasdef AND attidentity = '' AND attgenerated = ''
      AND attname <> ALL (ARRAY['name','whatsapp','package','status','date'])
  ) THEN
    RAISE EXCEPTION 'Ada kolom wajib tanpa default di luar payload cv_orders; selaraskan schema dahulu';
  END IF;
  FOR item IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cv_orders'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.cv_orders', item.policyname);
  END LOOP;
  FOR item IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.cv_orders'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.cv_orders FROM PUBLIC, anon, authenticated', item.attname);
  END LOOP;
  seq_name := pg_get_serial_sequence('public.cv_orders', 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq_name);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO anon, authenticated', seq_name);
  END IF;
END;
$$;

ALTER TABLE public.cv_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cv_orders FROM PUBLIC, anon, authenticated;
-- Tidak boleh menyisipkan id/created_at/client_name atau kolom tambahan lain.
GRANT INSERT (name, whatsapp, package, status, date)
  ON TABLE public.cv_orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.cv_orders TO authenticated;

CREATE POLICY lokerresmi_cv_orders_public_insert ON public.cv_orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'Menunggu Review'
    AND name IS NOT NULL AND length(btrim(name)) > 0
    AND whatsapp IS NOT NULL AND length(btrim(whatsapp)) > 0
    AND package IS NOT NULL AND length(btrim(package)) > 0
    AND date IS NOT NULL
  );
CREATE POLICY lokerresmi_cv_orders_admin_read ON public.cv_orders
  FOR SELECT TO authenticated USING ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_cv_orders_admin_update ON public.cv_orders
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_lokerresmi_admin()))
  WITH CHECK ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY lokerresmi_cv_orders_admin_delete ON public.cv_orders
  FOR DELETE TO authenticated USING ((SELECT public.is_lokerresmi_admin()));

COMMIT;
