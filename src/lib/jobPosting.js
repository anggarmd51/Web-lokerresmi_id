import { jobUrl } from './jobUrls.js';

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

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,})?)?(Z|[+-]\d{2}:\d{2})$/;

const parseDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const dateOnly = trimmed.match(ISO_DATE);
  const dateTime = trimmed.match(ISO_DATETIME);
  const match = dateOnly || dateTime;
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;

  if (dateOnly) return new Date(Date.UTC(year, month - 1, day));

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const offset = match[8];
  const offsetHour = offset === 'Z' ? 0 : Number(offset.slice(1, 3));
  const offsetMinute = offset === 'Z' ? 0 : Number(offset.slice(4, 6));
  if (hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return null;

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasSuppliedDeadline = (value) => value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '');

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
const hasIndonesia = (value) => /\b(indonesia|indonesian)\b/i.test(value);

export const createJobPostingJsonLd = (job) => {
  if (!job || textValue(job.status).toLowerCase() !== 'aktif') return null;

  const id = job.id === undefined || job.id === null ? '' : String(job.id).trim();
  const title = textValue(job.title);
  const company = textValue(job.company);
  const description = asText(job.desc);
  const requirements = asText(job.requirements);
  const location = textValue(job.location);
  // Prefer the employer's factual publication date when explicitly available.
  const postedDate = parseDate(job.date_posted) || parseDate(job.created_at) || parseDate(job.date);

  if (!id || !title || !company || !description || !postedDate || !location) return null;

  const locationAndType = `${location} ${textValue(job.type)}`;
  const remote = hasRemoteWord(locationAndType);
  const hybrid = hasHybridWord(locationAndType);
  const remoteCountry = hasIndonesia(location);
  // A remote-only listing without an explicit applicant country would require fabricated data.
  if (remote && !hybrid && !remoteCountry) return null;

  const url = jobUrl(id);
  if (!url) return null;

  const descriptionParts = [`<p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>`];
  if (requirements) descriptionParts.push(`<p>Persyaratan: ${escapeHtml(requirements)}</p>`);
  if (job.category) descriptionParts.push(`<p>Kategori: ${escapeHtml(textValue(job.category))}</p>`);
  if (job.salary) descriptionParts.push(`<p>Gaji: ${escapeHtml(textValue(job.salary))}</p>`);
  if (job.type) descriptionParts.push(`<p>Jenis pekerjaan: ${escapeHtml(textValue(job.type))}</p>`);
  if (location) descriptionParts.push(`<p>Lokasi: ${escapeHtml(location)}</p>`);

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

  // The jobs model has no deadline/application_deadline field. Only trust an
  // explicitly supplied valid-through field; never turn an unrelated value
  // into a deadline.
  const suppliedValidThrough = hasSuppliedDeadline(job.validThrough);
  const suppliedValidThroughSnake = hasSuppliedDeadline(job.valid_through);
  if ((suppliedValidThrough && !parseDate(job.validThrough)) || (suppliedValidThroughSnake && !parseDate(job.valid_through))) return null;
  const deadline = (suppliedValidThrough ? parseDate(job.validThrough) : null)
    || (suppliedValidThroughSnake ? parseDate(job.valid_through) : null);
  if (deadline && (deadline.getTime() <= postedDate.getTime() || deadline.getTime() < Date.now())) return null;
  if (deadline) schema.validThrough = deadline.toISOString();

  if (remote && !hybrid) {
    schema.jobLocationType = 'TELECOMMUTE';
    schema.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'Indonesia',
    };
  } else {
    // Semicolons separate workplaces; commas remain part of the address.
    const places = location.split(';').map((value) => value.trim()).filter(Boolean).map((locality) => ({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: locality,
        addressCountry: 'ID',
      },
    }));
    schema.jobLocation = places.length === 1 ? places[0] : places;
  }

  return schema;
};

export default createJobPostingJsonLd;
