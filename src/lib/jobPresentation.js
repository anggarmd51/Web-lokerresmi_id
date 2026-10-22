export const displaySalary = (value) => {
  const text = String(value ?? '').trim();
  if (!text || text === '-' || /^kompetitif$/i.test(text)) return 'Tidak dicantumkan';
  return text;
};

export const displayJobType = (value) => {
  const text = String(value ?? '').trim();
  if (/^full\s*time$/i.test(text)) return 'Penuh waktu';
  return text || 'Tidak dicantumkan';
};

const validDate = (value) => {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match || Number.isNaN(new Date(text).getTime())) return false;
  const [, year, month, day] = match.map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const getConfirmedDeadline = (job) => {
  const value = job?.valid_through ?? job?.validThrough ?? job?.deadline;
  return validDate(value) ? value : '';
};

export const displayDeadline = (job, formatDate) => {
  const value = getConfirmedDeadline(job);
  return value ? formatDate(value) : 'Tidak dicantumkan';
};

export const displaySource = (job) => {
  const source = typeof job?.source_url === 'string' ? job.source_url.trim() : '';
  if (source) {
    try {
      const url = new URL(source);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* No source is preferable to a fabricated or unsafe source. */ }
  }
  return 'LokerResmi · detail lowongan';
};

export const displayDate = (job, formatDate) => {
  const value = job?.created_at || job?.date;
  return validDate(value) ? formatDate(value) : 'Tidak dicantumkan';
};
