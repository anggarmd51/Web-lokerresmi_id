import assert from 'node:assert/strict';
import test from 'node:test';
import { createHandler } from '../api/gemini.js';

const analysis = {
  score: 88,
  summary: 'Ringkasan valid untuk pengujian.',
  strengths: ['JavaScript'],
  weaknesses: ['Bahasa'],
  missing_keywords: ['Docker'],
  recommendations: ['Tambahkan proyek'],
};

function upstream(status, body = {}, headers = {}) {
  const map = new Map(Object.entries(headers));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return map.get(name) ?? map.get(name.toLowerCase()) ?? null; } },
    async json() { return body; },
  };
}

function success() {
  return upstream(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(analysis) }] } }] });
}

function response() {
  const headers = new Map();
  return {
    headers,
    statusCode: undefined,
    body: undefined,
    setHeader(name, value) { headers.set(name, value); },
    end(body) { this.body = body; },
    json() { return JSON.parse(this.body); },
  };
}

function request(body, headers = {}) {
  return {
    method: 'POST',
    headers: { host: 'app.test', 'content-type': 'application/json', ...headers },
    body,
  };
}

async function invoke(body = { type: 'cv-analysis', cvText: 'CV rahasia' }, options = {}, headers = {}) {
  const result = response();
  const handler = createHandler({
    env: { GEMINI_API_KEY: 'server-secret', ...options.env },
    fetchImpl: options.fetchImpl ?? (async () => success()),
    sleepImpl: options.sleepImpl,
    attemptTimeoutMs: options.attemptTimeoutMs ?? 100,
    totalTimeoutMs: options.totalTimeoutMs ?? 5000,
  });
  await handler(request(body, headers), result);
  return result;
}

for (const [status, code] of [[400, 'UPSTREAM_INVALID_REQUEST'], [401, 'UPSTREAM_AUTH_ERROR'], [403, 'UPSTREAM_AUTH_ERROR']]) {
  test(`${status} is terminal, safe, and does not fall back`, async () => {
    let calls = 0;
    const result = await invoke(undefined, {
      env: { GEMINI_MODEL: 'primary', GEMINI_FALLBACK_MODEL: 'fallback' },
      fetchImpl: async () => { calls += 1; return upstream(status, { provider_secret: 'do-not-leak' }); },
    });
    assert.equal(result.statusCode, status === 400 ? 422 : 503);
    assert.equal(result.json().error.code, code);
    assert.equal(calls, 1);
    assert.doesNotMatch(result.body, /provider_secret|server-secret|generativelanguage/i);
  });
}

test('404 skips retry on the unavailable model and falls back', async () => {
  const urls = [];
  const result = await invoke(undefined, {
    env: { GEMINI_MODEL: 'primary', GEMINI_FALLBACK_MODEL: 'fallback' },
    fetchImpl: async (url) => {
      urls.push(url);
      return urls.length === 1 ? upstream(404, { detail: 'private provider detail' }) : success();
    },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().ok, true);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /primary/);
  assert.match(urls[1], /fallback/);
});

test('429 with Retry-After above the retry limit is terminal and preserves the header', async () => {
  let calls = 0;
  const result = await invoke(undefined, {
    env: { GEMINI_MODEL: 'primary', GEMINI_FALLBACK_MODEL: 'fallback' },
    fetchImpl: async () => { calls += 1; return upstream(429, { detail: 'rate detail' }, { 'Retry-After': '3' }); },
    sleepImpl: async () => { throw new Error('must not sleep'); },
  });
  assert.equal(result.statusCode, 429);
  assert.equal(result.json().error.code, 'RATE_LIMITED');
  assert.equal(result.headers.get('Retry-After'), '3');
  assert.equal(calls, 1);
});

test('429 with zero Retry-After retries the same model once and can succeed', async () => {
  const urls = [];
  const sleeps = [];
  const result = await invoke(undefined, {
    env: { GEMINI_MODEL: 'primary', GEMINI_FALLBACK_MODEL: 'fallback' },
    fetchImpl: async (url) => {
      urls.push(url);
      return urls.length === 1 ? upstream(429, {}, { 'Retry-After': '0' }) : success();
    },
    sleepImpl: async (ms) => { sleeps.push(ms); },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], urls[1]);
  assert.deepEqual(sleeps, [100]);
});

test('CV requests include a strict responseSchema with all required fields', async () => {
  let payload;
  const result = await invoke(undefined, { fetchImpl: async (_url, init) => { payload = JSON.parse(init.body); return success(); } });
  assert.equal(result.statusCode, 200);
  const schema = payload.generationConfig.responseSchema;
  assert.equal(schema.type, 'OBJECT');
  assert.deepEqual(new Set(schema.required), new Set(['score', 'summary', 'strengths', 'weaknesses', 'missing_keywords', 'recommendations']));
  assert.equal(schema.properties.score.type, 'INTEGER');
  for (const field of ['strengths', 'weaknesses', 'missing_keywords', 'recommendations']) {
    assert.equal(schema.properties[field].type, 'ARRAY');
    assert.equal(schema.properties[field].items.type, 'STRING');
  }
});

test('empty candidates are invalid upstream responses and diagnostics are redacted', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const result = await invoke({ type: 'cv-analysis', cvText: 'TOP SECRET CV' }, {
      fetchImpl: async () => upstream(200, { candidates: [], provider_token: 'super-secret-token' }),
    });
    assert.equal(result.statusCode, 502);
    assert.equal(result.json().error.code, 'UPSTREAM_INVALID_RESPONSE');
    assert.doesNotMatch(result.body, /TOP SECRET CV|super-secret-token|server-secret|provider_token/i);
    assert.ok(warnings.every((entry) => !entry.join(' ').match(/super-secret-token|TOP SECRET CV|provider_token/i)));
  } finally {
    console.warn = originalWarn;
  }
});

test('transient upstream failures never exceed three total attempts', async () => {
  let calls = 0;
  const result = await invoke(undefined, {
    env: { GEMINI_MODEL: 'primary', GEMINI_FALLBACK_MODEL: 'fallback' },
    fetchImpl: async () => { calls += 1; return upstream(500, { secret: 'provider failure' }); },
    sleepImpl: async () => {},
  });
  assert.equal(result.statusCode, 502);
  assert.equal(result.json().error.code, 'UPSTREAM_ERROR');
  assert.equal(calls, 3);
});
