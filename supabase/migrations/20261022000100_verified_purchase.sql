-- Verified purchase finance + private analytics outbox.
-- Bahasa dokumentasi: Indonesia. Tidak melakukan network call dari database.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.cv_orders') IS NULL THEN
    RAISE EXCEPTION 'Target tidak cocok: public.cv_orders tidak ditemukan';
  END IF;
  IF to_regprocedure('public.is_lokerresmi_admin()') IS NULL THEN
    RAISE EXCEPTION 'Jalankan migration admin predicate terlebih dahulu';
  END IF;
END $$;

ALTER TABLE public.cv_orders
  ADD COLUMN IF NOT EXISTS amount_paid numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS transaction_id text;

-- Identitas transaksi dibuat database dan tidak boleh diedit. Baris lama mendapat
-- ID stabil saat migration; bukan turunan dari id publik yang dapat diubah.
UPDATE public.cv_orders
SET transaction_id = 'cv_' || gen_random_uuid()::text
WHERE transaction_id IS NULL;
ALTER TABLE public.cv_orders ALTER COLUMN transaction_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cv_orders_transaction_id_uidx
  ON public.cv_orders (transaction_id);

CREATE TABLE IF NOT EXISTS public.b2b_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company text NOT NULL,
  package text NOT NULL,
  status text NOT NULL DEFAULT 'Menunggu Pembayaran',
  amount_paid numeric,
  currency text NOT NULL DEFAULT 'IDR',
  paid_at timestamptz,
  transaction_id text NOT NULL DEFAULT ('b2b_' || gen_random_uuid()::text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT b2b_orders_package_ck CHECK (package IN ('Standard', 'Featured Job', 'Paid placement')),
  CONSTRAINT b2b_orders_transaction_id_prefix_ck CHECK (transaction_id LIKE 'b2b_%')
);
CREATE UNIQUE INDEX IF NOT EXISTS b2b_orders_transaction_id_uidx
  ON public.b2b_orders (transaction_id);

