import test from 'node:test';
import assert from 'node:assert/strict';
import { getLandingPage, getLandingPagesForJobs, filterJobsForLanding } from '../src/lib/landingPages.js';
import { renderSitemap } from '../api/sitemap.js';
import { createJobPostingJsonLd } from '../src/lib/jobPosting.js';
const job = (overrides = {}) => ({ id: 100, title: 'Admin', company: 'Employer', status: 'Aktif', desc: 'Uraian tugas dari employer.', location: 'Surabaya, Indonesia', category: 'Administrasi', type: 'Full Time', date_posted: '2026-01-01', valid_through: '2099-01-01T00:00:00Z', ...overrides });
test('50 verified active rows automatically produce details and location/category landings', () => {
  const rows = Array.from({ length: 50 }, (_, i) => job({ id: 100 + i }));
  const xml = renderSitemap(rows);
  assert.equal((xml.match(/\/lowongan\/\d+/g) || []).length, 50);
  assert.match(xml, /\/lowongan-kerja\/surabaya/);
  assert.match(xml, /\/lowongan-admin\/surabaya/);
  assert.equal(filterJobsForLanding(rows, getLandingPage('/lowongan-admin/surabaya')).length, 50);
});
test('dynamic landings preserve explicit multiple locations and category matching', () => {
  const rows = [job({ location: 'Bandung; Yogyakarta', category: 'IT & Software' })];
  const paths = getLandingPagesForJobs(rows).map(page => page.path);
  assert.ok(paths.includes('/lowongan-kerja/bandung'));
  assert.ok(paths.includes('/lowongan-it/yogyakarta'));
  assert.ok(!paths.includes('/lowongan-admin/yogyakarta'));
  assert.equal(filterJobsForLanding(rows, getLandingPage('/lowongan-admin/bandung')).length, 0);
  assert.equal(getLandingPage('/lowongan-kerja/remote-indonesia'), null);
  assert.ok(!getLandingPagesForJobs([job({ location: 'Remote - Indonesia' })]).some(page => page.path.includes('remote')));
});
test('incomplete and expired rows have no JobPosting and are excluded from sitemap detail URLs', () => {
  const rows = [job({ id: 46, desc: '' }), job({ id: 47, location: 'Remote' }), job({ id: 98, valid_through: '2020-01-01T00:00:00Z' }), job({ id: 99, status: 'Menunggu Persetujuan' })];
  for (const row of rows) assert.equal(createJobPostingJsonLd(row), null);
  assert.doesNotMatch(renderSitemap(rows), /\/lowongan\/(46|47|98|99)</);
});
