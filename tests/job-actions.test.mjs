import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadHook({ response }) {
  const calls = [];
  const toasts = [];
  const supabase = {
    from(table) {
      calls.push({ table });
      const builder = {
        insert(value) { calls.at(-1).insert = value; return builder; },
        update(value) { calls.at(-1).update = value; return builder; },
        delete() { calls.at(-1).delete = true; return builder; },
        eq(column, value) { calls.at(-1).eq = [column, value]; return builder; },
        select(value) { calls.at(-1).select = value; return builder; },
        single() { return Promise.resolve(response); },
      };
      return builder;
    },
  };
  const toast = { success: (message) => toasts.push(['success', message]), error: (message) => toasts.push(['error', message]) };
  const context = vm.createContext({ console });
  const reactHotToast = new vm.SyntheticModule(['toast'], function () { this.setExport('toast', toast); }, { context });
  const supabaseModule = new vm.SyntheticModule(['supabase'], function () { this.setExport('supabase', supabase); }, { context });
  const utilsModule = new vm.SyntheticModule(['sortJobsByFeatured'], function () { this.setExport('sortJobsByFeatured', (items) => [...items]); }, { context });
  const source = await readFile(new URL('../src/hooks/useJobActions.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context, identifier: 'useJobActions.js' });
  await module.link((specifier) => specifier === 'react-hot-toast' ? reactHotToast : specifier === '../lib/supabase' ? supabaseModule : utilsModule);
  await module.evaluate();
  let jobs = [{ id: 1, status: 'Lama', featured: false, title: 'Existing' }];
  const setJobs = (updater) => { jobs = typeof updater === 'function' ? updater(jobs) : updater; };
  return { hook: module.namespace.default({ setJobs }), get jobs() { return jobs; }, calls, toasts };
}

test('failed insert does not fabricate a local job or success toast', async () => {
  const action = await loadHook({ response: { data: null, error: new Error('network down') } });
  assert.equal(await action.hook.createJob({ title: 'New' }), null);
  assert.deepEqual(action.jobs, [{ id: 1, status: 'Lama', featured: false, title: 'Existing' }]);
  assert.equal(action.toasts.some(([type]) => type === 'success'), false);
});

test('update/status/featured failures leave local state unchanged', async () => {
  const action = await loadHook({ response: { data: null, error: new Error('permission denied') } });
  assert.equal(await action.hook.updateJob({ id: 1, title: 'Changed' }), false);
  assert.equal(await action.hook.updateJobStatus(1, 'Aktif'), false);
  assert.equal(await action.hook.toggleFeatured(1, false), false);
  assert.deepEqual(action.jobs, [{ id: 1, status: 'Lama', featured: false, title: 'Existing' }]);
  assert.equal(action.toasts.some(([type]) => type === 'success'), false);
});

test('local state changes only after Supabase returns the changed row', async () => {
  const action = await loadHook({ response: { data: { id: 1 }, error: null } });
  assert.equal(await action.hook.updateJobStatus(1, 'Aktif'), true);
  assert.equal(await action.hook.toggleFeatured(1, false), true);
  assert.deepEqual(JSON.parse(JSON.stringify(action.jobs)), [{ id: 1, status: 'Aktif', featured: true, title: 'Existing' }]);
  assert.deepEqual(action.calls.map((call) => call.select), ['id', 'id']);
});


test('zero-row success responses fail closed for every mutating action', async () => {
  const action = await loadHook({ response: { data: null, error: null } });
  assert.equal(await action.hook.updateJob({ id: 1, title: 'Changed' }), false);
  assert.equal(await action.hook.updateJobStatus(1, 'Aktif'), false);
  assert.equal(await action.hook.toggleFeatured(1, false), false);
  assert.equal(await action.hook.deleteJob(1), false);
  assert.deepEqual(action.jobs, [{ id: 1, status: 'Lama', featured: false, title: 'Existing' }]);
  assert.equal(action.toasts.some(([type]) => type === 'success'), false);
});
