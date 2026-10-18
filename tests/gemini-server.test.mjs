import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRequest, parseResult, createHandler, MAX_PDF_BYTES } from '../api/gemini.js';

const PDF = Buffer.from('%PDF-1.7\nminimal').toString('base64');
const analysis = { score: 88, summary: 'Ringkasan yang cukup panjang dan valid.', strengths: ['JS'], weaknesses: ['Bahasa'], missing_keywords: ['Docker'], recommendations: ['Tambahkan proyek'] };

function response(status, body, { json = true } = {}) {
  return { ok: status >= 200 && status < 300, status, async json() { if (!json) throw new Error('bad json'); return body; } };
}
function res() {
  const headers = new Map();
  return { headers, statusCode: undefined, body: undefined, setHeader(name, value) { headers.set(name, value); }, end(body) { this.body = body; }, json() { return JSON.parse(this.body); } };
}
function request(body, headers = {}) {
  return { method: 'POST', headers: { host: 'app.test', 'content-type': 'application/json', ...headers }, body };
}
async function invoke(body, options = {}, headers = {}) {
  const result = res();
  await createHandler({ env: { GEMINI_API_KEY: 'server-secret', ...options.env }, fetchImpl: options.fetchImpl || (async () => response(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }] })), attemptTimeoutMs: options.attemptTimeoutMs ?? 100, totalTimeoutMs: options.totalTimeoutMs ?? 500 })(request(body, headers), result);
  return result;
}
function upstreamFor(type, text) {
  return response(200, { candidates: [{ content: { parts: [{ text: type === 'cover-letter' ? text : JSON.stringify(analysis) }] } }] });
}

// Pure request construction and validation.
test('buildRequest creates an analysis envelope with CV text and JSON response mode', () => {
  const out = buildRequest({ type: 'cv-analysis', cvText: 'Nama: Ani', jobDescription: 'Frontend' });
  assert.equal(out.contents[0].role, 'user');
  assert.match(out.contents[0].parts[0].text, /Frontend/);
  assert.match(out.contents[0].parts[1].text, /DATA CV/);
  assert.equal(out.generationConfig.responseMimeType, 'application/json');
  assert.equal(out.generationConfig.temperature, 0.2);
});

test('buildRequest creates cover-letter envelope and uses optional target fields', () => {
  const out = buildRequest({ type: 'cover-letter', cvText: 'Ani, React developer', jobTitle: 'Engineer', companyName: 'PT Contoh', tone: 'Hangat' });
  assert.equal(out.generationConfig.responseMimeType, undefined);
  assert.equal(out.generationConfig.temperature, 0.3);
  assert.match(out.contents[0].parts[0].text, /PT Contoh/);
  assert.match(out.contents[0].parts[0].text, /Hangat/);
});

test('buildRequest accepts a real PDF base64 payload and emits inlineData', () => {
  const out = buildRequest({ type: 'cv-analysis', base64Pdf: PDF });
  assert.deepEqual(out.contents[0].parts[1], { inlineData: { mimeType: 'application/pdf', data: PDF } });
});

test('buildRequest rejects malformed PDF base64, wrong magic, and absent CV data', () => {
  assert.throws(() => buildRequest({ type: 'cv-analysis', base64Pdf: 'not-base64' }), /Encoding PDF|Berkas bukan PDF/);
  assert.throws(() => buildRequest({ type: 'cv-analysis', base64Pdf: Buffer.from('hello').toString('base64') }), /Berkas bukan PDF/);
  assert.throws(() => buildRequest({ type: 'cv-analysis' }), /wajib diisi/);
  assert.throws(() => buildRequest({ type: 'other', cvText: 'x' }), /Jenis permintaan/);
});

test('buildRequest enforces the decoded 3 MB PDF limit', () => {
  const oversized = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_PDF_BYTES)]).toString('base64');
  assert.throws(() => buildRequest({ type: 'cv-analysis', base64Pdf: oversized }), (error) => error.status === 413 && error.code === 'PAYLOAD_TOO_LARGE');
});

