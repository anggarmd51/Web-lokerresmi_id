import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SITE_URL, jobUrl } from '../src/lib/jobUrls.js';
import { createJobPostingJsonLd } from '../src/lib/jobPosting.js';

const API_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(API_DIR, '..', 'dist', 'index.html');
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const JOB_SELECT = 'id,created_at,date_posted,valid_through,status,location,category,title,company,type,desc,requirements,salary';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('. ');
  return value == null ? '' : String(value);
}

function plainDescription(job) {
  return [job.title, job.company, job.location, job.salary, job.desc]
    .map(text).map((value) => value.trim()).filter(Boolean).join(' • ').slice(0, 300);
}

function replaceMeta(html, selector, content) {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`(<meta\\s+[^>]*${selector}[^>]*content=")[^"]*("[^>]*>)`, 'i');
  if (pattern.test(html)) return html.replace(pattern, (_match, prefix, suffix) => `${prefix}${escaped}${suffix}`);
  return html.replace('</head>', () => `<meta ${selector} content="${escaped}" />\n  </head>`);
}

function replaceLink(html, href) {
  const escaped = escapeHtml(href);
  const pattern = /(<link\s+[^>]*rel="canonical"[^>]*href=")[^"]*("[^>]*>)/i;
  return pattern.test(html)
    ? html.replace(pattern, (_match, prefix, suffix) => `${prefix}${escaped}${suffix}`)
    : html.replace('</head>', () => `<link rel="canonical" href="${escaped}" />\n  </head>`);
}

export function renderJobHtml(template, job, { eligible = Boolean(createJobPostingJsonLd(job)) } = {}) {
  const url = jobUrl(job.id);
  const title = `${text(job.title)} | ${text(job.company)} - Lokerresmi.id`;
  const description = plainDescription(job) || 'Lihat detail lowongan di Lokerresmi.id.';
  const robots = eligible ? 'index,follow' : 'noindex,follow';
  const intro = `<main id="job-detail" class="editorial-container mx-auto max-w-4xl px-4 py-12"><p class="text-sm font-bold uppercase tracking-wide text-teal">Detail lowongan</p><h1 class="mt-3 text-3xl font-extrabold text-navy">${escapeHtml(text(job.title))}</h1><p class="mt-2 text-lg font-semibold text-slate-700">${escapeHtml(text(job.company))}</p><p class="mt-4 text-slate-600">${escapeHtml(text(job.desc))}</p><p class="mt-3 text-sm text-slate-500">${escapeHtml(text(job.location))}</p></main>`;
  let html = template.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'name="description"', description);
  html = replaceMeta(html, 'name="robots"', robots);
  html = replaceMeta(html, 'property="og:title"', title);
  html = replaceMeta(html, 'property="og:description"', description);
  html = replaceMeta(html, 'property="og:url"', url);
  html = replaceMeta(html, 'name="twitter:title"', title);
  html = replaceMeta(html, 'name="twitter:description"', description);
  html = replaceMeta(html, 'name="twitter:url"', url);
  html = replaceLink(html, url);
  const schema = eligible ? `<script id="lokerresmi-google-jobs-schema" type="application/ld+json">${JSON.stringify(createJobPostingJsonLd(job)).replace(/</g, '\\u003c')}</script>` : '';
  const root = `<div id="root" data-job-id="${escapeHtml(job.id)}">${intro}</div>`;
  html = html.replace('<div id="root"></div>', () => root);
  if (schema) html = html.replace('</head>', () => `${schema}\n  </head>`);
  return html;
}

export async function fetchJob(fetchImpl, supabaseUrl, anonKey, id) {
  const endpoint = new URL('/rest/v1/jobs', `${supabaseUrl.replace(/\/+$/, '')}/`);
  endpoint.searchParams.set('select', JOB_SELECT);
  endpoint.searchParams.set('id', `eq.${id}`);
  endpoint.searchParams.set('status', 'eq.Aktif');
  endpoint.searchParams.set('limit', '1');
  const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(10000), headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' } });
  if (!response?.ok) throw new Error(`Supabase job request failed (${response?.status ?? 'unknown'})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Supabase returned invalid job data');
  return rows[0] || null;
}

function send(response, statusCode, body, cache = 'no-store') {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', HTML_CONTENT_TYPE);
  response.setHeader('Cache-Control', cache);
  response.end(body);
}

export default async function handler(request, response) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const path = requestUrl.pathname;
  const match = path.match(/^\/lowongan\/([^/]+)\/?$/);
  const queryId = request?.query?.id ?? requestUrl.searchParams.get('id');
  const rawId = match?.[1] ?? (Array.isArray(queryId) ? queryId[0] : queryId);
  if (!rawId) return send(response, 404, '<!doctype html><title>404</title><h1>Not found</h1>');
  try {
    const env = globalThis.process?.env ?? {};
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error('Supabase public environment is not configured');
    const id = decodeURIComponent(String(rawId));
    if (!id || /[/\\\s]/.test(id)) return send(response, 404, '<!doctype html><title>404</title><h1>Lowongan tidak ditemukan</h1>');
    const job = await fetchJob(globalThis.fetch, supabaseUrl, anonKey, id);
    if (!job) return send(response, 404, '<!doctype html><title>404</title><h1>Lowongan tidak ditemukan</h1>');
    const template = await readFile(TEMPLATE_PATH, 'utf8');
    send(response, 200, renderJobHtml(template, job), 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
  } catch (error) {
    console.error('[job-detail] unable to render detail:', error);
    send(response, 503, '<!doctype html><title>Layanan tidak tersedia</title><meta name="robots" content="noindex,follow"><h1>Lowongan belum dapat dimuat</h1>');
  }
}

export { TEMPLATE_PATH, JOB_SELECT, plainDescription };
