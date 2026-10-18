#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { canonical, canonicalUrl, readSchemaColumns, validateInventory, toInsertRow, ACTIVE_STATUS } from './inventory-validation.mjs';

export const PAGE_SIZE = 1000;
export const ACTIVE_CAP = 50;

export function inventoryKey(row) {
  return [row.title, row.company, row.location].map(canonical).join('|');
}

export function duplicateAgainstExisting(rows, existing) {
  const keys = new Set();
  const urls = new Set();
  for (const row of existing) {
    keys.add(inventoryKey(row));
    const target = canonicalUrl(row.applyTarget);
    if (target) urls.add(target);
  }
  return rows.filter(row => keys.has(inventoryKey(row)) || urls.has(canonicalUrl(row.source_url)));
}

export async function paginateExistingJobs(supabase, { pageSize = PAGE_SIZE } = {}) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from('jobs').select('id,title,company,location,applyTarget').order('id', { ascending: true }).range(from, to);
    if (error) throw new Error(`recheck dedupe gagal (range ${from}-${to}): ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`recheck dedupe gagal (range ${from}-${to}): response data bukan array`);
    const page = data;
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

export async function confirmInventoryAdmin(supabase) {
  const { data, error } = await supabase.rpc('is_lokerresmi_admin');
  if (error) throw new Error(`admin authorization RPC gagal: ${error.message}`);
  if (data !== true) throw new Error('akun login bukan lokerresmi admin');
}

async function main() {
  const args = process.argv.slice(2);
  const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const inputFile = valueOf('--input');
  const schemaFile = valueOf('--schema') || process.env.INVENTORY_SCHEMA_FILE || path.resolve('supabase_schema.sql');
  const apply = args.includes('--apply');
  const allowActive = args.includes('--allow-active');
  if (!inputFile || args.includes('--help')) {
    console.log('Usage: node scripts/inventory-import.mjs --input jobs.json [--schema schema.sql] [--allow-active] [--apply]');
    console.log('Default adalah dry-run; --apply satu-satunya mode yang melakukan insert.');
    process.exit(inputFile ? 0 : 2);
  }
  if (apply && process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Tolak service role; gunakan SUPABASE_ADMIN_EMAIL dan SUPABASE_ADMIN_PASSWORD');
  const inputPath = path.resolve(inputFile);
  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const columns = readSchemaColumns(schemaFile);
  const result = validateInventory(payload, { inputDir: path.dirname(inputPath), allowActive });
  if (result.errors.length) {
    console.error(JSON.stringify({ ok: false, mode: apply ? 'apply' : 'dry-run', errors: result.errors }, null, 2));
    process.exit(1);
  }
  if (apply && (!columns.has('date_posted') || !columns.has('valid_through'))) throw new Error('schema target wajib memiliki date_posted dan valid_through; tolak insert agar metadata tanggal tidak hilang');
  const insertRows = result.rows.map(row => toInsertRow(row, columns));
  const omitted = ['source_url', 'evidence', 'fingerprint'].filter(column => !columns.has(column));
  console.log(JSON.stringify({ ok: true, mode: apply ? 'apply' : 'dry-run', count: insertRows.length, activeRequested: insertRows.filter(row => row.status === ACTIVE_STATUS).length, schemaColumns: [...columns], omittedExternalOnly: omitted, rows: insertRows }, null, 2));
  if (!apply) return;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const email = process.env.SUPABASE_ADMIN_EMAIL;
  const password = process.env.SUPABASE_ADMIN_PASSWORD;
  if (!url || !email || !password) throw new Error('apply memerlukan SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_ADMIN_EMAIL, SUPABASE_ADMIN_PASSWORD');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('apply memerlukan SUPABASE_ANON_KEY atau VITE_SUPABASE_ANON_KEY');
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`admin authentication gagal: ${authError.message}`);
  await confirmInventoryAdmin(supabase);
  const existing = await paginateExistingJobs(supabase);
  const duplicateExisting = duplicateAgainstExisting(result.rows, existing);
  if (duplicateExisting.length) throw new Error(`duplikat database (title/company/location atau source_url=applyTarget): ${duplicateExisting.map(row => row.title).join(', ')}`);
  // Final cap read immediately before the write; concurrent writers can still race without a DB constraint.
  const { count: activeCount, error: countError } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', ACTIVE_STATUS);
  if (countError) throw new Error(`recheck cap aktif gagal: ${countError.message}`);
  if (activeCount === null || activeCount === undefined) throw new Error('recheck cap aktif gagal: count tidak tersedia');
  const requestedActive = insertRows.filter(row => row.status === ACTIVE_STATUS).length;
  if (activeCount + requestedActive > ACTIVE_CAP) throw new Error(`cap aktif 50 terlampaui: existing=${activeCount}, requested=${requestedActive}`);
  const { data, error } = await supabase.from('jobs').insert(insertRows).select('id');
  if (error) throw new Error(`insert batch gagal: ${error.message}`);
  console.log(JSON.stringify({ ok: true, inserted: data?.length ?? insertRows.length, ids: data?.map(row => row.id) ?? [] }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
