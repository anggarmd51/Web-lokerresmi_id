import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };
const CURRENCIES = new Set(['IDR', 'USD', 'SGD', 'MYR', 'EUR', 'AUD', 'GBP', 'JPY']);
const ITEMS = new Set(['cv_express', 'cv_professional', 'cv_vip', 'cv_custom', 'employer_standard', 'employer_featured', 'employer_paid_placement']);

// Reconstruct an allowlisted payload: never forward request amounts, arbitrary
// outbox keys, customer names, phone numbers, or the administrator's GA identity.
export function buildPurchaseEvent(row) {
  const payload = row?.payload;
  const item = payload?.items?.[0];
  if (!/^(?:cv|b2b)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row?.transaction_id || '') ||
      payload?.transaction_id !== row.transaction_id || !CURRENCIES.has(payload?.currency) ||
      typeof payload.value !== 'number' || !Number.isFinite(payload.value) || payload.value <= 0 || payload.value > 1e12 ||
      !Array.isArray(payload.items) || payload.items.length !== 1 || !ITEMS.has(item?.item_id) ||
      item.quantity !== 1 || item.price !== payload.value ||
      !/^client_[a-f0-9]{24}$/.test(row.client_id || '')) throw new Error('Invalid verified snapshot');
  const names = {
    cv_express: 'Paket Express', cv_professional: 'Paket Profesional', cv_vip: 'Paket VIP Mentoring', cv_custom: 'Layanan CV',
    employer_standard: 'Employer Standard', employer_featured: 'Employer Featured Job', employer_paid_placement: 'Employer Paid placement',
  };
  return {
    client_id: row.client_id,
    non_personalized_ads: true,
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    events: [{ name: 'purchase', params: {
      transaction_id: payload.transaction_id, value: payload.value, currency: payload.currency,
      items: [{ item_id: item.item_id, item_name: names[item.item_id], quantity: 1, price: item.price }],
    } }],
  };
}

export function createPurchaseHandler({ env = process.env, clientFactory = createClient, fetchImpl = globalThis.fetch } = {}) {
  return async function purchase(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const reply = (code, body) => res.status(code).json(body);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { error: 'METHOD_NOT_ALLOWED' }); }
    const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers?.authorization || '')?.[1];
    if (!token) return reply(401, { error: 'AUTH_REQUIRED' });
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return reply(400, { error: 'INVALID_REQUEST' }); }
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 ||
        !/^(?:cv|b2b)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.transaction_id || '')) {
      return reply(400, { error: 'INVALID_REQUEST' });
    }
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return reply(503, { status: 'pending', error: 'SERVER_NOT_CONFIGURED' });
    const db = clientFactory(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    let row;
    try {
      const { data: auth, error: authError } = await db.auth.getUser(token);
      if (authError || !auth?.user) return reply(401, { error: 'INVALID_SESSION' });
      const { data: admin, error: adminError } = await db.rpc('is_lokerresmi_admin');
      if (adminError || admin !== true) return reply(403, { error: 'ADMIN_REQUIRED' });
      // Check setup before claiming: a missing secret leaves durable pending work.
      const measurementId = env.GA4_MEASUREMENT_ID || env.VITE_GA_MEASUREMENT_ID;
      if (measurementId !== 'G-RW0RL1ZPKV' || !env.GA4_API_SECRET) {
        return reply(503, { status: 'pending', error: 'GA4_NOT_CONFIGURED' });
      }
      const { data, error } = await db.rpc('claim_purchase', { p_transaction_id: body.transaction_id });
      if (error) return reply(503, { status: 'pending', error: 'OUTBOX_UNAVAILABLE' });
      row = data?.[0];
      if (!row) {
        const { data: existing, error: readError } = await db.from('purchase_outbox')
          .select('delivery_status').eq('transaction_id', body.transaction_id).maybeSingle();
        if (readError) return reply(503, { status: 'uncertain', error: 'OUTBOX_UNAVAILABLE' });
        if (!existing) return reply(404, { error: 'NO_VERIFIED_PURCHASE' });
        return reply(200, { status: existing.delivery_status === 'sent' ? 'already_processed' : 'uncertain' });
      }
      let event;
      try { event = buildPurchaseEvent(row); } catch {
        await db.rpc('complete_purchase', { p_transaction_id: row.transaction_id, p_outcome: 'uncertain' });
        return reply(422, { status: 'uncertain', error: 'INVALID_SNAPSHOT' });
      }
      let outcome = 'uncertain';
      try {
        const endpoint = new URL('https://www.google-analytics.com/mp/collect');
        endpoint.searchParams.set('measurement_id', measurementId);
        endpoint.searchParams.set('api_secret', env.GA4_API_SECRET);
        // Exactly one outbound attempt. Timeout/network/5xx can be ambiguous;
        // do not release the claim or automatically resend an uncertain purchase.
        const response = await fetchImpl(endpoint.toString(), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
          signal: AbortSignal.timeout(10000), redirect: 'error',
        });
        if (response.ok) outcome = 'sent';
      } catch { /* No raw transport logging: URL contains an API secret. */ }
      const { data: completed, error: completeError } = await db.rpc('complete_purchase', { p_transaction_id: row.transaction_id, p_outcome: outcome });
      if (completeError || !completed?.length) return reply(202, { status: 'uncertain' });
      // 'sent' means HTTP accepted only, not proven processing/reporting by GA4.
      return reply(outcome === 'sent' ? 200 : 202, { status: outcome });
    } catch {
      // Preserve claimed state on unknown failures. Never retry or fabricate revenue.
      return reply(503, { status: row ? 'uncertain' : 'pending', error: 'PURCHASE_UNAVAILABLE' });
    }
  };
}

export default createPurchaseHandler();
