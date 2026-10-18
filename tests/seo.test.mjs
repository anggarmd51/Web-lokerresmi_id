import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SITE_URL, jobPath, jobUrl, readJobRoute, updatePageMetadata } from '../src/lib/seo.js';

function mockDocument() {
  const tags = [];
  return {
    title: '',
    createElement(tagName) {
      return { tagName, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
    },
    head: {
      appendChild(tag) { tags.push(tag); },
      querySelector(selector) {
        const [, tagName, key, value] = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]$/);
        return tags.find((tag) => tag.tagName === tagName && tag.attributes[key] === value) || null;
      },
    },
    tags,
  };
}
const location = (pathname, hash = '') => ({ pathname, hash });

test('URL detail menggunakan host canonical dan ID di-encode', () => {
  assert.equal(SITE_URL, 'https://lokerresmi.vercel.app');
  assert.equal(jobPath(42), '/lowongan/42');
  assert.equal(jobUrl('a&b'), `${SITE_URL}/lowongan/a%26b`);
});

test('parser menerima detail, trailing slash dan tautan lama; menolak path rusak', () => {
  assert.equal(readJobRoute(location('/lowongan/42')).id, '42');
  assert.equal(readJobRoute(location('/lowongan/42/')).id, '42');
  assert.equal(readJobRoute(location('/', '#job-42')).legacy, true);
  assert.equal(readJobRoute(location('/')).isDetail, false);
  for (const path of ['/lowongan/', '/lowongan/a/b', '/lowongan/%ZZ', '/lowongan/a%2Fb', '/unknown']) {
    assert.equal(readJobRoute(location(path)).invalid, true, path);
  }
});

test('metadata satu job konsisten dan kembali ke homepage tanpa duplikasi tag', () => {
  globalThis.document = mockDocument();
  try {
    const job = { id: 42, title: 'Developer', company: 'PT Contoh', desc: 'Deskripsi lengkap', location: 'Jakarta', status: 'Aktif', created_at: '2026-01-01T00:00:00Z' };
    updatePageMetadata(job, readJobRoute(location('/lowongan/42')));
    const get = (selector, attr) => document.head.querySelector(selector).attributes[attr];
    assert.equal(get('link[rel="canonical"]', 'href'), jobUrl(42));
    for (const selector of ['meta[property="og:url"]', 'meta[name="twitter:url"]']) {
      assert.equal(get(selector, 'content'), jobUrl(42));
    }
    assert.equal(get('meta[property="og:image"]', 'content'), `${SITE_URL}/logo_og.png`);
    assert.equal(get('meta[name="robots"]', 'content'), 'index,follow');
    assert.match(document.title, /Developer/);
    const count = document.tags.length;
    updatePageMetadata(null, readJobRoute(location('/')));
    assert.equal(get('link[rel="canonical"]', 'href'), `${SITE_URL}/`);
    assert.equal(get('meta[property="og:url"]', 'content'), `${SITE_URL}/`);
    assert.doesNotMatch(document.title, /Developer/);
    assert.equal(document.tags.length, count);
  } finally { delete globalThis.document; }
});

test('detail hilang, belum dimuat, dan path tidak dikenal tidak diindeks', () => {
  globalThis.document = mockDocument();
  try {
    for (const path of ['/lowongan/404', '/unknown']) {
      updatePageMetadata(null, readJobRoute(location(path)));
      assert.equal(document.head.querySelector('meta[name="robots"]').attributes.content, 'noindex,follow');
      assert.match(document.title, /tidak ditemukan/);
    }
  } finally { delete globalThis.document; }
});

test('HTML awal dan share tidak memakai host lama atau hash job sebagai URL baru', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /https:\/\/lokerresmi\.id/);
  assert.match(html, /rel="canonical" href="https:\/\/lokerresmi\.vercel\.app\/"/);
  const share = readFileSync(new URL('../src/components/QuickShareButton.jsx', import.meta.url), 'utf8');
  assert.match(share, /const currentUrl = jobUrl\(job.id\)/);
  assert.doesNotMatch(share, /#job-/);
});

test('detail dengan deskripsi kosong atau negara remote tidak jelas diberi noindex', () => {
  globalThis.document = mockDocument();
  try {
    for (const job of [
      { id: 46, title: 'Sales Freelance', company: 'Employer', status: 'Aktif', desc: '', location: 'Medan', created_at: '2026-01-01T00:00:00Z' },
      { id: 47, title: 'Network Architect', company: 'Employer', status: 'Aktif', desc: 'Uraian pekerjaan.', location: 'Remote', created_at: '2026-01-01T00:00:00Z' },
    ]) {
      updatePageMetadata(job, readJobRoute(location(`/lowongan/${job.id}`)));
      assert.equal(document.head.querySelector('meta[name="robots"]').attributes.content, 'noindex,follow');
    }
  } finally { delete globalThis.document; }
});
