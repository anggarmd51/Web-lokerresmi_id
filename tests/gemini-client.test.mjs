import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestGemini } from '../src/lib/gemini.js';

const response = (body, init = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
  ...init,
});

test('requestGemini mengembalikan data sukses', async () => {
  const data = await requestGemini({ type: 'cv-analysis' }, {
    fetchImpl: async (url, options) => {
      assert.equal(url, '/api/gemini');
      assert.equal(options.method, 'POST');
      return response({ ok: true, data: { score: 88, isFallback: false } });
    },
  });
  assert.deepEqual(data, { score: 88, isFallback: false });
});

test('requestGemini meneruskan kode dan pesan error server', async () => {
  await assert.rejects(
    requestGemini({}, { fetchImpl: async () => response({ ok: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan.' } }, { status: 429 }) }),
    (error) => error.code === 'RATE_LIMITED' && error.message === 'Terlalu banyak permintaan.' && error.status === 429,
  );
});

test('requestGemini menolak JSON invalid', async () => {
  await assert.rejects(
    requestGemini({}, { fetchImpl: async () => new Response('not-json', { status: 200 }) }),
    (error) => error.code === 'INVALID_JSON',
  );
});

test('requestGemini timeout saat response body macet', async () => {
  const fetchImpl = async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) { setTimeout(() => controller.enqueue(new TextEncoder().encode('{"ok":')), 30); },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  await assert.rejects(
    requestGemini({}, { fetchImpl, timeoutMs: 10 }),
    (error) => error.code === 'TIMEOUT',
  );
});

test('source guard: kunci Gemini dan URL provider tidak ada di frontend', async () => {
  const [cv, cover, vite] = await Promise.all([
    readFile(new URL('../src/components/AICVCheckerModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AICoverLetterModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
  ]);
  for (const source of [cv, cover, vite]) {
    assert.doesNotMatch(source, /VITE_GEMINI_API_KEY|generativelanguage\.googleapis\.com/);
  }
});
