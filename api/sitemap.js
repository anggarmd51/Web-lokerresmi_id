import { SITE_URL, jobPath } from '../src/lib/seo.js';
import { LANDING_PAGES, filterJobsForLanding } from '../src/lib/landingPages.js';
const PAGE_SIZE = 1000;
// One sitemap supports at most 50,000 URLs, including the homepage.
const MAX_PAGES = 50;
const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function validLastmod(value) {
  if (value === null || value === undefined || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-').map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function sitemapUrl(path, lastmod) {
  const lastmodXml = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
  return `  <url>\n    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>${lastmodXml}\n  </url>`;
}

function renderSitemap(jobs) {
  const urls = [sitemapUrl('/')];
  for (const job of jobs) {
    if (!job || job.id === null || job.id === undefined) continue;
    urls.push(sitemapUrl(jobPath(job.id), validLastmod(job.created_at)));
  }
  for (const landing of Object.values(LANDING_PAGES)) {
    if (filterJobsForLanding(jobs, landing).length) urls.push(sitemapUrl(landing.path));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function errorSitemap() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
}

async function fetchActiveJobs(fetchImpl, supabaseUrl, anonKey) {
  const endpoint = new URL('/rest/v1/jobs', `${supabaseUrl.replace(/\/+$/, '')}/`);
  endpoint.searchParams.set('select', 'id,created_at,status,location,category,title,desc,requirements');
  endpoint.searchParams.set('status', 'eq.Aktif');
  endpoint.searchParams.set('order', 'id.asc');
  const jobs = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    endpoint.searchParams.set('limit', String(PAGE_SIZE));
    endpoint.searchParams.set('offset', String(page * PAGE_SIZE));
    const response = await fetchImpl(endpoint, {
      signal: AbortSignal.timeout(10000),
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
    });
    if (!response || !response.ok) {
      throw new Error(`Supabase sitemap request failed (${response?.status ?? 'unknown'})`);
    }
    const pageRows = await response.json();
    if (!Array.isArray(pageRows)) throw new Error('Supabase returned invalid sitemap data');
    jobs.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return jobs;
  }

  throw new Error(`Supabase sitemap pagination exceeded ${MAX_PAGES} pages`);
}

export default async function handler(request, response) {
  try {
    const env = globalThis.process?.env ?? {};
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error('Supabase public environment is not configured');

    const jobs = await fetchActiveJobs(globalThis.fetch, supabaseUrl, anonKey);
    response.statusCode = 200;
    response.setHeader('Content-Type', XML_CONTENT_TYPE);
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
    response.end(renderSitemap(jobs));
  } catch (error) {
    console.error('[sitemap] unable to build sitemap:', error);
    response.statusCode = 503;
    response.setHeader('Content-Type', XML_CONTENT_TYPE);
    response.setHeader('Cache-Control', 'no-store');
    response.end(errorSitemap());
  }
}

export { SITE_URL, PAGE_SIZE, MAX_PAGES, escapeXml, validLastmod, renderSitemap, fetchActiveJobs };
