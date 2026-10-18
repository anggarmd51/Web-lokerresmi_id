import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

const root = new URL('../', import.meta.url);
const context = vm.createContext({ console, setTimeout, clearTimeout, encodeURIComponent });

function synthetic(name, exports) {
  const module = new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context, identifier: name });
  return module;
}

async function loadJsx(path, mocks = {}) {
  const source = await readFile(path, 'utf8');
  const code = (await transformWithEsbuild(source, path, { loader: 'jsx', format: 'esm' })).code;
  const module = new vm.SourceTextModule(code, { context, identifier: path });
  await module.link(async (specifier, referencing) => {
    if (mocks[specifier]) return mocks[specifier];
    throw new Error(`Unexpected import ${specifier} from ${referencing.identifier}`);
  });
  await module.evaluate();
  return module.namespace;
}

function makeReactMock() {
  let values = [];
  let cursor = 0;
  let rerender = null;
  const React = { createElement(type, props, ...children) { return { type, props: props || {}, children }; } };
  return {
    module: synthetic('react', {
      default: React,
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (next) => {
          values[index] = typeof next === 'function' ? next(values[index]) : next;
          if (rerender) rerender();
        }];
      },
      useEffect() {},
      useRef(value) { return { current: value }; },
    }),
    beginRender(fn) {
      const render = () => { cursor = 0; return fn(); };
      rerender = render;
      return render;
    },
  };
}

