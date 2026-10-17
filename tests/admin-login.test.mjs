import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const context = vm.createContext({ console, setTimeout, clearTimeout });

function synthetic(name, exports) {
  const module = new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context, identifier: name });
  return module;
}

async function loadSource(path, mocks = {}) {
  const source = await (path.endsWith('.jsx')
    ? transformWithEsbuild(await (await import('node:fs/promises')).readFile(path, 'utf8'), path, { loader: 'jsx', format: 'esm' }).then((r) => r.code)
    : (await import('node:fs/promises')).readFile(path, 'utf8'));
  const module = new vm.SourceTextModule(source, { context, identifier: path });
  await module.link(async (specifier, referencing) => {
    if (mocks[specifier]) return mocks[specifier];
    if (specifier === 'react') throw new Error(`Unexpected React import in ${path}`);
    if (specifier === 'react-hot-toast') throw new Error(`Unexpected toast import in ${path}`);
    if (specifier === '../lib/supabase') throw new Error('Supabase mock was not supplied');
    throw new Error(`Unexpected import ${specifier} from ${referencing.identifier}`);
  });
  await module.evaluate();
  return module.namespace.default;
}

function makeReactMock() {
  let values = [];
  let cursor = 0;
  let rerender = null;
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  };
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
      useEffect(effect) { effect(); },
    }),
    beginRender(fn) {
      values = [];
      let tree;
      rerender = () => { cursor = 0; tree = fn(); };
      rerender();
      return () => tree;
    },
    reset() { values = []; cursor = 0; rerender = null; },
  };
}

function makeSupabase(overrides = {}) {
  const calls = { signIn: [], signOut: [], rpc: [] };
  const supabase = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async (credentials) => { calls.signIn.push(credentials); return { data: { session: { user: credentials } }, error: null }; },
      signOut: async (options) => { calls.signOut.push(options); return { error: null }; },
    },
    rpc: async (...args) => { calls.rpc.push(args); return { data: true, error: null }; },
  };
  Object.assign(supabase.auth, overrides.auth || {});
  if (overrides.rpc) supabase.rpc = overrides.rpc;
  return { module: synthetic('supabase', { supabase }), supabase, calls };
}

async function loadHook(supabase) {
  // Capture the login API without mounting a browser or contacting Supabase.
  const state = [];
  let i = 0;
  const hookReact = synthetic('react-hook', {
    useState(initial) { const n = i++; state[n] ??= initial; return [state[n], (v) => { state[n] = typeof v === 'function' ? v(state[n]) : v; }]; },
    useEffect(effect) { effect(); },
  });
  const hooked = await loadSource(fileURLToPath(new URL('src/hooks/useAuth.js', root)), {
    react: hookReact,
    '../lib/supabase': supabase.module,
  });
  return hooked();
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

async function loadModal(toastCalls) {
  const react = makeReactMock();
  const toast = synthetic('toast', { toast: { error: (message) => toastCalls.push(['error', message]), success: (message) => toastCalls.push(['success', message]) } });
  const Modal = await loadSource(fileURLToPath(new URL('src/components/AdminLoginModal.jsx', root)), {
    react: react.module,
    'react-hot-toast': toast,
  });
  return { Modal, react };
}

async function submitModal(login, { onSuccess = () => {}, onLoginSuccess = () => {}, onClose = () => {} } = {}) {
  const toastCalls = [];
  const { Modal, react } = await loadModal(toastCalls);
  let props = { isOpen: true, login, onSuccess, onLoginSuccess, onClose };
  const getTree = react.beginRender(() => Modal(props));
  const tree = getTree();
  const inputs = [];
  (function collect(node) { if (node?.type === 'input') inputs.push(node); for (const child of node?.children || []) collect(child); })(tree);
  inputs[0].props.onChange({ target: { value: 'admin@example.com' } });
  inputs[1].props.onChange({ target: { value: 'password' } });
  const form = find(getTree(), (node) => node.type === 'form');
  await form.props.onSubmit({ preventDefault() {} });
  return toastCalls;
}

test('hook menolak non-admin, signOut local, dan memberi code serta teks yang stabil', async () => {
  const supabase = makeSupabase({ rpc: async () => ({ data: false, error: null }) });
  const auth = await loadHook(supabase);
  await assert.rejects(auth.login({ email: 'user@example.com', password: 'secret' }), (error) => {
    assert.equal(error.code, 'admin_access_denied');
    assert.equal(error.message, 'Akun ini tidak memiliki hak akses admin');
    return true;
  });
  assert.equal(supabase.calls.signOut.length, 1);
  assert.equal(supabase.calls.signOut[0].scope, 'local');
});

test('hook menerima kredensial admin valid dan mengembalikan true', async () => {
  const supabase = makeSupabase({ rpc: async () => ({ data: true, error: null }) });
  const auth = await loadHook(supabase);
  assert.equal(await auth.login({ email: 'admin@example.com', password: 'secret' }), true);
  assert.equal(supabase.calls.signIn.length, 1);
  assert.equal(supabase.calls.signIn[0].email, 'admin@example.com');
  assert.equal(supabase.calls.signIn[0].password, 'secret');
  assert.deepEqual(supabase.calls.signOut, []);
});

test('hook meneruskan error kredensial invalid tanpa mengubahnya menjadi akses admin', async () => {
  const invalid = Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' });
  const supabase = makeSupabase({ auth: { signInWithPassword: async () => ({ data: null, error: invalid }) } });
  const auth = await loadHook(supabase);
  await assert.rejects(auth.login({ email: 'x@example.com', password: 'bad' }), (error) => error === invalid);
  assert.deepEqual(supabase.calls.signOut, []);
});

test('modal menampilkan pesan aman untuk non-admin dengan prefix Gagal login', async () => {
  const error = Object.assign(new Error('Akun ini tidak memiliki hak akses admin'), { code: 'admin_access_denied' });
  const calls = await submitModal(async () => { throw error; });
  assert.deepEqual(calls, [['error', 'Gagal login: Akun ini tidak memiliki hak akses admin']]);
});

test('modal mempertahankan pesan credential invalid dan menyamarkan raw server error', async () => {
  const invalidCalls = await submitModal(async () => { throw new Error('Invalid login credentials'); });
  assert.deepEqual(invalidCalls, [['error', 'Gagal login: Email atau password yang Anda masukkan salah.']]);

  const secret = 'SQLSTATE secret stack trace at db.internal:5432';
  const rawCalls = await submitModal(async () => { throw new Error(secret); });
  assert.equal(rawCalls[0][0], 'error');
  assert.equal(rawCalls[0][1], 'Gagal login: Kredensial tidak valid atau akun tidak ditemukan.');
  assert.ok(!rawCalls[0][1].includes(secret));
});

test('modal sukses memanggil kedua callback, toast sukses, dan onClose', async () => {
  const events = [];
  const calls = await submitModal(async (credentials) => {
    assert.equal(credentials.email, 'admin@example.com');
    assert.equal(credentials.password, 'password');
  }, { onSuccess: () => events.push('success'), onLoginSuccess: () => events.push('loginSuccess'), onClose: () => events.push('close') });
  assert.deepEqual(events, ['success', 'loginSuccess', 'close']);
  assert.deepEqual(calls, [['success', 'Berhasil masuk sebagai Superadmin!']]);
});