CREATE TABLE IF NOT EXISTS public.purchase_outbox (
  transaction_id text PRIMARY KEY,
  event_name text NOT NULL DEFAULT 'purchase',
  payload jsonb NOT NULL,
  client_id text NOT NULL DEFAULT ('client_' || encode(gen_random_bytes(12), 'hex')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'pending',
  claimed_at timestamptz,
  sent_at timestamptz,
  CONSTRAINT purchase_outbox_event_ck CHECK (event_name = 'purchase'),
  CONSTRAINT purchase_outbox_delivery_ck CHECK (delivery_status IN ('pending','sending','sent','uncertain'))
);

CREATE OR REPLACE FUNCTION public.lokerresmi_is_paid_status(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT lower(btrim(p_status)) IN ('lunas', 'paid');
$$;

CREATE OR REPLACE FUNCTION public.lokerresmi_validate_purchase_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_is_paid boolean := COALESCE(public.lokerresmi_is_paid_status(NEW.status), false);
  v_was_paid boolean := TG_OP = 'UPDATE' AND COALESCE(OLD.paid_at IS NOT NULL OR public.lokerresmi_is_paid_status(OLD.status), false);
  v_admin boolean := public.is_lokerresmi_admin() IS TRUE;
BEGIN
  -- Payment evidence is created only by an authenticated admin transition.
  IF TG_OP = 'INSERT' AND (v_is_paid OR NEW.paid_at IS NOT NULL) THEN
    RAISE EXCEPTION 'INSERT paid/lunas atau paid_at harus melalui transisi UPDATE admin';
  END IF;
  IF TG_OP = 'UPDATE' AND v_is_paid AND NOT v_was_paid AND NOT v_admin THEN
    RAISE EXCEPTION 'Hanya admin terverifikasi boleh menandai pembayaran';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT v_admin
     AND (NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at) THEN
    RAISE EXCEPTION 'Hanya admin terverifikasi boleh mengubah data finansial';
  END IF;

  IF TG_OP = 'UPDATE' AND v_was_paid THEN
    IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.package IS DISTINCT FROM OLD.package THEN
      RAISE EXCEPTION 'Identitas finansial dan package yang sudah dibayar immutable';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'id order yang sudah dibayar immutable';
    END IF;
  END IF;

  -- Validate every stored amount (including an unpaid amount), not just paid rows.
  IF NEW.amount_paid IS NOT NULL THEN
    IF NEW.amount_paid = 'NaN'::numeric
       OR NEW.amount_paid IN ('Infinity'::numeric, '-Infinity'::numeric)
       OR NEW.amount_paid > 1000000000000
       OR scale(NEW.amount_paid) > 2 THEN
      RAISE EXCEPTION 'amount_paid harus finite, berskala maksimal 2 desimal, dan <= 1 triliun';
    END IF;
    IF upper(btrim(NEW.currency)) NOT IN ('IDR','USD','SGD','MYR','EUR','AUD','GBP','JPY') THEN
      RAISE EXCEPTION 'currency tidak didukung';
    END IF;
    IF upper(btrim(NEW.currency)) = 'JPY' AND scale(NEW.amount_paid) <> 0 THEN
      RAISE EXCEPTION 'amount_paid JPY harus bilangan bulat';
    END IF;
  END IF;

  IF v_is_paid THEN
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN
      RAISE EXCEPTION 'amount_paid harus positif saat paid/lunas';
    END IF;
    IF NEW.currency IS NULL OR upper(btrim(NEW.currency)) NOT IN ('IDR','USD','SGD','MYR','EUR','AUD','GBP','JPY') THEN
      RAISE EXCEPTION 'currency tidak didukung';
    END IF;
    NEW.currency := upper(btrim(NEW.currency));
    IF NOT v_was_paid THEN
      IF NEW.paid_at IS NOT NULL THEN
        RAISE EXCEPTION 'paid_at awal harus NULL; database yang menetapkan waktunya';
      END IF;
      NEW.paid_at := now();
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT v_is_paid AND OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'paid_at hanya boleh ada pada pembayaran terverifikasi';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.paid_at IS NOT NULL AND NEW.paid_at IS NULL THEN
    RAISE EXCEPTION 'paid_at tidak boleh dihapus setelah pembayaran terverifikasi';
  END IF;

  -- Never accept a caller-supplied transaction id; keep existing ids stable on UPDATE.
  IF TG_OP = 'INSERT' THEN
    NEW.transaction_id := CASE WHEN TG_TABLE_NAME = 'cv_orders' THEN 'cv_' ELSE 'b2b_' END || gen_random_uuid()::text;
  ELSIF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    RAISE EXCEPTION 'transaction_id dibuat database dan immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.lokerresmi_stamp_b2b()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cv_orders_validate_purchase ON public.cv_orders;
CREATE TRIGGER cv_orders_validate_purchase
BEFORE INSERT OR UPDATE ON public.cv_orders
FOR EACH ROW EXECUTE FUNCTION public.lokerresmi_validate_purchase_row();
DROP TRIGGER IF EXISTS b2b_orders_validate_purchase ON public.b2b_orders;
CREATE TRIGGER b2b_orders_validate_purchase
BEFORE INSERT OR UPDATE ON public.b2b_orders
FOR EACH ROW EXECUTE FUNCTION public.lokerresmi_validate_purchase_row();
DROP TRIGGER IF EXISTS b2b_orders_stamp_updated_at ON public.b2b_orders;
CREATE TRIGGER b2b_orders_stamp_updated_at
BEFORE UPDATE ON public.b2b_orders
FOR EACH ROW EXECUTE FUNCTION public.lokerresmi_stamp_b2b();

CREATE OR REPLACE FUNCTION public.lokerresmi_purchase_payload(
  p_transaction_id text, p_package text, p_amount numeric, p_currency text
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'transaction_id', p_transaction_id,
    'value', p_amount,
    'currency', upper(p_currency),
    'items', jsonb_build_array(jsonb_build_object(
      'item_id', CASE
        WHEN p_transaction_id LIKE 'cv_%' THEN CASE p_package
          WHEN 'Paket Express (Rp 49.000)' THEN 'cv_express'
          WHEN 'Paket Profesional (Rp 99.000)' THEN 'cv_professional'
          WHEN 'Paket VIP Mentoring (Rp 249.000)' THEN 'cv_vip'
          ELSE 'cv_custom' END
        ELSE CASE p_package
          WHEN 'Standard' THEN 'employer_standard'
          WHEN 'Featured Job' THEN 'employer_featured'
          WHEN 'Paid placement' THEN 'employer_paid_placement'
          ELSE 'employer_custom' END END,
      'item_name', CASE
        WHEN p_transaction_id LIKE 'cv_%' THEN CASE p_package
          WHEN 'Paket Express (Rp 49.000)' THEN 'Paket Express'
          WHEN 'Paket Profesional (Rp 99.000)' THEN 'Paket Profesional'
          WHEN 'Paket VIP Mentoring (Rp 249.000)' THEN 'Paket VIP Mentoring'
          ELSE 'Layanan CV' END
        ELSE CASE p_package
          WHEN 'Standard' THEN 'Employer Standard'
          WHEN 'Featured Job' THEN 'Employer Featured Job'
          WHEN 'Paid placement' THEN 'Employer Paid placement'
          ELSE 'Layanan B2B' END END,
      'quantity', 1,
      'price', p_amount
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.lokerresmi_enqueue_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.is_lokerresmi_admin()
     AND OLD.paid_at IS NULL
     AND NEW.paid_at IS NOT NULL
     AND public.lokerresmi_is_paid_status(NEW.status) THEN
    INSERT INTO public.purchase_outbox(transaction_id, event_name, payload)
    VALUES (NEW.transaction_id, 'purchase', public.lokerresmi_purchase_payload(NEW.transaction_id, NEW.package, NEW.amount_paid, NEW.currency))
    ON CONFLICT (transaction_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cv_orders_enqueue_purchase ON public.cv_orders;
CREATE TRIGGER cv_orders_enqueue_purchase AFTER UPDATE ON public.cv_orders FOR EACH ROW EXECUTE FUNCTION public.lokerresmi_enqueue_purchase();
DROP TRIGGER IF EXISTS b2b_orders_enqueue_purchase ON public.b2b_orders;
CREATE TRIGGER b2b_orders_enqueue_purchase AFTER UPDATE ON public.b2b_orders FOR EACH ROW EXECUTE FUNCTION public.lokerresmi_enqueue_purchase();

-- RLS: B2B dan outbox hanya admin authenticated. Tidak ada public insert.
ALTER TABLE public.b2b_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.b2b_orders, public.purchase_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_orders TO authenticated;
GRANT SELECT ON public.purchase_outbox TO authenticated;
CREATE POLICY b2b_orders_admin_all ON public.b2b_orders FOR ALL TO authenticated
  USING ((SELECT public.is_lokerresmi_admin())) WITH CHECK ((SELECT public.is_lokerresmi_admin()));
CREATE POLICY purchase_outbox_admin_read ON public.purchase_outbox FOR SELECT TO authenticated
  USING ((SELECT public.is_lokerresmi_admin()));
REVOKE ALL ON FUNCTION public.lokerresmi_is_paid_status(text), public.lokerresmi_validate_purchase_row(), public.lokerresmi_stamp_b2b(), public.lokerresmi_purchase_payload(text,text,numeric,text), public.lokerresmi_enqueue_purchase() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_purchase(p_transaction_id text)
RETURNS SETOF public.purchase_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_lokerresmi_admin() THEN RAISE EXCEPTION 'Admin diperlukan'; END IF;
  RETURN QUERY UPDATE public.purchase_outbox o SET delivery_status='sending', claimed_at=now()
  WHERE o.transaction_id=p_transaction_id AND o.delivery_status='pending' RETURNING o.*;
END $$;
CREATE OR REPLACE FUNCTION public.complete_purchase(p_transaction_id text, p_outcome text)
RETURNS SETOF public.purchase_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_lokerresmi_admin() THEN RAISE EXCEPTION 'Admin diperlukan'; END IF;
  IF p_outcome NOT IN ('sent','uncertain') THEN RAISE EXCEPTION 'Outcome harus sent atau uncertain'; END IF;
  RETURN QUERY UPDATE public.purchase_outbox o SET delivery_status=p_outcome, sent_at=CASE WHEN p_outcome='sent' THEN now() ELSE NULL END
  WHERE o.transaction_id=p_transaction_id AND o.delivery_status='sending' RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_purchase(text), public.complete_purchase(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_purchase(text), public.complete_purchase(text,text) TO authenticated;

COMMENT ON TABLE public.purchase_outbox IS 'Outbox privat; API admin melakukan delivery network, database tidak melakukan network.';
COMMIT;