// Result parsing and schema guarantees.
test('parseResult returns the CV analysis schema, clamps and rounds score, and ignores thoughts', () => {
  const parsed = parseResult('cv-analysis', { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text: '```json\n' + JSON.stringify({ ...analysis, score: 120 }) + '\n```' }] } }] });
  assert.deepEqual(parsed, { score: 100, summary: analysis.summary, strengths: analysis.strengths, weaknesses: analysis.weaknesses, missing_keywords: analysis.missing_keywords, recommendations: analysis.recommendations, isFallback: false });
});

test('parseResult returns cover-letter text and rejects incomplete or invalid schemas', () => {
  assert.deepEqual(parseResult('cover-letter', { candidates: [{ content: { parts: [{ text: 'Surat lamaran kerja yang cukup panjang untuk lolos validasi isi.' }] } }] }), { text: 'Surat lamaran kerja yang cukup panjang untuk lolos validasi isi.', isFallback: false });
  assert.throws(() => parseResult('cv-analysis', { candidates: [{ content: { parts: [{ text: '{}' }] } }] }));
  assert.throws(() => parseResult('cover-letter', { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }] }));
});

// Handler protocol, security, and provider behavior.
test('handler accepts POST JSON only, returns envelope, no-store, and security headers', async () => {
  const calls = [];
  const result = await invoke({ type: 'cv-analysis', cvText: 'Ani' }, { fetchImpl: async (url, init) => { calls.push([url, init]); return upstreamFor('cv-analysis'); } });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json(), { ok: true, data: { ...analysis, isFallback: false } });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(result.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(calls.length, 1);
});

test('handler rejects non-POST and malformed or non-JSON bodies', async () => {
  const target = createHandler({ env: { GEMINI_API_KEY: 'x' }, fetchImpl: async () => { throw new Error('must not call'); } });
  for (const [method, expected] of [['GET', 405], ['PUT', 405]]) {
    const r = res(); await target({ method, headers: { host: 'app.test' } }, r); assert.equal(r.statusCode, expected); assert.equal(r.json().ok, false); assert.equal(r.headers.get('Cache-Control'), 'no-store');
  }
  for (const body of ['{bad', 42, null]) {
    const r = await invoke(body); assert.equal(r.statusCode, 400); assert.equal(r.json().ok, false);
  }
  const r = await invoke('{}', {}, { 'content-type': 'text/plain' });
  assert.equal(r.statusCode, 415);
});

test('handler rejects oversized envelopes before upstream and malformed content length', async () => {
  const r = await invoke(JSON.stringify({ type: 'cv-analysis', cvText: 'x' }), {}, { 'content-length': String(4_300_001) });
  assert.equal(r.statusCode, 413);
  const r2 = await invoke({ type: 'cv-analysis', cvText: 'x'.repeat(4_300_001) });
  assert.equal(r2.statusCode, 413);
});

test('handler uses only server GEMINI_API_KEY, never VITE fallback, and never puts key in URL', async () => {
  let seen;
  const r = await invoke({ type: 'cv-analysis', cvText: 'x' }, { env: { GEMINI_API_KEY: undefined, VITE_GEMINI_API_KEY: 'client-secret' }, fetchImpl: async (...args) => { seen = args; return upstreamFor('cv-analysis'); } });
  assert.equal(r.statusCode, 503); assert.equal(seen, undefined);
  const r2 = await invoke({ type: 'cv-analysis', cvText: 'x', model: 'attacker-model' }, { env: { GEMINI_API_KEY: 'server-secret', GEMINI_MODEL: 'server-model' }, fetchImpl: async (...args) => { seen = args; return upstreamFor('cv-analysis'); } });
  assert.equal(r2.statusCode, 200);
  assert.equal(new URL(seen[0]).search, ''); assert.match(seen[1].headers['x-goog-api-key'], /server-secret/); assert.equal(JSON.parse(seen[1].body).model, undefined); assert.match(seen[0], /server-model/);
});

