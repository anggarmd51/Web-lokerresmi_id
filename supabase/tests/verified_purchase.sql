-- Tes lokal saja; runner membuat database local_lokerresmi_verified_test lalu rollback semua fixture.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'local_lokerresmi_verified_test' THEN RAISE EXCEPTION 'Database test salah'; END IF; END $$;
BEGIN;
CREATE FUNCTION pg_temp.ok(v boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION 'GAGAL: %',label; ELSE RAISE NOTICE 'LULUS: %',label; END IF; END $$;
CREATE FUNCTION pg_temp.denied(sql text, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE sql; RAISE EXCEPTION 'GAGAL (tidak ditolak): %',label; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'GAGAL (tidak ditolak)%' THEN RAISE; ELSE RAISE NOTICE 'LULUS ditolak: %',label; END IF; END; END $$;
CREATE FUNCTION pg_temp.set_claims(claims text) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims',claims,true) $$;

-- anon tidak dapat menyentuh finance/B2B/outbox.
SET LOCAL ROLE anon; SELECT pg_temp.set_claims('{"role":"anon"}');
SELECT pg_temp.denied($q$INSERT INTO public.b2b_orders(company,package) VALUES ('X','Standard')$q$,'anon tidak membuat B2B');
SELECT pg_temp.denied($q$INSERT INTO public.purchase_outbox(transaction_id,payload) VALUES ('x','{}')$q$,'anon tidak menulis outbox');
RESET ROLE;

-- Admin membuat order publik secara unpaid melalui jalur admin yang terverifikasi.
SET LOCAL ROLE authenticated; SELECT pg_temp.set_claims('{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"lokerresmi_admin":true}}');
INSERT INTO public.cv_orders(name,whatsapp,package,status,date) VALUES ('Test','0812','Unknown','Menunggu Review','2026-10-22') RETURNING id \gset cv_
INSERT INTO public.b2b_orders(company,package) VALUES ('PT Test','Standard') RETURNING id,transaction_id \gset b2b_
SELECT pg_temp.ok((SELECT transaction_id LIKE 'cv_%' FROM public.cv_orders WHERE id=:cv_id),'transaction_id CV prefix');
SELECT pg_temp.ok((SELECT transaction_id LIKE 'b2b_%' FROM public.b2b_orders WHERE id=:b2b_id),'transaction_id B2B prefix');

SELECT pg_temp.denied($q$INSERT INTO public.cv_orders(name,whatsapp,package,status,date,amount_paid,currency) VALUES ('P','08','Standard','paid','x',100,'IDR')$q$,'insert paid CV ditolak');
SELECT pg_temp.denied($q$INSERT INTO public.b2b_orders(company,package,status,amount_paid,currency) VALUES ('P','Standard','Lunas',100,'IDR')$q$,'insert paid B2B ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET amount_paid=-1 WHERE id=:cv_id$q$,'amount negatif ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET status='paid',amount_paid=100,currency='ZZZ' WHERE id=:cv_id$q$,'currency tidak didukung ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET status='paid',amount_paid='Infinity'::numeric,currency='IDR' WHERE id=:cv_id$q$,'amount Infinity ditolak');

UPDATE public.cv_orders SET status='paid',amount_paid=125000,currency='idr' WHERE id=:cv_id;
SELECT pg_temp.ok((SELECT paid_at IS NOT NULL AND currency='IDR' FROM public.cv_orders WHERE id=:cv_id),'transition menetapkan paid_at DB dan normalisasi currency');
SELECT pg_temp.ok((SELECT count(*)=1 FROM public.purchase_outbox o JOIN public.cv_orders c USING(transaction_id) WHERE c.id=:cv_id AND (o.payload->>'transaction_id')=o.transaction_id AND o.payload->'items'->0->>'item_id'='cv_custom' AND o.payload->'items'->0->>'item_name'='Layanan CV'),'outbox unknown tidak mengirim teks package/PII');

-- Mapping CV harus persis katalog produksi, bukan label lama atau teks bebas.
INSERT INTO public.cv_orders(name,whatsapp,package,status,date) VALUES ('E','08','Paket Express (Rp 49.000)','Menunggu Review','2026-10-22') RETURNING id \gset cv_express_
INSERT INTO public.cv_orders(name,whatsapp,package,status,date) VALUES ('P','08','Paket Profesional (Rp 99.000)','Menunggu Review','2026-10-22') RETURNING id \gset cv_prof_
INSERT INTO public.cv_orders(name,whatsapp,package,status,date) VALUES ('V','08','Paket VIP Mentoring (Rp 249.000)','Menunggu Review','2026-10-22') RETURNING id \gset cv_vip_
UPDATE public.cv_orders SET status='paid',amount_paid=49000,currency='IDR' WHERE id=:cv_express_id;
UPDATE public.cv_orders SET status='paid',amount_paid=99000,currency='IDR' WHERE id=:cv_prof_id;
UPDATE public.cv_orders SET status='paid',amount_paid=249000,currency='IDR' WHERE id=:cv_vip_id;
SELECT pg_temp.ok((SELECT payload->'items'->0->>'item_id'='cv_express' AND payload->'items'->0->>'item_name'='Paket Express' FROM public.purchase_outbox o JOIN public.cv_orders c USING(transaction_id) WHERE c.id=:cv_express_id),'mapping CV Express');
SELECT pg_temp.ok((SELECT payload->'items'->0->>'item_id'='cv_professional' AND payload->'items'->0->>'item_name'='Paket Profesional' FROM public.purchase_outbox o JOIN public.cv_orders c USING(transaction_id) WHERE c.id=:cv_prof_id),'mapping CV Profesional');
SELECT pg_temp.ok((SELECT payload->'items'->0->>'item_id'='cv_vip' AND payload->'items'->0->>'item_name'='Paket VIP Mentoring' FROM public.purchase_outbox o JOIN public.cv_orders c USING(transaction_id) WHERE c.id=:cv_vip_id),'mapping CV VIP');
-- pengulangan status tidak menambah event.
UPDATE public.cv_orders SET status='paid' WHERE id=:cv_id;
UPDATE public.cv_orders SET status='Selesai' WHERE id=:cv_id;
UPDATE public.cv_orders SET status='paid' WHERE id=:cv_id;
SELECT pg_temp.ok((SELECT count(*)=4 FROM public.purchase_outbox),'repeated status tidak menggandakan outbox');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET amount_paid=999 WHERE id=:cv_id$q$,'finance paid immutable');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET package='Other' WHERE id=:cv_id$q$,'package paid immutable');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET transaction_id='cv_fake' WHERE id=:cv_id$q$,'transaction_id immutable');

