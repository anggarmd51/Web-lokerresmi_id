import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import createJobPostingJsonLd from '../src/lib/jobPosting.js';

export const DEFAULT_STATUS = 'Menunggu Persetujuan';
export const MAX_BATCH = 50;
export const ACTIVE_STATUS = 'Aktif';
export const REQUIRED_EVIDENCE_FIELDS = ['desc', 'location', 'date_posted', 'valid_through', 'company'];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const URL_RE = /^https:\/\/[^\s]+$/i;
const text = (value) => typeof value === 'string' ? value.trim() : '';
export const canonical = (value) => text(value).toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
export const canonicalUrl = (value) => canonical(value).replace(/\/$/, '');

export function parseIsoDate(value, field) {
  const valueText = text(value);
  const match = valueText.match(ISO_DATE);
  if (!match) throw new Error(`${field} harus ISO date/datetime`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new Error(`${field} tidak valid`);
  }
  const date = new Date(valueText.length === 10 ? `${valueText}T00:00:00.000Z` : valueText);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} tidak valid`);
  return date;
}

function columnsFromCreateTable(sql) {
  const block = sql.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+public\.jobs\s*\(([^;]+?)\);/is)?.[1] ?? '';
  const columns = new Set();
  for (const line of block.split('\n')) {
    const match = line.trim().match(/^(?:"([^"]+)"|([A-Za-z_][\w]*))\s+/);
    if (match) columns.add(match[1] || match[2]);
  }
  return columns;
}

function columnsFromMigrations(directory) {
  const columns = new Set();
  if (!fs.existsSync(directory)) return columns;
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(directory, file), 'utf8');
    for (const match of sql.matchAll(/ALTER\s+TABLE\s+public\.jobs\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"([^"]+)"|([A-Za-z_][\w]*))/gi)) {
      columns.add(match[1] || match[2]);
    }
  }
  return columns;
}

export function readSchemaColumns(schemaFile = path.resolve('supabase_schema.sql')) {
  if (!fs.existsSync(schemaFile)) throw new Error(`schema file tidak ditemukan: ${schemaFile}`);
  const columns = columnsFromCreateTable(fs.readFileSync(schemaFile, 'utf8'));
  // The bootstrap schema predates the production migrations. Include migration-added
  // columns only for the repository default, never silently for an explicitly supplied schema.
  if (path.basename(schemaFile) === 'supabase_schema.sql') {
    for (const column of columnsFromMigrations(path.resolve('supabase/migrations'))) columns.add(column);
  }
  if (!columns.size) throw new Error('CREATE TABLE public.jobs tidak ditemukan di schema');
  return columns;
}

function evidencePath(row, field, inputDir) {
  const value = row.evidence?.[field];
  const file = typeof value === 'string' ? value : value?.file;
  if (!file) return null;
  return path.resolve(inputDir, file);
}

export function fingerprint(row) {
  const key = [row.title, row.company, row.location, row.date_posted]
    .map(canonical).join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function validateInventory(rows, { inputDir = process.cwd(), allowActive = false, maxBatch = MAX_BATCH } = {}) {
  const errors = [];
  if (!Array.isArray(rows)) return { rows: [], errors: ['input JSON harus array jobs'] };
  if (rows.length < 1 || rows.length > maxBatch) errors.push(`batch harus 1-${maxBatch} baris (disarankan 30-50 per tahap)`);
  const sourceUrls = new Map();
  const fingerprints = new Map();
  const normalized = [];
  rows.forEach((raw, index) => {
    const at = `baris ${index + 1}`;
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('objek wajib');
      const title = text(raw.title);
      const company = text(raw.company);
      const location = text(raw.location);
      const desc = text(raw.desc ?? raw.description);
      const sourceUrl = text(raw.source_url);
      const datePosted = text(raw.date_posted);
      const validThrough = text(raw.valid_through);
      if (!title) throw new Error('title wajib');
      if (!company) throw new Error('company wajib');
      if (!location) throw new Error('location wajib');
      if (!desc) throw new Error('desc/description wajib');
      if (!URL_RE.test(sourceUrl)) throw new Error('source_url wajib URL HTTPS absolut');
      if (raw.requirements !== undefined && (!Array.isArray(raw.requirements) || raw.requirements.some(item => typeof item !== 'string' || !item.trim()))) throw new Error('requirements harus array string non-empty');
      const posted = parseIsoDate(datePosted, 'date_posted');
      const through = parseIsoDate(validThrough, 'valid_through');
      if (posted > new Date()) throw new Error('date_posted tidak boleh di masa depan');
      if (through <= posted) throw new Error('valid_through harus setelah date_posted');
      const status = text(raw.status) || DEFAULT_STATUS;
      if (status === ACTIVE_STATUS && !allowActive) throw new Error('status Aktif perlu --allow-active eksplisit');
      if (status === ACTIVE_STATUS && !URL_RE.test(text(raw.applyTarget))) throw new Error('status Aktif memerlukan applyTarget URL HTTPS terverifikasi');
      if (status === ACTIVE_STATUS && !text(raw.type)) throw new Error('status Aktif memerlukan type yang disuplai');
      if (status === ACTIVE_STATUS && !text(raw.category)) throw new Error('status Aktif memerlukan category yang disuplai');
      if (status === ACTIVE_STATUS && !createJobPostingJsonLd({ ...raw, title, company, location, desc, status, id: `inventory-${index + 1}`, date_posted: datePosted, valid_through: validThrough })) {
        throw new Error('status Aktif gagal gate JobPosting JSON-LD (data belum lengkap/masa berlaku lewat)');
      }
      if (status !== ACTIVE_STATUS && status !== DEFAULT_STATUS && status !== 'Pending') throw new Error(`status tidak diizinkan: ${status}`);
      for (const field of REQUIRED_EVIDENCE_FIELDS) {
        const file = evidencePath(raw, field, inputDir);
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`evidence external untuk ${field} tidak ditemukan`);
      }
      const sourceKey = canonicalUrl(sourceUrl);
      if (sourceUrls.has(sourceKey)) throw new Error(`source_url duplikat dengan baris ${sourceUrls.get(sourceKey)}`);
      sourceUrls.set(sourceKey, index + 1);
      const clean = { ...raw, title, company, location, desc, source_url: sourceUrl, date_posted: datePosted, valid_through: validThrough, status, _fingerprint: fingerprint({ ...raw, title, company, location, date_posted: datePosted }) };
      if (fingerprints.has(clean._fingerprint)) throw new Error(`fingerprint duplikat dengan baris ${fingerprints.get(clean._fingerprint)}`);
      fingerprints.set(clean._fingerprint, index + 1);
      normalized.push(clean);
    } catch (error) { errors.push(`${at}: ${error.message}`); }
  });
  return { rows: normalized, errors, sourceUrls, fingerprints };
}

export function toInsertRow(row, columns) {
  const aliases = {
    title: row.title, company: row.company, location: row.location, desc: row.desc,
    status: row.status || DEFAULT_STATUS, featured: false, applicantsCount: 0,
  };
  for (const key of ['salary', 'type', 'category', 'applyType', 'applyTarget']) {
    const value = text(row[key]);
    if (value) aliases[key] = value;
  }
  if (Array.isArray(row.requirements)) aliases.requirements = row.requirements;
  if (columns.has('date_posted')) aliases.date_posted = row.date_posted;
  if (columns.has('valid_through')) aliases.valid_through = row.valid_through;
  return Object.fromEntries(Object.entries(aliases).filter(([key]) => columns.has(key)));
}