test('handler blocks cross-site origins but allows same-host origin', async () => {
  assert.equal((await invoke({ type: 'cv-analysis', cvText: 'x' }, {}, { origin: 'https://evil.test' })).statusCode, 403);
  assert.equal((await invoke({ type: 'cv-analysis', cvText: 'x' }, {}, { origin: 'https://app.test' })).statusCode, 200);
  assert.equal((await invoke({ type: 'cv-analysis', cvText: 'x' }, {}, { 'sec-fetch-site': 'cross-site' })).statusCode, 403);
});

test('handler returns cover-letter success schema', async () => {
  const letter = 'Dengan hormat, saya mengajukan lamaran untuk posisi ini berdasarkan pengalaman relevan dan keterampilan yang sesuai dengan kebutuhan perusahaan.';
  const r = await invoke({ type: 'cover-letter', cvText: 'Ani' }, { fetchImpl: async () => upstreamFor('cover-letter', letter) });
  assert.deepEqual(r.json(), { ok: true, data: { text: letter, isFallback: false } });
});

test('handler fails over from 429 and 502 to the configured fallback model', async () => {
  const seen = [];
  const r = await invoke({ type: 'cv-analysis', cvText: 'x' }, { env: { GEMINI_MODEL: 'first', GEMINI_FALLBACK_MODEL: 'second' }, fetchImpl: async (url) => { seen.push(url); return response(seen.length === 1 ? 429 : 200, seen.length === 1 ? {} : { candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }] }); } });
  assert.equal(r.statusCode, 200); assert.match(seen[0], /first/); assert.match(seen[1], /second/);
  const r2 = await invoke({ type: 'cv-analysis', cvText: 'x' }, { fetchImpl: async () => response(502, {}) });
  assert.equal(r2.statusCode, 502); assert.equal(r2.json().error.code, 'UPSTREAM_ERROR');
});

test('handler times out connection attempts and stalled JSON bodies without leaking provider errors', async () => {
  let calls = 0;
  const r = await invoke({ type: 'cv-analysis', cvText: 'secret CV' }, { attemptTimeoutMs: 10, totalTimeoutMs: 15, fetchImpl: async () => { calls++; await new Promise(() => {}); } });
  assert.equal(r.statusCode, 504); assert.equal(r.json().error.code, 'UPSTREAM_TIMEOUT'); assert.doesNotMatch(r.body, /secret CV|generativelanguage|server-secret|provider failure/i); assert.ok(calls >= 1);
  const r2 = await invoke({ type: 'cv-analysis', cvText: 'x' }, { attemptTimeoutMs: 10, totalTimeoutMs: 15, fetchImpl: async () => ({ ok: true, status: 200, async json() { await new Promise(() => {}); } }) });
  assert.equal(r2.statusCode, 504);
});

test('handler caps total timeout across fallback attempts', async () => {
  const started = Date.now(); let calls = 0;
  const r = await invoke({ type: 'cv-analysis', cvText: 'x' }, { attemptTimeoutMs: 10, totalTimeoutMs: 15, fetchImpl: async () => { calls++; await new Promise(() => {}); } });
  const elapsed = Date.now() - started;
  assert.equal(r.statusCode, 504); assert.equal(r.json().error.code, 'UPSTREAM_TIMEOUT'); assert.ok(elapsed < 100, `elapsed ${elapsed}ms`); assert.ok(calls <= 2);
});

test('handler maps invalid upstream JSON and missing key to safe errors', async () => {
  const bad = await invoke({ type: 'cv-analysis', cvText: 'x' }, { fetchImpl: async () => response(200, {}, { json: false }) });
  assert.equal(bad.statusCode, 502); assert.equal(bad.json().error.code, 'UPSTREAM_ERROR');
  const missing = await invoke({ type: 'cv-analysis', cvText: 'x' }, { env: { GEMINI_API_KEY: '' } });
  assert.equal(missing.statusCode, 503); assert.equal(missing.json().error.code, 'SERVICE_UNAVAILABLE');
});
