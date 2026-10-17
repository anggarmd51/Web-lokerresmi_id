import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  closeModalHistory,
  initializeModalHistory,
  openJobHistory,
  openModalHistory,
  readNavigation,
} from '../src/lib/modalHistory.js';

// Model a browser with an external predecessor and asynchronous popstate.
function browser(path = '/') {
  const origin = 'https://lokerresmi.vercel.app';
  const entries = [{ url: 'https://external.example/', state: null }, { url: origin + path, state: null }];
  let index = 1;
  let pending = null;
  const listeners = new Map();
  const window = {
    get location() { return new URL(entries[index].url); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    history: {
      get state() { return entries[index].state; },
      get length() { return entries.length; },
      replaceState(state, _, url) { entries[index] = { state: structuredClone(state), url: new URL(url, window.location).href }; },
      pushState(state, _, url) {
        entries.splice(index + 1);
        entries.push({ state: structuredClone(state), url: new URL(url, window.location).href });
        index++;
      },
      back() { pending = -1; },
      forward() { pending = 1; },
    },
    flush() {
      if (pending !== null) index = Math.max(0, Math.min(entries.length - 1, index + pending));
      pending = null;
      listeners.get('popstate')?.({ state: window.history.state });
      return readNavigation(window);
    },
  };
  return window;
}

for (const type of ['cv-checker', 'cover-letter', 'employer-inquiry', 'cv-order', 'admin-login']) {
  test(`${type}: Back closes within the site and Forward restores the modal`, () => {
    const window = browser('/?source=mobile#cv-service');
    initializeModalHistory(window);
    const opened = openModalHistory(window, type, { title: 'Engineer' });
    assert.equal(opened.modal.type, type);
    assert.equal(window.location.href, 'https://lokerresmi.vercel.app/?source=mobile#cv-service');
    window.history.back();
    assert.equal(window.flush().modal, null);
    assert.equal(window.location.origin, 'https://lokerresmi.vercel.app');
    window.history.forward();
    assert.deepEqual(window.flush().modal, { type, payload: { title: 'Engineer' } });
    closeModalHistory(window);
    assert.equal(window.flush().modal, null);
    assert.equal(window.location.origin, 'https://lokerresmi.vercel.app');
  });
}

test('job detail opened from the feed returns to the exact feed URL', () => {
  const window = browser('/?q=developer#jobs');
  initializeModalHistory(window);
  assert.equal(openJobHistory(window, { id: 'abc-123' }).route.id, 'abc-123');
  closeModalHistory(window);
  assert.equal(window.flush().route.isDetail, false);
  assert.equal(window.location.href, 'https://lokerresmi.vercel.app/?q=developer#jobs');
  window.history.forward();
  assert.equal(window.flush().route.id, 'abc-123');
});

for (const path of ['/lowongan/abc-123?source=shared', '/#job-abc-123', '/lowongan/%E0%A4%A', '/missing']) {
  test(`direct entry ${path} gets an internal parent, including after reload`, () => {
    const window = browser(path);
    initializeModalHistory(window);
    const length = window.history.length;
    initializeModalHistory(window); // reload/StrictMode must not grow the stack
    assert.equal(window.history.length, length);
    window.history.back(); // mobile Back, not just the custom close button
    const next = window.flush();
    assert.equal(window.location.href, 'https://lokerresmi.vercel.app/');
    assert.equal(next.route.isDetail, false);
    assert.equal(next.modal, null);
  });
}

test('job -> cover letter -> order closes one layer at a time without leaving the site', () => {
  const window = browser('/#jobs');
  initializeModalHistory(window);
  openJobHistory(window, { id: '123' });
  openModalHistory(window, 'cover-letter', { title: 'Engineer', company: 'Acme' });
  const length = window.history.length;
  openModalHistory(window, 'cv-order', null, { replace: true });
  assert.equal(window.history.length, length);
  closeModalHistory(window);
  const detail = window.flush();
  assert.equal(detail.modal, null);
  assert.equal(detail.route.id, '123');
  closeModalHistory(window);
  window.flush();
  assert.equal(window.location.href, 'https://lokerresmi.vercel.app/#jobs');
});

test('AI modal order replacement does not resurrect the AI modal on Back', () => {
  const window = browser();
  openModalHistory(window, 'cv-checker');
  openModalHistory(window, 'cv-order', null, { replace: true });
  closeModalHistory(window);
  assert.equal(window.flush().modal, null);
  assert.equal(window.location.origin, 'https://lokerresmi.vercel.app');
});

test('unmanaged close falls back to home without touching an external predecessor', () => {
  const window = browser();
  closeModalHistory(window);
  window.flush();
  assert.equal(window.location.href, 'https://lokerresmi.vercel.app/');
});

test('reload preserves modal payload and does not add duplicate history entries', () => {
  const window = browser();
  openModalHistory(window, 'cover-letter', { title: 'Engineer', company: 'Acme' });
  const length = window.history.length;
  const next = initializeModalHistory(window);
  assert.equal(next.modal.payload.company, 'Acme');
  assert.equal(window.history.length, length);
  assert.throws(() => openModalHistory(window, 'unknown'));
});

test('hook synchronizes popstate, suppresses double-close, and removes listeners', async () => {
  const window = browser('/#jobs');
  const values = [];
  const cleanups = [];
  let cursor = 0;
  let mounted = false;
  const context = vm.createContext({ window });
  const historyModule = new vm.SyntheticModule(
    ['closeModalHistory', 'initializeModalHistory', 'openJobHistory', 'openModalHistory', 'readNavigation'],
    function () {
      for (const [key, value] of Object.entries({ closeModalHistory, initializeModalHistory, openJobHistory, openModalHistory, readNavigation })) this.setExport(key, value);
    }, { context },
  );
  const react = new vm.SyntheticModule(['useCallback', 'useEffect', 'useRef', 'useState'], function () {
    this.setExport('useCallback', (fn) => fn);
    this.setExport('useEffect', (fn) => { if (!mounted) cleanups.push(fn()); });
    this.setExport('useRef', (initial) => { const i = cursor++; return values[i] ??= { current: initial }; });
    this.setExport('useState', (initial) => {
      const i = cursor++;
      if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], (value) => { values[i] = value; }];
    });
  }, { context });
  const source = await readFile(new URL('../src/hooks/useJobRoute.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => specifier === 'react' ? react : historyModule);
  await module.evaluate();
  function render() { cursor = 0; const api = module.namespace.default(); mounted = true; return api; }
  let hook = render();
  hook.openJob({ id: '123' });
  hook = render();
  hook.openModal('cover-letter', { title: 'Engineer' });
  hook = render();
  assert.equal(hook.modal.type, 'cover-letter');
  hook.closeModal();
  hook.closeModal();
  hook.openModal('cv-checker'); // ignore new navigation until pending Back completes
  window.flush();
  hook = render();
  assert.equal(hook.modal, null);
  assert.equal(hook.route.id, '123');
  window.history.back();
  window.flush();
  hook = render();
  assert.equal(hook.route.isDetail, false);
  cleanups.forEach((fn) => fn());
  window.history.forward();
  window.flush();
  assert.equal(render().route.isDetail, false, 'unmounted listener must not update React state');
});

test('apply button is exactly KIRIM LAMARAN and public modals use history state', async () => {
  const source = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');
  assert.match(source, /<button onClick=\{handleApply\}[^>]*>\s*KIRIM LAMARAN\s*<\/button>/);
  assert.doesNotMatch(source, /Kirim Lamaran Sekarang/);
  for (const type of ['cv-checker', 'cover-letter', 'employer-inquiry', 'cv-order']) {
    assert.ok(source.includes(`isOpen={modal?.type === '${type}'}`));
  }
  assert.match(source, /<JobDetailModal job=\{modal \? null : selectedJob\}/);
});
