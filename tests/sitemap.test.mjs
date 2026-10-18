import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  default as handler,
  PAGE_SIZE,
  fetchActiveJobs,
  renderSitemap,
  validLastmod,
} from '../api/sitemap.js';

const completeJob = (overrides = {}) => ({ id: 42, title: 'Posisi', company: 'Perusahaan', status: 'Aktif', location: 'Medan', desc: 'Deskripsi pekerjaan', created_at: '2026-01-02T10:00:00Z', ...overrides });
const root = fileURLToPath(new URL('..', import.meta.url));

function response(rows, ok = true, status = 200) {
  return { ok, status, json: async () => rows };
}

function makeRows(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: offset + index,
    status: 'Aktif',
    created_at: '2026-01-02T10:00:00Z',
  }));
}

test('fetchActiveJobs paginates with explicit limit and offset', async () => {
  const calls = [];
  const rows = await fetchActiveJobs(async (url, options) => {
    calls.push({ url: String(url), options });
    const offset = Number(new URL(url).searchParams.get('offset'));
    return response(offset === 0 ? makeRows(PAGE_SIZE) : makeRows(2, offset));
  }, 'https://project.supabase.co', 'anon-key');

  assert.equal(rows.length, PAGE_SIZE + 2);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).searchParams.get('status'), 'eq.Aktif');
  assert.equal(new URL(calls[0].url).searchParams.get('select'), 'id,created_at,date_posted,valid_through,status,location,category,title,company,type,desc,requirements');
  assert.equal(new URL(calls[0].url).searchParams.get('limit'), String(PAGE_SIZE));
  assert.equal(new URL(calls[1].url).searchParams.get('offset'), String(PAGE_SIZE));
  assert.equal(calls[0].options.headers.apikey, 'anon-key');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer anon-key');
});

test('renderSitemap always includes homepage and escapes XML while encoding IDs', () => {
  const xml = renderSitemap([
    completeJob({ id: 'a/b?x=1&y=2', created_at: '2026-03-04T00:00:00Z' }),
    completeJob({ id: '<unsafe>', date_posted: '2026-03-04', created_at: 'not-a-date' }),
  ]);

  assert.match(xml, /<loc>https:\/\/lokerresmi\.vercel\.app\/<\/loc>/);
  assert.match(xml, /\/lowongan\/a%2Fb%3Fx%3D1%26y%3D2/);
  assert.match(xml, /%3Cunsafe%3E/);
  assert.match(xml, /<lastmod>2026-03-04<\/lastmod>/);
  assert.doesNotMatch(xml, /not-a-date/);
  assert.doesNotMatch(xml, /<unsafe>/);
});

test('invalid date values are omitted', () => {
  assert.equal(validLastmod('2026-02-30'), null);
  assert.equal(validLastmod('definitely invalid'), null);
  assert.equal(validLastmod(null), null);
});

test('renderSitemap includes only landings supported by active matching jobs', () => {
  const xml = renderSitemap([
    { id: 1, status: 'Aktif', location: 'Medan', category: 'Sales & Marketing', title: 'Sales', desc: 'Pekerjaan kantor' },
    { id: 2, status: 'Aktif', location: 'Jakarta', category: 'IT & Software', title: 'Developer', desc: 'Fresh graduate dipersilakan' },
    { id: 3, status: 'Aktif', location: 'Medan', category: 'HRD/Personalia', title: 'HR', desc: 'Tidak menerima fresh graduate' },
  ]);
  assert.match(xml, /\/lowongan-kerja\/medan/);
  assert.doesNotMatch(xml, /\/lowongan-admin\/medan/);
  assert.match(xml, /\/lowongan-fresh-graduate/);
});

test('Supabase HTTP failures reject instead of returning an empty sitemap', async () => {
  await assert.rejects(
    fetchActiveJobs(async () => response({ message: 'denied' }, false, 401), 'https://project.supabase.co', 'anon-key'),
    /request failed/,
  );
});

test('Vercel routes protect sitemap, API, and filesystem before SPA fallback', async () => {
  const config = JSON.parse(await fs.readFile(`${root}/vercel.json`, 'utf8'));
  assert.deepEqual(config.routes.map((route) => route.src ?? route.handle), [
    '/sitemap\\.xml',
    '/api/(.*)',
    'filesystem',
    '/(.*)',
  ]);
  assert.equal(config.routes[0].dest, '/api/sitemap.js');
  assert.equal(config.routes.at(-1).dest, '/index.html');
});

test('handler returns XML with live detail URLs or a non-cacheable 503, never SPA HTML', async () => {
  const keys = ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const makeResponse = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } });
  try {
    for (const key of keys) delete process.env[key];
    console.error = () => {};
    const missing = makeResponse();
    await handler({}, missing);
    assert.equal(missing.statusCode, 503);
    assert.equal(missing.headers['Cache-Control'], 'no-store');
    assert.match(missing.headers['Content-Type'], /^application\/xml/);
    assert.match(missing.body, /^<\?xml/);
    process.env.VITE_SUPABASE_URL = 'https://project.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    globalThis.fetch = async () => response([completeJob({ id: 42, created_at: '2026-10-17' })]);
    const success = makeResponse();
    await handler({}, success);
    assert.equal(success.statusCode, 200);
    assert.match(success.body, /https:\/\/lokerresmi\.vercel\.app\/lowongan\/42/);
    assert.match(success.headers['Content-Type'], /^application\/xml/);
    globalThis.fetch = async () => { throw new Error('network failed'); };
    const failed = makeResponse();
    await handler({}, failed);
    assert.equal(failed.statusCode, 503);
    assert.equal(failed.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(failed.body, /<html|network failed/);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
