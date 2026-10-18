import test from 'node:test';
import assert from 'node:assert/strict';
import { filterJobsForLanding, getLandingPage, isFreshGraduateJob, matchesLandingJob } from '../src/lib/landingPages.js';
import { readJobRoute } from '../src/lib/seo.js';

const active = (overrides = {}) => ({ status: 'Aktif', location: 'Medan', category: 'Administrasi', ...overrides });

test('landing routes are explicit and crawlable', () => {
  for (const path of ['/lowongan-kerja/medan', '/lowongan-admin/medan', '/lowongan-fresh-graduate']) {
    const route = readJobRoute({ pathname: path, hash: '' });
    assert.equal(route.isLanding, true);
    assert.equal(route.invalid, false);
    assert.equal(route.landing.path, path);
    assert.equal(getLandingPage(`${path}/`).path, path);
  }
});

test('matching requires Medan city/category and active status', () => {
  const medan = getLandingPage('/lowongan-kerja/medan');
  const admin = getLandingPage('/lowongan-admin/medan');
  assert.equal(matchesLandingJob(active(), medan), true);
  assert.equal(matchesLandingJob(active({ location: 'Medan, Sumatera Utara, Indonesia' }), medan), true);
  assert.equal(matchesLandingJob(active({ location: 'Jakarta; Medan, Indonesia' }), medan), true);
  assert.equal(matchesLandingJob(active({ location: 'Medan Barat' }), medan), false);
  assert.equal(matchesLandingJob(active({ status: 'Draft' }), medan), false);
  assert.equal(matchesLandingJob(active({ category: 'IT & Software' }), admin), false);
});

test('fresh graduate landing accepts explicit evidence but rejects negated evidence', () => {
  const landing = getLandingPage('/lowongan-fresh-graduate');
  assert.equal(isFreshGraduateJob(active({ title: 'Admin Fresh Graduate' })), true);
  assert.equal(isFreshGraduateJob(active({ requirements: ['Fresh graduate dipersilakan'] })), true);
  assert.equal(isFreshGraduateJob(active({ desc: 'Tidak menerima fresh graduate' })), false);
  assert.equal(matchesLandingJob(active({ desc: 'Pengalaman minimal 1 tahun' }), landing), false);
  assert.equal(matchesLandingJob(active({ desc: 'Fresh graduate dipersilakan' }), landing), true);
  assert.equal(filterJobsForLanding([active({ desc: 'Fresh graduate dipersilakan' }), active()], landing).length, 1);
});
