import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const modalPath = new URL('../src/components/AICVCheckerModal.jsx', import.meta.url);

async function source() {
  return readFile(modalPath, 'utf8');
}

test('modal CV tidak membuat skor atau klaim analisis saat API gagal', async () => {
  const modal = await source();
  assert.doesNotMatch(modal, /simulateAnalysis|skor\s*=\s*74|hingga 3x lipat/);
  assert.match(modal, /setResult\(\{\s*error:\s*true/);
  assert.match(modal, /Tidak ada skor atau analisis yang dibuat/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /toast\.error\('Analisis CV gagal/);
});

test('respons API isFallback diperlakukan sebagai error tanpa merender result', async () => {
  const modal = await source();
  assert.match(modal, /if \(data\?\.isFallback\)/);
  assert.match(modal, /message: 'Layanan AI mengembalikan mode cadangan/);
  assert.match(modal, /\} else \{\s*setResult\(data\)/);
  assert.doesNotMatch(modal, /result\.isFallback/);
});
