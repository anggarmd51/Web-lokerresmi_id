import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseEvent, createPurchaseHandler } from '../api/purchase.js';

const id = 'cv_12345678-1234-1234-1234-123456789abc';
function fixture() { return { transaction_id: id, client_id: 'client_1234567890abcdef12345678', payload: { transaction_id: id, value: 47000, currency: 'IDR', items: [{ item_id: 'cv_express', item_name: 'PII never forwarded', quantity: 1, price: 47000 }] } }; }
const env = { VITE_SUPABASE_URL: 'https://offline.invalid', VITE_SUPABASE_ANON_KEY: 'anon-fixture', VITE_GA_MEASUREMENT_ID: 'G-RW0RL1ZPKV', GA4_API_SECRET: 'offline-secret' };
function setup(options = {}) {
  let status = options.status || 'pending';
  const calls = []; const sent = [];
  const db = {
    auth: { getUser: async () => options.unauthenticated ? { error: new Error('bad token') } : { data: { user: { id: 'admin-fixture' } } } },
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === 'is_lokerresmi_admin') return { data: options.admin !== false };
      if (name === 'claim_purchase') {
        if (options.claimError) return { error: new Error('offline') };
        if (status !== 'pending' || options.missing) return { data: [] };
        status = 'sending'; return { data: [options.row || fixture()] };
      }
      if (name === 'complete_purchase') {
        if (options.completeError) return { error: new Error('offline') };
        status = args.p_outcome; return { data: [{ delivery_status: status }] };
      }
      throw Error(name);
    },
    from(table) { assert.equal(table, 'purchase_outbox'); return { select(cols) { assert.equal(cols, 'delivery_status'); return this; }, eq() { return this; }, async maybeSingle() { return { data: options.missing ? null : { delivery_status: status } }; } }; },
  };
  const handler = createPurchaseHandler({ env: options.env || env, clientFactory: (_url, _key, opts) => { assert.equal(opts.global.headers.Authorization, 'Bearer offline.jwt.token'); return db; }, fetchImpl: async (url, init) => {
    sent.push({ url, init }); if (options.networkError) throw new Error('timeout'); return { ok: options.gaOK !== false };
  } });
  async function run(overrides = {}) {
    const res = { code: null, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer offline.jwt.token' }, body: { transaction_id: id }, ...overrides }, res); return res;
  }
  return { run, calls, sent, status: () => status };
}

test('purchase payload uses actual paid amount, official keys and fixed item names without PII/admin identity', () => {
  const event = buildPurchaseEvent(fixture());
  assert.equal(event.events[0].name, 'purchase');
  assert.deepEqual(event.events[0].params, { transaction_id: id, value: 47000, currency: 'IDR', items: [{ item_id: 'cv_express', item_name: 'Paket Express', quantity: 1, price: 47000 }] });
  assert.doesNotMatch(JSON.stringify(event), /PII|admin|whatsapp|user_id/);
  assert.equal(event.consent.ad_user_data, 'DENIED');
});
for (const [name, mutate] of [
  ['zero', r => { r.payload.value = 0; }], ['negative', r => { r.payload.value = -1; }],
  ['NaN', r => { r.payload.value = NaN; }], ['infinity', r => { r.payload.value = Infinity; }],
  ['too large', r => { r.payload.value = 1e13; }], ['string amount', r => { r.payload.value = '47000'; }],
  ['currency', r => { r.payload.currency = 'BAD'; }], ['transaction mismatch', r => { r.payload.transaction_id = 'other'; }],
  ['unknown item', r => { r.payload.items[0].item_id = 'phone'; }], ['item price mismatch', r => { r.payload.items[0].price = 49000; }],
  ['quantity', r => { r.payload.items[0].quantity = 2; }], ['client PII', r => { r.client_id = 'customer@example.com'; }],
]) test(`reject invalid snapshot: ${name}`, () => { const row = fixture(); mutate(row); assert.throws(() => buildPurchaseEvent(row)); });

test('admin paid snapshot sends once; repeated/concurrent requests do not send again', async () => {
  const s = setup(); const results = await Promise.all([s.run(), s.run(), s.run()]);
  assert.equal(s.sent.length, 1); assert.equal(s.status(), 'sent');
  assert.ok(results.some(r => r.body.status === 'sent'));
  assert.equal((await s.run()).body.status, 'already_processed');
  assert.equal(s.sent.length, 1); assert.match(s.sent[0].url, /^https:\/\/www.google-analytics.com\/mp\/collect\?/);
  assert.equal(JSON.parse(s.sent[0].init.body).events[0].params.value, 47000);
});
test('missing API secret leaves outbox pending without claim or network', async () => {
  const s = setup({ env: { ...env, GA4_API_SECRET: '' } }); const r = await s.run();
  assert.equal(r.code, 503); assert.equal(r.body.status, 'pending'); assert.equal(s.status(), 'pending');
  assert.deepEqual(s.calls.map(c => c[0]), ['is_lokerresmi_admin']); assert.equal(s.sent.length, 0);
});
test('wrong measurement property fails closed', async () => {
  const s = setup({ env: { ...env, VITE_GA_MEASUREMENT_ID: 'G-OTHER' } }); assert.equal((await s.run()).body.status, 'pending'); assert.equal(s.sent.length, 0);
});
for (const options of [{ networkError: true }, { gaOK: false }, { completeError: true }]) test(`ambiguous delivery never automatically retries: ${JSON.stringify(options)}`, async () => {
  const s = setup(options); assert.equal((await s.run()).body.status, 'uncertain');
  await s.run(); assert.equal(s.sent.length, 1); assert.ok(['sending', 'uncertain'].includes(s.status()));
});
test('unauthenticated and non-admin requests never claim/send', async () => {
  for (const options of [{ unauthenticated: true }, { admin: false }]) {
    const s = setup(options); assert.ok([401, 403].includes((await s.run()).code)); assert.equal(s.sent.length, 0); assert.equal(s.status(), 'pending');
  }
  const s = setup(); assert.equal((await s.run({ headers: {} })).code, 401); assert.equal(s.calls.length, 0);
});
test('method and attacker-supplied payment data rejected before database/network', async () => {
  const s = setup(); assert.equal((await s.run({ method: 'GET' })).code, 405);
  for (const body of [{ transaction_id: id, value: 1 }, { transaction_id: 'not-a-transaction' }, [], '{bad']) assert.equal((await s.run({ body })).code, 400);
  assert.equal(s.sent.length, 0); assert.equal(s.calls.length, 0);
});
test('missing verified outbox never manufactures a purchase', async () => {
  const s = setup({ missing: true }); assert.equal((await s.run()).code, 404); assert.equal(s.sent.length, 0);
});
test('invalid stored snapshot is quarantined without GA call', async () => {
  const row = fixture(); row.payload.items[0].item_id = 'untrusted'; const s = setup({ row });
  assert.equal((await s.run()).code, 422); assert.equal(s.status(), 'uncertain'); assert.equal(s.sent.length, 0);
});
