import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

const root = new URL('../', import.meta.url);
const hookPath = fileURLToPath(new URL('../src/hooks/useCVOrders.js', import.meta.url));
const analyticsPath = fileURLToPath(new URL('../src/lib/analytics.js', import.meta.url));
const modalPath = fileURLToPath(new URL('../src/components/EmployerInquiryModal.jsx', import.meta.url));

function synthetic(name, exports, context) {
  const module = new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context, identifier: name });
  return module;
}

async function loadSource(path, context, mocks, loader = 'js') {
  const source = await readFile(path, 'utf8');
  const code = loader === 'jsx'
    ? (await transformWithEsbuild(source, path, { loader: 'jsx', format: 'esm' })).code
    : source;
  const module = new vm.SourceTextModule(code, { context, identifier: path });
  await module.link(async (specifier, referencing) => {
    if (mocks[specifier]) return mocks[specifier];
    throw new Error(`Unexpected import ${specifier} from ${referencing.identifier}`);
  });
  await module.evaluate();
  return module.namespace;
}

function makeHookReact() {
  const values = [];
  let cursor = 0;
  return {
    module: null,
    begin(fn) {
      cursor = 0;
      return fn();
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], (next) => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
    useEffect() { cursor += 0; },
    useCallback(fn) { return fn; },
    useRef(value) { return { current: value }; },
  };
}

async function loadHook({ insertResult, isAdmin = false, analytics = {}, gtag } = {}) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, Date, window: { gtag } });
  const react = makeHookReact();
  react.module = synthetic('react', react, context);
  const toastCalls = [];
  const supabaseCalls = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'cv_orders');
      const chain = {
        select() { return { order: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: { id: 1 }, error: null }) }; },
        insert(payload) { supabaseCalls.push(['insert', payload]); return Promise.resolve(insertResult ?? { error: null }); },
        update() { return this; },
        delete() { return this; },
        eq() { return this; },
      };
      return chain;
    },
  };
  const toast = synthetic('toast', { toast: {
    error: (message) => toastCalls.push(['error', message]),
    success: (message) => toastCalls.push(['success', message]),
  } }, context);
  const analyticsModule = synthetic('analytics', {
    trackCVOrderLead: analytics.trackCVOrderLead || (() => false),
    trackEmployerLead: analytics.trackEmployerLead || (() => false),
  }, context);
  const namespace = await loadSource(hookPath, context, {
    react: react.module,
    'react-hot-toast': toast,
    '../lib/supabase': synthetic('supabase', { supabase }, context),
    '../lib/analytics': analyticsModule,
  });
  const hook = react.begin(() => namespace.default({ isAdmin }));
  return { hook, supabaseCalls, toastCalls, context };
}

