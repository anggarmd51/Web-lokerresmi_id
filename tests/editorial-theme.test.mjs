import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('kanvas editorial berganti tema atomik tanpa animasi latar yang tertinggal dari teks', async () => {
  const source = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');
  const match = source.match(/<div className="editorial-page\s+([^"]+)"/);
  assert.ok(match, 'root editorial harus mempunyai selector yang eksplisit untuk QA');
  assert.match(match[1], /\bbg-light\b/);
  assert.match(match[1], /\bdark:bg-slate-950\b/);
  assert.doesNotMatch(match[1], /\btransition(?:-\S+)?\b|\bduration-\S+/);
});
