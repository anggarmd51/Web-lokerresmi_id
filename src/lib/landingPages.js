export const LANDING_PAGES = Object.freeze({
  '/lowongan-kerja/medan': Object.freeze({
    path: '/lowongan-kerja/medan',
    key: 'medan',
    kind: 'location',
    location: 'Medan',
    h1: 'Lowongan Kerja di Medan',
    title: 'Lowongan Kerja di Medan Terbaru | Lokerresmi.id',
    description: 'Temukan lowongan kerja aktif di Medan dari perusahaan yang terdaftar di Lokerresmi.id.',
  }),
  '/lowongan-admin/medan': Object.freeze({
    path: '/lowongan-admin/medan',
    key: 'admin-medan',
    kind: 'category-location',
    location: 'Medan',
    category: 'Administrasi',
    h1: 'Lowongan Admin di Medan',
    title: 'Lowongan Admin di Medan Terbaru | Lokerresmi.id',
    description: 'Lihat lowongan admin dan administrasi aktif di Medan yang tersedia di Lokerresmi.id.',
  }),
  '/lowongan-fresh-graduate': Object.freeze({
    path: '/lowongan-fresh-graduate',
    key: 'fresh-graduate',
    kind: 'fresh-graduate',
    h1: 'Lowongan Kerja Fresh Graduate',
    title: 'Lowongan Kerja Fresh Graduate Terbaru | Lokerresmi.id',
    description: 'Temukan lowongan kerja aktif untuk fresh graduate berdasarkan keterangan lowongan yang eksplisit.',
  }),
});

const NEGATED_FRESH = /(?:tidak|belum|bukan|tanpa|dilarang|tidak\s+menerima|tidak\s+terbuka)\s+(?:menerima\s+)?(?:fresh\s*graduate|freshgraduate|lulusan\s+baru)|(?:fresh\s*graduate|freshgraduate|lulusan\s+baru)\s+(?:tidak|belum|bukan|dilarang)/i;
const EXPLICIT_FRESH = /(?:fresh\s*graduate|freshgraduate|fresh\s+grad|lulusan\s+baru|baru\s+lulus|tanpa\s+pengalaman)/i;
const ADMIN_CATEGORY = /^(?:administrasi|admin(?:istrasi)?|administrative)$/i;

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}

export function getLandingPage(pathname = '') {
  const path = String(pathname).replace(/\/+$/, '') || '/';
  return LANDING_PAGES[path] || null;
}

export function isFreshGraduateJob(job = {}) {
  const text = [job.title, job.desc, job.description, job.requirements]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter(Boolean).join(' ');
  return EXPLICIT_FRESH.test(text) && !NEGATED_FRESH.test(text);
}

export function matchesLandingJob(job = {}, landing) {
  if (!landing || !job || job.status !== 'Aktif') return false;
  const cities = String(job.location ?? '').split(';').map((address) => normalizeText(address.split(',')[0]));
  if (landing.location && !cities.includes(normalizeText(landing.location))) return false;
  if (landing.category && !ADMIN_CATEGORY.test(String(job.category ?? '').trim())) return false;
  if (landing.kind === 'fresh-graduate') return isFreshGraduateJob(job);
  return true;
}

export function filterJobsForLanding(jobs = [], landing) {
  return Array.isArray(jobs) ? jobs.filter((job) => matchesLandingJob(job, landing)) : [];
}

export const landingPaths = Object.freeze(Object.keys(LANDING_PAGES));
