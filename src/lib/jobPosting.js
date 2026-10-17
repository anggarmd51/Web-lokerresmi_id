import { jobUrl } from './seo.js';

const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPE[character]);

const textValue = (value) => (typeof value === 'string' ? value.trim() : '');

const asText = (value) => {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join('. ');
  return textValue(value);
};

const parseDate = (value) => {
  if (!value || (typeof value !== 'string' && !(value instanceof Date) && typeof value !== 'number')) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapEmploymentType = (type) => {
  const value = textValue(type).toLowerCase().replace(/[\s_-]+/g, ' ');
  if (value === 'full' || value === 'full time' || value === 'fulltime') return 'FULL_TIME';
  if (value === 'part time' || value === 'parttime') return 'PART_TIME';
  if (value === 'kontrak' || value === 'contract' || value === 'contractor') return 'CONTRACTOR';
  if (value === 'magang' || value === 'intern' || value === 'internship') return 'INTERN';
  if (value === 'freelance') return 'OTHER';
  return undefined;
};

const hasRemoteWord = (value) => /\b(remote|remotely|work\s+from\s+home|wfh)\b/i.test(value);
const hasHybridWord = (value) => /\bhybrid\b/i.test(value);
const hasIndonesia = (value) => /\b(indonesia|indonesian|id)\b/i.test(value);

export const createJobPostingJsonLd = (job) => {
  if (!job || textValue(job.status).toLowerCase() !== 'aktif') return null;

  const id = job.id === undefined || job.id === null ? '' : String(job.id).trim();
  const title = textValue(job.title);
  const company = textValue(job.company);
  const description = asText(job.desc);
  const requirements = asText(job.requirements);
  const location = textValue(job.location);
  const postedDate = parseDate(job.created_at) || parseDate(job.date);

  if (!id || !title || !company || !description || !postedDate || !location) return null;

  const locationAndType = `${location} ${textValue(job.type)}`;
  const remote = hasRemoteWord(locationAndType);
  const hybrid = hasHybridWord(locationAndType);
  const remoteCountry = hasIndonesia(location);
  // A remote-only listing without an explicit applicant country would require fabricated data.
  if (remote && !hybrid && !remoteCountry) return null;

  const url = jobUrl(id);
  if (!url) return null;

  const descriptionParts = [`<p>${escapeHtml(description).replace(/\n/g, "<br>")}</p>`];
  if (requirements) descriptionParts.push(`<p>Persyaratan: ${escapeHtml(requirements)}</p>`);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    '@id': `${url}#jobposting`,
    url,
    title,
    description: descriptionParts.join(' '),
    datePosted: postedDate.toISOString(),
    identifier: {
      '@type': 'PropertyValue',
      name: 'Lokerresmi',
      value: id,
    },
    hiringOrganization: {
      '@type': 'Organization',
      name: company,
    },
  };

  const employmentType = mapEmploymentType(job.type);
  if (employmentType) schema.employmentType = employmentType;

  const deadline = parseDate(job.validThrough) || parseDate(job.valid_through) || parseDate(job.deadline) || parseDate(job.application_deadline);
  if (deadline && deadline.getTime() < Date.now()) return null;
  if (deadline) schema.validThrough = deadline.toISOString();

  if (remote && !hybrid) {
    schema.jobLocationType = 'TELECOMMUTE';
    schema.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'Indonesia',
    };
  } else {
    schema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: location,
        addressCountry: 'ID',
      },
    };
  }

  return schema;
};

export default createJobPostingJsonLd;
