import { SITE_URL, jobPath, jobUrl } from './jobUrls.js';
export { SITE_URL, jobPath, jobUrl };
import { createJobPostingJsonLd } from './jobPosting.js';
import { getLandingPage } from './landingPages.js';

export function readJobRoute(location) {
  const landing = getLandingPage(location.pathname);
  if (landing) return { id: null, isDetail: false, isLanding: true, landing, invalid: false };
  const match = location.pathname.match(/^\/lowongan\/([^/]+)\/?$/);
  if (match) {
    try {
      const id = decodeURIComponent(match[1]);
      return { id, isDetail: true, invalid: !id || /[/\\\s]/.test(id) };
    } catch {
      return { id: null, isDetail: true, invalid: true };
    }
  }
  // Preserve links shared before unique detail routes were introduced.
  const legacy = location.pathname === '/' && location.hash?.match(/^#job-(.+)$/);
  if (legacy) {
    try {
      const id = decodeURIComponent(legacy[1]);
      return { id, isDetail: true, invalid: !id || /[/\\\s]/.test(id), legacy: true };
    } catch {
      return { id: null, isDetail: true, invalid: true };
    }
  }
  return { id: null, isDetail: false, invalid: location.pathname !== '/' };
}

function setMeta(selector, attribute, name, content) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function updatePageMetadata(job, route, { loading = false, error = false, landingJobs = null } = {}) {
  const landing = route.landing || (route.isLanding ? getLandingPage(route.path) : null);
  const isEmptyLanding = Boolean(landing && (error || (!loading && (!Array.isArray(landingJobs) || !landingJobs.length))));
  const title = job
    ? `${job.title} | ${job.company} - Lokerresmi.id`
    : landing ? landing.title
    : route.isDetail || route.invalid
      ? loading ? 'Memuat lowongan | Lokerresmi.id' : error ? 'Lowongan belum dapat dimuat | Lokerresmi.id' : 'Lowongan tidak ditemukan | Lokerresmi.id'
      : 'Lokerresmi.id - Portal Lowongan Kerja Terverifikasi, CV ATS & Karier Terpercaya';
  const description = job
    ? [job.title, job.company, job.location, job.salary, job.desc].filter(Boolean).join(' • ').slice(0, 300)
    : landing ? landing.description
    : route.isDetail || route.invalid
      ? 'Lihat lowongan aktif lainnya di Lokerresmi.id.'
      : 'Temukan ribuan lowongan kerja terbaru, tips karier profesional, layanan pembuatan CV ATS, dan peluang magang terbaik di Indonesia.';
  const url = route.isDetail && route.id && !route.invalid ? jobUrl(route.id) : landing ? `${SITE_URL}${landing.path}` : `${SITE_URL}/`;
  const image = `${SITE_URL}/logo_og.png`;
  document.title = title;
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
  setMeta('meta[name="description"]', 'name', 'description', description);
  setMeta('meta[name="robots"]', 'name', 'robots', route.invalid || (route.isDetail && (!job || !createJobPostingJsonLd(job))) || isEmptyLanding ? 'noindex,follow' : 'index,follow');
  for (const [name, content] of Object.entries({
    'og:type': 'website', 'og:title': title, 'og:description': description,
    'og:url': url, 'og:image': image, 'og:image:secure_url': image, 'og:site_name': 'Lokerresmi.id',
  })) setMeta(`meta[property="${name}"]`, 'property', name, content);
  for (const [name, content] of Object.entries({
    'twitter:card': 'summary_large_image', 'twitter:title': title,
    'twitter:description': description, 'twitter:url': url, 'twitter:image': image,
  })) setMeta(`meta[name="${name}"]`, 'name', name, content);
}
