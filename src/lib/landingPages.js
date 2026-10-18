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
  if (LANDING_PAGES[path]) return LANDING_PAGES[path];
  const match = path.match(/^\/lowongan-(kerja|admin|it|sales|keuangan|hrd|teknik|logistik|customer-service)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match || match[2].length > 80 || /\b(remote|hybrid|wfh)\b/.test(match[2])) return null;
  const [, categorySlug, locationSlug] = match;
  const location = locationSlug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  const category = CATEGORY_LANDINGS[categorySlug];
  const label = category?.label || 'Kerja';
  const h1 = `Lowongan ${label} di ${location}`;
  return { path, key: `${categorySlug}-${locationSlug}`, kind: category ? 'category-location' : 'location', location, locationSlug, category: category?.category, h1, title: `${h1} Terbaru | Lokerresmi.id`, description: `Temukan lowongan ${label.toLowerCase()} aktif di ${location} berdasarkan lokasi yang tercantum pada lowongan.` };
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
  if (landing.locationSlug ? !cities.some(city => locationSlug(city) === landing.locationSlug) : landing.location && !cities.includes(normalizeText(landing.location))) return false;
  if (landing.category && (landing.category === 'Administrasi' ? !ADMIN_CATEGORY.test(String(job.category ?? '').trim()) : normalizeText(job.category) !== normalizeText(landing.category))) return false;
  if (landing.kind === 'fresh-graduate') return isFreshGraduateJob(job);
  return true;
}

export function filterJobsForLanding(jobs = [], landing) {
  return Array.isArray(jobs) ? jobs.filter((job) => matchesLandingJob(job, landing)) : [];
}

export const landingPaths = Object.freeze(Object.keys(LANDING_PAGES));

const CATEGORY_LANDINGS = Object.freeze({
  admin: { category: 'Administrasi', label: 'Admin' },
  it: { category: 'IT & Software', label: 'IT' },
  sales: { category: 'Sales & Marketing', label: 'Sales' },
  keuangan: { category: 'Keuangan/Akuntansi', label: 'Keuangan' },
  hrd: { category: 'HRD/Personalia', label: 'HRD' },
  teknik: { category: 'Teknik/Engineering', label: 'Teknik' },
  logistik: { category: 'Logistik/Operasional', label: 'Logistik' },
  'customer-service': { category: 'Pelayanan Pelanggan', label: 'Customer Service' },
});
function locationSlug(value) {
  return normalizeText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function getLandingPagesForJobs(jobs = []) {
  const pages = new Map(Object.entries(LANDING_PAGES));
  for (const job of jobs) {
    if (job?.status !== 'Aktif') continue;
    for (const address of String(job.location || '').split(';')) {
      const locality = address.split(',')[0].trim();
      // Never infer an office or a city from a remote/hybrid label.
      if (!locality || /\b(remote|hybrid|wfh|work from home)\b/i.test(locality)) continue;
      const slug = locationSlug(locality);
      const category = ADMIN_CATEGORY.test(String(job.category || '')) ? 'admin' : Object.keys(CATEGORY_LANDINGS).find(key => normalizeText(CATEGORY_LANDINGS[key].category) === normalizeText(job.category));
      for (const key of ['kerja', category].filter(Boolean)) {
        const page = getLandingPage(`/lowongan-${key}/${slug}`);
        if (page) pages.set(page.path, page);
      }
    }
  }
  return [...pages.values()].filter(page => filterJobsForLanding(jobs, page).length > 0);
}
