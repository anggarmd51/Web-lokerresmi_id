import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { renderJobHtml, fetchJob } from '../api/job-detail.js';

const template = '<!doctype html><html><head><title>Home</title><meta name="description" content="home"><meta name="robots" content="index,follow"><link rel="canonical" href="https://lokerresmi.vercel.app/"><meta property="og:title" content="Home"><meta property="og:description" content="home"><meta property="og:url" content="https://lokerresmi.vercel.app/"><meta name="twitter:title" content="Home"><meta name="twitter:description" content="home"><meta name="twitter:url" content="https://lokerresmi.vercel.app/"></head><body><div id="root"></div></body></html>';
const eligible = { id: 'x-1', title: 'Engineer <Senior>', company: 'PT "A&B"', desc: 'Build <safe> systems', location: 'Jakarta', status: 'Aktif', created_at: '2026-01-01T00:00:00Z' };

function responseMock() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } };
}

test('detail HTML has canonical, meaningful H1/description, and escapes untrusted fields', () => {
  const html = renderJobHtml(template, eligible);
  assert.match(html, /<h1[^>]*>Engineer &lt;Senior&gt;<\/h1>/);
  assert.match(html, /Build &lt;safe&gt; systems/);
  assert.match(html, /<title>Engineer &lt;Senior&gt; \| PT &quot;A&amp;B&quot; - Lokerresmi\.id<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/lokerresmi\.vercel\.app\/lowongan\/x-1"/);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.match(html, /<div id="root" data-job-id="x-1"><main/);
  assert.equal((html.match(/id="lokerresmi-google-jobs-schema"/g) || []).length, 1);
  assert.doesNotMatch(html, /<script>alert/);
});

test('HTML replacement callbacks preserve dollar sequences in untrusted metadata', () => {
  const html = renderJobHtml(template, { ...eligible, title: '$& $1 $` $\'', company: 'C$&' });
  assert.match(html, /<title>\$&amp; \$1 \$` \$&#39; \| C\$&amp; - Lokerresmi\.id<\/title>/);
});

test('incomplete job is rendered noindex and inactive/missing responses are no-store', async () => {
  const incomplete = { ...eligible, desc: '' };
  assert.match(renderJobHtml(template, incomplete), /name="robots" content="noindex,follow"/);
  const fetchImpl = async () => ({ ok: true, async json() { return []; } });
  assert.equal(await fetchJob(fetchImpl, 'https://project.supabase.co', 'anon', 'missing'), null);
});

test('HTTP 404 and 503 detail responses are explicitly no-store', async () => {
  const notFound = responseMock();
  await handler({ url: '/lowongan/x-1' }, notFound);
  assert.equal(notFound.statusCode, 503);
  assert.equal(notFound.headers['Cache-Control'], 'no-store');
  const malformed = responseMock();
  await handler({ url: '/lowongan/a/b' }, malformed);
  assert.equal(malformed.statusCode, 404);
  assert.equal(malformed.headers['Cache-Control'], 'no-store');
});

test('detail handler accepts both pretty-path and rewritten query requests', async () => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  const requested = [];
  process.env.VITE_SUPABASE_URL = 'https://project.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon';
  globalThis.fetch = async (url) => {
    requested.push(new URL(url).searchParams.get('id'));
    return { ok: true, async json() { return [{ ...eligible }]; } };
  };
  try {
    for (const request of [{ url: '/lowongan/x-1' }, { url: '/api/job-detail.js?id=x-1' }]) {
      const response = responseMock();
      await handler(request, response);
      assert.equal(response.statusCode, 200);
      assert.match(response.body, /data-job-id="x-1"/);
    }
    assert.deepEqual(requested, ['eq.x-1', 'eq.x-1']);
  } finally {
    process.env = previousEnv;
    globalThis.fetch = previousFetch;
  }
});

test('valid detail loading metadata remains indexable on the client', async () => {
  const tags = [];
  globalThis.document = { title: '', createElement: (tagName) => ({ tagName, attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } }), head: { appendChild(tag) { tags.push(tag); }, querySelector(selector) { const match = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]$/); return match ? tags.find((tag) => tag.tagName === match[1] && tag.attributes[match[2]] === match[3]) || null : null; } } };
  const { updatePageMetadata, readJobRoute } = await import('../src/lib/seo.js');
  updatePageMetadata(null, readJobRoute({ pathname: '/lowongan/x-1', hash: '' }), { loading: true });
  assert.equal(document.head.querySelector('meta[name="robots"]').attributes.content, 'index,follow');
  delete globalThis.document;
});