-- Edge cases: NULL legacy status, explicit NaN/scale/JPY checks, and paid_at spoofing.
INSERT INTO public.cv_orders(name,whatsapp,package,status,date) VALUES ('Edge','08','Paket Express (Rp 49.000)','Menunggu Review','2026-10-22') RETURNING id \gset cv_edge_
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET amount_paid='NaN'::numeric WHERE id=:cv_edge_id$q$,'NaN ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET amount_paid=1.234 WHERE id=:cv_edge_id$q$,'amount lebih dari 2 desimal ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET amount_paid=100.00,currency='JPY' WHERE id=:cv_edge_id$q$,'JPY pecahan ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET status='paid',amount_paid=49000,currency='IDR',paid_at='2020-01-01+00'::timestamptz WHERE id=:cv_edge_id$q$,'paid_at caller ditolak');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET paid_at=now() WHERE id=:cv_edge_id$q$,'paid_at palsu unpaid ditolak');
UPDATE public.cv_orders SET status=NULL WHERE id=:cv_edge_id;
UPDATE public.cv_orders SET status='paid',amount_paid=49000,currency='IDR' WHERE id=:cv_edge_id;
SELECT pg_temp.ok((SELECT (SELECT paid_at IS NOT NULL FROM public.cv_orders WHERE id=:cv_edge_id) AND count(*)=1 FROM public.purchase_outbox WHERE transaction_id=(SELECT transaction_id FROM public.cv_orders WHERE id=:cv_edge_id)),'status NULL legacy enqueue sekali');

