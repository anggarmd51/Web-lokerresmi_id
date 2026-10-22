import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJobPostingJsonLd } from '../src/lib/jobPosting.js';
import { renderJobHtml } from '../api/job-detail.js';
import { renderSitemap } from '../api/sitemap.js';
import { readJobRoute, updatePageMetadata } from '../src/lib/seo.js';

// Content supplied by the owner; dates/employers/requirements retain stored production values.
// Country is explicit in location because the jobs table has no separate country column.
const jobs = JSON.parse(readFileSync(new URL('./fixtures/jobs-46-47.json', import.meta.url), 'utf8'));
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

for (const job of jobs) {
  test(`completed job ${job.id} emits indexable self-canonical HTML, JSON-LD and sitemap URL`, () => {
    const schema = createJobPostingJsonLd(job);
    const url = `https://lokerresmi.vercel.app/lowongan/${job.id}`;
    assert.ok(schema);
    assert.equal(schema.url, url);
    assert.equal(schema.title, job.title);
    assert.ok(schema.description.includes(job.desc));
    assert.equal(schema.hiringOrganization.name, job.company);
    assert.equal(schema.datePosted, new Date(job.created_at).toISOString());
    assert.equal(job.date_posted, null);
    assert.equal(schema.validThrough, job.valid_through ? new Date(job.valid_through).toISOString() : undefined);
    const html = renderJobHtml(template, job);
    assert.match(html, /name="robots" content="index,follow"/);
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    const embedded = JSON.parse(html.match(/<script id="lokerresmi-google-jobs-schema" type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.deepEqual(embedded, schema);
    assert.ok(renderSitemap(jobs).includes(`<loc>${url}</loc>`));
  });

  test(`completed job ${job.id} remains indexable after client metadata update`, () => {
    const previous = globalThis.document;
    const tags = [];
    globalThis.document = {
      title: '',
      createElement: (tagName) => ({ tagName, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }),
      head: {
        appendChild(tag) { tags.push(tag); },
        querySelector(selector) {
          const match = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]$/);
          return match ? tags.find((tag) => tag.tagName === match[1] && tag.attributes[match[2]] === match[3]) || null : null;
        },
      },
    };
    try {
      updatePageMetadata(job, readJobRoute({ pathname: `/lowongan/${job.id}`, hash: '' }));
      assert.equal(document.head.querySelector('meta[name="robots"]').attributes.content, 'index,follow');
      assert.equal(document.head.querySelector('link[rel="canonical"]').attributes.href, `https://lokerresmi.vercel.app/lowongan/${job.id}`);
    } finally {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    }
  });
}

test('owner-supplied employment types and Indonesia applicant scope are retained', () => {
  const sales = createJobPostingJsonLd(jobs[0]);
  assert.deepEqual(sales.employmentType, ['PART_TIME', 'OTHER']);
  assert.equal(sales.jobLocation.address.addressCountry, 'ID');
  assert.equal(sales.jobLocation.address.addressLocality, 'Medan, Sumatera Utara, Indonesia');
  assert.equal(sales.datePosted, '2026-09-10T08:46:48.970Z');
  assert.equal(sales.validThrough, undefined);
  const network = createJobPostingJsonLd(jobs[1]);
  assert.equal(network.employmentType, 'FULL_TIME');
  assert.equal(network.jobLocationType, 'TELECOMMUTE');
  assert.deepEqual(network.applicantLocationRequirements, { '@type': 'Country', name: 'Indonesia' });
  assert.equal(network.datePosted, '2026-10-10T20:30:16.334Z');
  assert.equal(network.validThrough, '2026-12-31T16:59:59.000Z');
});
