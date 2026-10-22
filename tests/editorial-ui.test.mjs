import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const presentation = await import('../src/lib/jobPresentation.js');

test('presentasi gaji, tipe, deadline, tanggal, dan sumber memakai fallback faktual', () => {
  assert.equal(presentation.displaySalary(undefined), 'Tidak dicantumkan');
  assert.equal(presentation.displaySalary('-'), 'Tidak dicantumkan');
  assert.equal(presentation.displaySalary('Kompetitif'), 'Tidak dicantumkan');
  assert.equal(presentation.displaySalary('Rp 5.000.000'), 'Rp 5.000.000');
  assert.equal(presentation.displayJobType('Full Time'), 'Penuh waktu');
  assert.equal(presentation.displayJobType(''), 'Tidak dicantumkan');
  assert.equal(presentation.getConfirmedDeadline({ valid_through: '-' }), '');
  assert.equal(presentation.getConfirmedDeadline({ validThrough: '2026-12-31' }), '2026-12-31');
  assert.equal(presentation.displaySource({}), 'LokerResmi · detail lowongan');
  assert.equal(presentation.displaySource({ source_url: ' https://example.test/job ' }), 'https://example.test/job');
});

test('metadata yang dipresentasikan tetap berasal dari field jobs yang valid', async () => {
  const presentationSource = await read('src/lib/jobPresentation.js');
  const boardSource = await read('src/components/JobBoard.jsx');
  for (const field of ['valid_through', 'validThrough', 'deadline', 'source_url', 'created_at', 'date']) {
    assert.match(presentationSource, new RegExp(`\\b${field}\\b`), `field ${field} harus tetap didukung`);
  }
  for (const field of ['title', 'company', 'location', 'salary', 'type', 'created_at']) {
    assert.match(boardSource, new RegExp(`job\\.${field}\\b`), `field ${field} harus tetap ditampilkan dari jobs`);
  }
  for (const invented of ['evidence', 'fingerprint', 'verified_at']) {
    assert.doesNotMatch(`${presentationSource}\n${boardSource}`, new RegExp(`\\b${invented}\\b`));
  }
});

test('hero tidak memuat klaim inventori atau hasil seleksi yang tidak terverifikasi', async () => {
  const source = await read('src/components/JobBoard.jsx');
  assert.doesNotMatch(source, /\bribuan\b/i);
  assert.doesNotMatch(source, /\b95\s*%/i);
  assert.doesNotMatch(source, /meningkatkan peluang (lolos|diterima)/i);
  assert.match(source, /Data langsung dari inventori publik saat ini/i);
});

test('hero mempertahankan dua pencarian terpisah: posisi/perusahaan dan lokasi', async () => {
  const source = await read('src/components/JobBoard.jsx');
  const hero = source.slice(source.indexOf('const Hero'), source.indexOf('const StatsBar'));
  assert.equal((hero.match(/<input\b/g) || []).length, 2);
  assert.match(hero, /Posisi atau perusahaan/i);
  assert.match(hero, /Kota atau kabupaten/i);
  assert.match(hero, /setSearchTerm/);
  assert.match(hero, /setLocationTerm/);
});

test('daftar lowongan menjaga hierarki judul lalu perusahaan, metadata lokasi/tipe, kompensasi, dan tanggal', async () => {
  const source = await read('src/components/JobBoard.jsx');
  const feed = source.slice(source.indexOf('const JobFeed'), source.indexOf('const CVServicePromo'));
  for (const token of ['job.title', 'job.company', 'job.location', 'displayJobType', 'displaySalary', 'displayDeadline', 'displayDate']) {
    assert.ok(feed.includes(token), `daftar harus menampilkan ${token}`);
  }
  assert.ok(feed.indexOf('job.title') < feed.indexOf('job.company'), 'judul harus mendahului perusahaan');
  assert.match(feed, /filteredJobs\.length === 0/);
  assert.match(feed, /Tidak ada lowongan yang cocok|coba ubah|reset/i);
});

test('skeleton feed tetap satu kolom agar loading tidak mengubah hierarki editorial', async () => {
  const source = await read('src/components/LoadingSkeleton.jsx');
  const feed = source.slice(source.indexOf('JobFeedSkeleton'));
  assert.match(feed, /(?:grid-cols-1|flex-col)/);
  assert.doesNotMatch(feed, /(?:sm|md|lg|xl):grid-cols-\\d+/);
});

test('palet identitas Tailwind dan font Inter harus lokal, tanpa Google Fonts eksternal', async () => {
  const config = await read('tailwind.config.js');
  assert.match(config, /navy:\s*['"]#1E2B45['"]/i);
  assert.match(config, /teal:\s*['"]#0F766E['"]/i);

  const css = await read('src/index.css');
  assert.match(css, /@font-face/i);
  assert.match(css, /font-family:\s*['"]?Inter/i);
  assert.match(css, /url\(['"]?[^'"\n]+\.(?:woff2?|ttf|otf)/i);
  assert.doesNotMatch(`${config}\n${css}`, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);

  const localFont = ['public/fonts/inter-latin.woff2', 'public/fonts/Inter-Variable.woff2', 'public/Inter-Variable.woff2', 'src/assets/Inter-Variable.woff2']
    .some((file) => existsSync(path.join(root, file)));
  assert.equal(localFont, true, 'font Inter harus tersedia sebagai aset lokal');
});

test('instrumentasi GA tetap dipanggil melalui helper yang sudah ada', async () => {
  const board = await read('src/components/JobBoard.jsx');
  const analytics = await read('src/lib/analytics.js');
  assert.match(board, /import\s*\{[^}]*trackApply[^}]*trackEmployerInquiry[^}]*trackCVPackage/s);
  assert.match(board, /trackApply\s*\(/);
  assert.match(board, /trackEmployerInquiry\s*\(/);
  assert.match(board, /trackCVPackage\s*\(/);
  assert.match(analytics, /trackEvent\(['"]click_apply['"]/);
});