-- Trigger selalu mengganti id transaksi saat INSERT, termasuk id spoof yang disuplai caller.
INSERT INTO public.b2b_orders(company,package,transaction_id) VALUES ('Spoof','Standard','b2b_caller_supplied') RETURNING id,transaction_id \gset b2b_spoof_
SELECT pg_temp.ok(:'b2b_spoof_transaction_id' <> 'b2b_caller_supplied' AND :'b2b_spoof_transaction_id' LIKE 'b2b_%','INSERT transaction_id spoof diabaikan');
DELETE FROM public.b2b_orders WHERE id=:b2b_spoof_id;
SELECT pg_temp.denied($q$UPDATE public.purchase_outbox SET payload='{}' WHERE transaction_id=(SELECT transaction_id FROM public.cv_orders WHERE id=:cv_id)$q$,'outbox immutable by admin');

SELECT pg_temp.ok((SELECT count(*)=1 FROM public.claim_purchase((SELECT transaction_id FROM public.cv_orders WHERE id=:cv_id))),'claim pending atomic');
SELECT pg_temp.ok((SELECT delivery_status='sending' FROM public.purchase_outbox WHERE transaction_id=(SELECT transaction_id FROM public.cv_orders WHERE id=:cv_id)),'claim menjadi sending');
SELECT pg_temp.ok((SELECT count(*)=1 FROM public.complete_purchase((SELECT transaction_id FROM public.cv_orders WHERE id=:cv_id),'sent')),'complete mengubah sent');
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.claim_purchase((SELECT transaction_id FROM public.cv_orders WHERE id=:cv_id))),'sent tidak dapat di-claim ulang');

-- Admin CRUD B2B dan pembayaran memicu satu outbox.
UPDATE public.b2b_orders SET status='Lunas',amount_paid=500,currency='USD' WHERE id=:b2b_id;
SELECT pg_temp.ok((SELECT paid_at IS NOT NULL FROM public.b2b_orders WHERE id=:b2b_id),'B2B paid transition');
SELECT pg_temp.ok((SELECT count(*)=1 AND max(payload->'items'->0->>'item_id')='employer_standard' AND max(payload->'items'->0->>'item_name')='Employer Standard' FROM public.purchase_outbox WHERE transaction_id=(SELECT transaction_id FROM public.b2b_orders WHERE id=:b2b_id)),'B2B outbox allowlist mapping');
UPDATE public.b2b_orders SET company='PT Updated' WHERE id=:b2b_id;
DELETE FROM public.b2b_orders WHERE id=:b2b_id;
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.b2b_orders WHERE id=:b2b_id),'admin B2B CRUD');
RESET ROLE;

SET LOCAL ROLE authenticated; SELECT pg_temp.set_claims('{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222","app_metadata":{}}');
SELECT pg_temp.denied($q$INSERT INTO public.b2b_orders(company,package) VALUES ('No','Standard')$q$,'user biasa tidak membuat B2B');
SELECT pg_temp.ok((SELECT count(*)=0 FROM public.purchase_outbox),'user biasa tidak membaca outbox');
SELECT pg_temp.denied($q$UPDATE public.cv_orders SET status='paid',amount_paid=1 WHERE id=:cv_edge_id$q$,'nonadmin tidak dapat transisi finance');
SELECT pg_temp.denied($q$SELECT * FROM public.claim_purchase('none')$q$,'user biasa tidak claim');
RESET ROLE;
ROLLBACK;
\echo 'Seluruh verified purchase SQL test lulus.'
