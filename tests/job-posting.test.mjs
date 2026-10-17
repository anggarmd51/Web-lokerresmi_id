import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobPostingJsonLd } from '../src/lib/jobPosting.js';

const baseJob = {
  id: 'abc-123',
  title: 'Frontend Developer',
  company: 'PT Contoh',
  location: 'Jakarta, Indonesia',
  type: 'full-time',
  desc: 'Membangun aplikasi web.',
  requirements: 'Menguasai JavaScript',
  created_at: '2025-01-15T10:00:00Z',
  status: 'Aktif',
};

test('creates a complete JobPosting with stable URL and employer data', () => {
  const schema = createJobPostingJsonLd(baseJob);
  assert.equal(schema['@type'], 'JobPosting');
  assert.match(schema.description, /^<p>.*<\/p>/);
  assert.equal(schema.url, 'https://lokerresmi.vercel.app/lowongan/abc-123');
  assert.equal(schema['@id'], `${schema.url}#jobposting`);
  assert.equal(schema.identifier.value, 'abc-123');
  assert.equal(schema.title, baseJob.title);
  assert.equal(schema.hiringOrganization.name, baseJob.company);
  assert.equal(schema.datePosted, '2025-01-15T10:00:00.000Z');
  assert.equal(schema.employmentType, 'FULL_TIME');
  assert.equal(schema.validThrough, undefined);
  assert.equal(schema.directApply, undefined);
});

test('omits schema when required data is absent or status is not Aktif', () => {
  assert.equal(createJobPostingJsonLd({ ...baseJob, status: 'Tutup' }), null);
  assert.equal(createJobPostingJsonLd({ ...baseJob, id: null }), null);
  assert.equal(createJobPostingJsonLd({ ...baseJob, company: '' }), null);
  assert.equal(createJobPostingJsonLd({ ...baseJob, desc: '' }), null);
  assert.equal(createJobPostingJsonLd({ ...baseJob, location: '' }), null);
  assert.equal(createJobPostingJsonLd({ ...baseJob, created_at: 'not-a-date', date: undefined }), null);
});

test('omits expired jobs and preserves an actual future deadline', () => {
  const expired = createJobPostingJsonLd({ ...baseJob, validThrough: '2020-01-01T00:00:00Z' });
  assert.equal(expired, null);
  const future = '2099-03-04T00:00:00Z';
  const current = createJobPostingJsonLd({ ...baseJob, validThrough: future });
  assert.equal(current.validThrough, '2099-03-04T00:00:00.000Z');
});

test('marks Indonesia remote jobs as TELECOMMUTE without inventing a portal employer', () => {
  const schema = createJobPostingJsonLd({ ...baseJob, location: 'Remote - Indonesia', type: 'freelance' });
  assert.equal(schema.jobLocationType, 'TELECOMMUTE');
  assert.deepEqual(schema.applicantLocationRequirements, { '@type': 'Country', name: 'Indonesia' });
  assert.equal(schema.employmentType, 'OTHER');
  assert.equal(schema.hiringOrganization.sameAs, undefined);
  assert.equal(schema.hiringOrganization.logo, undefined);
});

test('does not mark hybrid jobs as TELECOMMUTE', () => {
  const schema = createJobPostingJsonLd({ ...baseJob, location: 'Hybrid, Jakarta, Indonesia', type: 'part-time' });
  assert.equal(schema.jobLocationType, undefined);
  assert.equal(schema.applicantLocationRequirements, undefined);
  assert.equal(schema.jobLocation.address.addressLocality, 'Hybrid, Jakarta, Indonesia');
  assert.equal(schema.employmentType, 'PART_TIME');
});

test('omits remote-only jobs without an explicit country instead of fabricating applicant scope', () => {
  assert.equal(createJobPostingJsonLd({ ...baseJob, location: 'Remote' }), null);
});

test('escapes description and requirements as HTML', () => {
  const schema = createJobPostingJsonLd({ ...baseJob, desc: '<script>alert("x")</script> & aman', requirements: "<img src=x onerror='bad'>" });
  assert.match(schema.description, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; aman/);
  assert.match(schema.description, /&lt;img src=x onerror=&#39;bad&#39;&gt;/);
  assert.doesNotMatch(schema.description, /<script|<img/);
});

test('uses date when created_at is unavailable and never uses the current day as a fallback', () => {
  const schema = createJobPostingJsonLd({ ...baseJob, created_at: null, date: '2024-06-07' });
  assert.equal(schema.datePosted, '2024-06-07T00:00:00.000Z');
  assert.equal(createJobPostingJsonLd({ ...baseJob, created_at: null, date: null }), null);
});