function find(tree, predicate) {
  if (!tree) return null;
  if (predicate(tree)) return tree;
  for (const child of tree.children || []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function collect(tree, type) {
  const result = [];
  (function visit(node) {
    if (node?.type === type) result.push(node);
    for (const child of node?.children || []) visit(child);
  })(tree);
  return result;
}

async function loadEmployerModal() {
  const react = makeReactMock();
  const toastCalls = [];
  const toast = synthetic('toast', { toast: { error: (message) => toastCalls.push(message) } });
  const namespace = await loadJsx(fileURLToPath(new URL('src/components/EmployerInquiryModal.jsx', root)), {
    react: react.module,
    'react-hot-toast': toast,
  });
  return { Modal: namespace.default, buildEmployerInquiry: namespace.buildEmployerInquiry, react, toastCalls };
}

test('buildEmployerInquiry menolak perusahaan/kebutuhan kosong atau hanya spasi', async () => {
  const { buildEmployerInquiry } = await loadEmployerModal();
  for (const input of [
    { company: '', whatsapp: '081234567890', needs: 'Butuh engineer' },
    { company: '   ', whatsapp: '081234567890', needs: 'Butuh engineer' },
    { company: 'PT Contoh', whatsapp: '081234567890', needs: '  ' },
  ]) {
    assert.throws(() => buildEmployerInquiry(input), /Nama perusahaan dan kebutuhan rekrutmen wajib diisi/);
  }
});

test('buildEmployerInquiry menerima nomor 08 dan +62, lalu meng-encode seluruh field ke nomor admin', async () => {
  const { buildEmployerInquiry } = await loadEmployerModal();
  const first = buildEmployerInquiry({ company: 'PT Maju & Anak', whatsapp: '0812 3456-7890', needs: '2 Sales / lokasi Jakarta & remote' });
  const second = buildEmployerInquiry({ company: 'PT Maju', whatsapp: '+62 (812) 3456.7890', needs: 'Butuh kandidat senior' });
  for (const [url, company, needs] of [[first, 'PT Maju & Anak', '2 Sales / lokasi Jakarta & remote'], [second, 'PT Maju', 'Butuh kandidat senior']]) {
    assert.match(url, /^https:\/\/wa\.me\/6285179905019\?text=/);
    const message = decodeURIComponent(new URL(url).searchParams.get('text'));
    assert.match(message, new RegExp(`Nama Perusahaan: ${company.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
    assert.match(message, /WhatsApp: 6281234567890/);
    assert.match(message, new RegExp(needs.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
    assert.ok(url.includes('%0A'), 'message must preserve encoded line breaks');
  }
});

test('buildEmployerInquiry menolak nomor invalid dan tidak menghasilkan admin yang salah', async () => {
  const { buildEmployerInquiry } = await loadEmployerModal();
  for (const whatsapp of ['', '123', 'abc081234567890', '081234567890123456']) {
    assert.throws(() => buildEmployerInquiry({ company: 'PT Contoh', whatsapp, needs: 'Staff' }), /nomor WhatsApp yang valid/);
  }
  assert.equal(new URL(buildEmployerInquiry({ company: 'PT Contoh', whatsapp: '081234567890', needs: 'Staff' })).pathname, '/6285179905019');
});

async function submitEmployer(fields) {
  const { Modal, react, toastCalls } = await loadEmployerModal();
  const opened = [];
  context.window = { open: (...args) => opened.push(args) };
  const getTree = react.beginRender(() => Modal({ isOpen: true, onClose() {} }));
  const controls = [...collect(getTree(), 'input'), ...collect(getTree(), 'textarea')];
  controls[0].props.onChange({ target: { value: fields.company } });
  controls[1].props.onChange({ target: { value: fields.whatsapp } });
  controls[2].props.onChange({ target: { value: fields.needs } });
  const form = find(getTree(), (node) => node.type === 'form');
  await form.props.onSubmit({ preventDefault() {} });
  return { opened, toastCalls, tree: getTree() };
}

test('modal hanya memanggil window.open untuk valid; valid submit menampilkan fallback yang belum mengklaim terkirim', async () => {
  const valid = await submitEmployer({ company: 'PT Contoh', whatsapp: '081234567890', needs: 'Staff gudang' });
  assert.equal(valid.opened.length, 1);
  assert.equal(valid.opened[0][1], '_blank');
  const status = find(valid.tree, (node) => node.props?.role === 'status');
  assert.ok(status);
  const statusText = JSON.stringify(status);
  assert.match(statusText, /WhatsApp belum terbuka/);
  assert.match(statusText, /baru terkirim setelah Anda menekan Kirim di WhatsApp/);
  assert.doesNotMatch(statusText, /terkirim\.$/);

  const invalid = await submitEmployer({ company: '   ', whatsapp: '081234567890', needs: 'Staff gudang' });
  assert.equal(invalid.opened.length, 0);
  assert.match(invalid.toastCalls[0], /wajib diisi/);
});

test('JobBoard me-wire dua entry employer, CTA job ke cover letter, generic cover-letter reset, dan pricing mobile tanpa horizontal scroll', async () => {
  const source = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');
  assert.match(source, /onOpenPostJob=\{\(\) => handleOpenEmployerInquiry\('navbar'\)\}/);
  assert.match(source, /<Footer onOpenEmployerInquiry=\{\(\) => handleOpenEmployerInquiry\('footer'\)\}/);
  assert.match(source, /trackEmployerInquiry\(source\);\s+openModal\('employer-inquiry'\)/);
  assert.match(source, /onOpenCoverLetter=\{handleOpenCoverLetter\}/);
  assert.match(source, /openModal\('cover-letter', job \? \{ title: job\.title, company: job\.company \} : null\)/);
  assert.match(source, /onOpenCoverLetter=\{\(\) => handleOpenCoverLetter\(\)\}/);
  assert.match(source, /initialJob=\{modal\?\.type === 'cover-letter' \? modal\.payload : null\}/);
  assert.match(source, /grid grid-cols-1 md:grid-cols-3 gap-5/);
  assert.match(source, /order-1 md:order-2[^\n]*Paket Profesional|Paket Profesional[\s\S]{0,500}order-1 md:order-2/);
  assert.match(source, /order-2 md:order-1[^\n]*Paket Express|Paket Express[\s\S]{0,500}order-2 md:order-1/);
  const pricingGrid = source.match(/<div className="grid grid-cols-1 md:grid-cols-3[\s\S]*?<\/div>\n\s*<\/div>/)?.[0] || '';
  assert.ok(pricingGrid && !/overflow-x-(?:auto|scroll)/.test(pricingGrid), 'pricing grid must not introduce horizontal scrolling');
});

test('JobBoard mempertahankan copy upsell Rp99.000 dan target paket callback yang sama', async () => {
  const board = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');
  const cover = await readFile(new URL('../src/components/AICoverLetterModal.jsx', import.meta.url), 'utf8');
  const checker = await readFile(new URL('../src/components/AICVCheckerModal.jsx', import.meta.url), 'utf8');
  assert.match(board, /Paket Profesional<\/h3>/);
  assert.match(board, /Rp 99\.000/);
  assert.match(board, /onSelectPackage\('Paket Profesional \(Rp 99\.000\)'\)/);
  for (const modal of [cover, checker]) {
    assert.match(modal, /onOpenOrderModal\('Paket Profesional \(Rp 99\.000\)'\)/);
    assert.match(modal, /<span>[^<]*Paket Profesional \(Rp 99\.000\)<\/span>/);
    assert.doesNotMatch(modal, /Mulai Rp 49k/);
  }
});

test('cover letter mem-prefill job baru dan menghapus deskripsi/generated letter lama saat effect reset berjalan', async () => {
  const cover = await readFile(new URL('../src/components/AICoverLetterModal.jsx', import.meta.url), 'utf8');
  const effect = cover.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[isOpen, initialJob\?\.title, initialJob\?\.company\]\);/);
  assert.ok(effect, 'prefill effect must rerun for modal visibility or job title/company changes');
  assert.match(effect[0], /setJobTitle\(initialJob\?\.title \|\| ''\)/);
  assert.match(effect[0], /setCompanyName\(initialJob\?\.company \|\| ''\)/);
  assert.match(effect[0], /setJobDesc\(''\)/);
  assert.match(effect[0], /setGeneratedLetter\(''\)/);
  assert.match(effect[0], /setIsFallback\(false\)/);
});
