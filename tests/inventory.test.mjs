import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateInventory, toInsertRow, DEFAULT_STATUS, readSchemaColumns } from '../scripts/inventory-validation.mjs';
import { duplicateAgainstExisting, inventoryKey } from '../scripts/inventory-import.mjs';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-'));
  for (const field of ['desc', 'location', 'date_posted', 'valid_through', 'company']) fs.writeFileSync(path.join(dir, `${field}.txt`), field);
  return { dir, row: { title: 'Backend Engineer', company: 'PT Resmi', location: 'Jakarta', desc: 'Deskripsi faktual', source_url: 'https://example.test/jobs/1', date_posted: '2026-01-01', valid_through: '2026-02-01', evidence: Object.fromEntries(['desc', 'location', 'date_posted', 'valid_through', 'company'].map(field => [field, { file: `${field}.txt` }])) } };
}

test('validates official source evidence and defaults to pending', () => {
  const { dir, row } = fixture();
  const result = validateInventory([row], { inputDir: dir });
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].status, DEFAULT_STATUS);
});

test('rejects missing external evidence and duplicate URL/fingerprint', () => {
  const { dir, row } = fixture();
  const missing = { ...row, evidence: { ...row.evidence, company: { file: 'nope.txt' } } };
  assert.match(validateInventory([missing], { inputDir: dir }).errors[0], /evidence external/);
  const second = { ...row, title: 'Backend Engineer 2', source_url: row.source_url };
  assert.match(validateInventory([row, second], { inputDir: dir }).errors.join('\n'), /source_url duplikat/);
});

test('Aktif requires explicit opt-in, verified apply URL, and valid deadline', () => {
  const { dir, row } = fixture();
  assert.match(validateInventory([{ ...row, status: 'Aktif' }], { inputDir: dir }).errors[0], /--allow-active/);
  assert.match(validateInventory([{ ...row, status: 'Aktif', applyTarget: '081234' }], { inputDir: dir, allowActive: true }).errors[0], /applyTarget URL/);
  assert.match(validateInventory([{ ...row, status: 'Aktif', applyTarget: 'https://apply.example.test' }], { inputDir: dir, allowActive: true }).errors.join('\n'), /type yang disuplai/);
  assert.match(validateInventory([{ ...row, valid_through: '2025-01-01' }], { inputDir: dir }).errors[0], /setelah/);
});

test('validates requirements strings and active mapping retains dates and supplied type/category', () => {
  const { dir, row } = fixture();
  const active = { ...row, status: 'Aktif', valid_through: '2027-02-01', type: 'Contract', category: 'Finance', applyType: 'gform', applyTarget: 'https://apply.example.test', requirements: [' Excel ', 'SQL'] };
  const result = validateInventory([active], { inputDir: dir, allowActive: true });
  assert.deepEqual(result.errors, []);
  const mapped = toInsertRow(result.rows[0], new Set(['title', 'company', 'location', 'desc', 'status', 'type', 'category', 'applyType', 'applyTarget', 'requirements', 'date_posted', 'valid_through']));
  assert.equal(mapped.date_posted, '2026-01-01');
  assert.equal(mapped.valid_through, '2027-02-01');
  assert.equal(mapped.type, 'Contract');
  assert.equal(mapped.category, 'Finance');
  assert.deepEqual(mapped.requirements, [' Excel ', 'SQL']);
  assert.match(validateInventory([{ ...row, requirements: ['ok', 1] }], { inputDir: dir }).errors[0], /requirements harus array string/);
});

test('rejects impossible calendar dates even when pending', () => {
  const { dir, row } = fixture();
  const result = validateInventory([{ ...row, date_posted: '2026-02-30' }], { inputDir: dir });
  assert.match(result.errors[0], /date_posted tidak valid/);
});

test('insert mapping preserves supplied production fields without invented type/category', () => {
  const { dir, row } = fixture();
  const clean = validateInventory([row], { inputDir: dir }).rows[0];
  const mapped = toInsertRow({ ...clean, applyType: 'gform', applyTarget: 'https://forms.example.test/apply', requirements: ['SQL'] }, new Set(['title', 'company', 'location', 'desc', 'status', 'date_posted', 'valid_through', 'type', 'category', 'applyType', 'applyTarget', 'requirements']));
  assert.equal(mapped.date_posted, row.date_posted);
  assert.equal(mapped.valid_through, row.valid_through);
  assert.equal(mapped.applyType, 'gform');
  assert.equal(mapped.applyTarget, 'https://forms.example.test/apply');
  assert.deepEqual(mapped.requirements, ['SQL']);
  assert.equal('type' in mapped, false);
  assert.equal('category' in mapped, false);
  assert.equal('source_url' in mapped, false);
  assert.equal('evidence' in mapped, false);
});

test('default repository schema includes migration date columns but not external provenance columns', () => {
  const columns = readSchemaColumns(path.resolve('supabase_schema.sql'));
  assert.equal(columns.has('date_posted'), true);
  assert.equal(columns.has('valid_through'), true);
  for (const missing of ['source_url', 'evidence', 'fingerprint']) assert.equal(columns.has(missing), false);
});

test('database dedupe ignores date and compares source URL to existing applyTarget', () => {
  const { dir, row } = fixture();
  const clean = validateInventory([row], { inputDir: dir }).rows[0];
  assert.equal(inventoryKey(clean), inventoryKey({ ...clean, date_posted: '2025-01-01' }));
  assert.equal(duplicateAgainstExisting([clean], [{ title: 'Other', company: 'Other', location: 'Bandung', applyTarget: row.source_url }]).length, 1);
  assert.equal(duplicateAgainstExisting([clean], [{ title: row.title, company: row.company, location: row.location, applyTarget: '' }]).length, 1);
});
