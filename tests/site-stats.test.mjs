import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const hookPath = new URL('../src/hooks/useSiteStats.js', import.meta.url);

test('useSiteStats membaca statistik dan mencatat kunjungan lewat RPC saja', async () => {
  const hook = await readFile(hookPath, 'utf8');
  assert.match(hook, /\.from\('site_stats'\)[\s\S]*\.select\('\*'\)/);
  assert.match(hook, /supabase\.rpc\('increment_site_views'\)/);
  assert.doesNotMatch(hook, /\.update\(|\.insert\(/);
});

test('kegagalan RPC tidak memicu fallback mutasi tabel', async () => {
  const hook = await readFile(hookPath, 'utf8');
  const recordView = hook.slice(hook.indexOf('const recordPageView'));
  assert.doesNotMatch(recordView, /\.from\('site_stats'\)/);
  assert.doesNotMatch(recordView, /\.update\(|\.insert\(/);
});