async function loadAnalytics(windowValue) {
  const context = vm.createContext({ window: windowValue, console });
  return loadSource(analyticsPath, context, {});
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('CV order lead hanya dikirim setelah insert sukses dan payload tidak memuat nominal/currency/PII', async () => {
  const calls = [];
  const { hook, supabaseCalls } = await loadHook({
    analytics: { trackCVOrderLead: (name) => { calls.push(name); return true; } },
  });
  const result = await hook.createCVOrder({ name: 'Nama Rahasia', whatsapp: '081234567890', packageType: 'Paket Express (Rp 49.000)' });
  assert.equal(result.valid, true);
  assert.deepEqual(calls, ['Paket Express (Rp 49.000)']);
  assert.deepEqual(Object.keys(supabaseCalls[0][1][0]).sort(), ['date', 'name', 'package', 'status', 'whatsapp']);
  assert.doesNotMatch(JSON.stringify(calls), /Nama Rahasia|081234567890|value|currency|amount|price/i);
});

test('CV order invalid atau insert gagal tidak mengirim generate_lead', async () => {
  for (const scenario of [
    { insertResult: { error: new Error('RLS') }, input: { name: 'A', whatsapp: '081234567890', packageType: 'Paket VIP Mentoring (Rp 249.000)' } },
    { insertResult: { error: null }, input: { name: '', whatsapp: '081234567890', packageType: 'Paket Express (Rp 49.000)' } },
    { insertResult: { error: null }, input: { name: 'A', whatsapp: '', packageType: 'Paket Express (Rp 49.000)' } },
    { insertResult: { error: null }, input: { name: 'A', whatsapp: '081234567890', packageType: '' } },
  ]) {
    const calls = [];
    const { hook } = await loadHook({ insertResult: scenario.insertResult, analytics: { trackCVOrderLead: (...args) => calls.push(args) } });
    const result = await hook.createCVOrder(scenario.input);
    assert.equal(result.valid, false);
    assert.deepEqual(calls, []);
  }
});

test('gtag yang melempar tidak membatalkan keberhasilan insert order', async () => {
  const analytics = await loadAnalytics({ gtag() { throw new Error('GA unavailable'); } });
  const calls = [];
  const { hook } = await loadHook({
    analytics: { trackCVOrderLead: (packageName) => { calls.push(analytics.trackCVOrderLead(packageName)); } },
  });
  const result = await hook.createCVOrder({ name: 'A', whatsapp: '081234567890', packageType: 'Paket Profesional (Rp 99.000)' });
  assert.equal(result.valid, true);
  assert.deepEqual(calls, [false]);
});

test('update status termasuk paid/lunas/selesai berulang tidak mengirim purchase atau lead', async () => {
  const calls = [];
  const { hook } = await loadHook({ isAdmin: true, analytics: { trackCVOrderLead: (...args) => calls.push(['lead', ...args]) } });
  for (const status of ['Lunas', 'paid', 'Selesai', 'Lunas', 'paid']) {
    const result = await hook.updateCVStatus(7, status);
    assert.equal(result, true);
  }
  assert.deepEqual(calls, []);
});

test('helper lead CV dan employer memetakan paket persis serta tidak mengirim value/currency/PII', async () => {
  const calls = [];
  const analytics = await loadAnalytics({ gtag: (...args) => calls.push(args) });
  for (const name of ['Paket Express (Rp 49.000)', 'Paket Profesional (Rp 99.000)', 'Paket VIP Mentoring (Rp 249.000)', 'Paket custom']) {
    assert.equal(analytics.trackCVOrderLead(name), true);
  }
  for (const name of ['Standard', 'Featured Job', 'Paid placement', 'Custom — PT Rahasia']) {
    assert.equal(analytics.trackEmployerLead(name), true);
  }
  const payloads = plain(calls);
  assert.deepEqual(payloads.slice(0, 4).map(([, event, payload]) => [event, payload]), [
    ['generate_lead', { lead_type: 'cv_order', package_id: 'cv_express', source: 'order_form', lead_stage: 'order_created' }],
    ['generate_lead', { lead_type: 'cv_order', package_id: 'cv_professional', source: 'order_form', lead_stage: 'order_created' }],
    ['generate_lead', { lead_type: 'cv_order', package_id: 'cv_vip', source: 'order_form', lead_stage: 'order_created' }],
    ['generate_lead', { lead_type: 'cv_order', package_id: 'cv_custom', source: 'order_form', lead_stage: 'order_created' }],
  ]);
  assert.deepEqual(payloads.slice(4).map(([, event, payload]) => [event, payload]), [
    ['generate_lead', { lead_type: 'employer_inquiry', package_id: 'employer_standard', source: 'whatsapp', lead_stage: 'handoff' }],
    ['generate_lead', { lead_type: 'employer_inquiry', package_id: 'employer_featured', source: 'whatsapp', lead_stage: 'handoff' }],
    ['generate_lead', { lead_type: 'employer_inquiry', package_id: 'employer_paid_placement', source: 'whatsapp', lead_stage: 'handoff' }],
    ['generate_lead', { lead_type: 'employer_inquiry', package_id: 'employer_custom', source: 'whatsapp', lead_stage: 'handoff' }],
  ]);
  assert.doesNotMatch(JSON.stringify(payloads), /value|currency|Nama|Rahasia|0812|company|phone|needs/i);
});

function makeReactForModal(context) {
  let values = [];
  let cursor = 0;
  let rerender;
  const React = { createElement(type, props, ...children) { return { type, props: props || {}, children }; } };
  return {
    module: synthetic('react', {
      default: React,
      useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], (next) => { values[i] = typeof next === 'function' ? next(values[i]) : next; if (rerender) rerender(); }]; },
      useEffect() {}, useRef(value) { return { current: value }; },
    }, context),
    render(fn) { rerender = () => { cursor = 0; fn(); }; cursor = 0; return fn(); },
  };
}
function findNode(tree, predicate) { if (!tree) return null; if (predicate(tree)) return tree; for (const child of tree.children || []) { const found = findNode(child, predicate); if (found) return found; } return null; }
function collectNodes(tree, type, out = []) { if (tree?.type === type) out.push(tree); for (const child of tree?.children || []) collectNodes(child, type, out); return out; }

async function submitModal({ open = () => {}, fields = { company: 'PT Contoh', whatsapp: '081234567890', needs: 'Staff' } } = {}) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, encodeURIComponent, document: { activeElement: null, addEventListener() {}, removeEventListener() {} }, window: { open } });
  const react = makeReactForModal(context);
  const calls = [];
  const toastCalls = [];
  const analytics = synthetic('analytics', {
    trackFeaturedJobPackage: (...args) => calls.push(['package', ...args]),
    trackEmployerInquiryHandoff: (...args) => calls.push(['old_handoff', ...args]),
    trackEmployerLead: (...args) => calls.push(['lead', ...args]),
  }, context);
  const toast = synthetic('toast', { toast: { error: (message) => toastCalls.push(message) } }, context);
  const ns = await loadSource(modalPath, context, { react: react.module, 'react-hot-toast': toast, '../lib/analytics': analytics }, 'jsx');
  let tree = react.render(() => ns.default({ isOpen: true, onClose() {} }));
  for (const [node, value] of collectNodes(tree, 'input').concat(collectNodes(tree, 'textarea')).map((node, i) => [node, Object.values(fields)[i]])) node.props.onChange({ target: { value } });
  tree = react.render(() => ns.default({ isOpen: true, onClose() {} }));
  await findNode(tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
  return { calls, toastCalls };
}

test('modal employer lead hanya setelah window.open sukses; invalid dan throw tidak mengirim lead', async () => {
  const valid = await submitModal();
  assert.deepEqual(valid.calls.filter(([type]) => type === 'lead'), [['lead', 'Standard']]);
  const invalid = await submitModal({ fields: { company: ' ', whatsapp: '081234567890', needs: 'Staff' } });
  assert.deepEqual(invalid.calls.filter(([type]) => type === 'lead'), []);
  const thrown = await submitModal({ open() { throw new Error('popup blocked'); } });
  assert.deepEqual(thrown.calls.filter(([type]) => type === 'lead'), []);
});
