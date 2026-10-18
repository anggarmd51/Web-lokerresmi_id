import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const analyticsPath = fileURLToPath(new URL('../src/lib/analytics.js', import.meta.url));

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadAnalytics(windowValue) {
  const context = vm.createContext({ window: windowValue, console });
  const source = await readFile(analyticsPath, 'utf8');
  const module = new vm.SourceTextModule(source, { context, identifier: analyticsPath });
  await module.link(() => {
    throw new Error('analytics.js should not import dependencies');
  });
  await module.evaluate();
  return module.namespace;
}

test('helpers return false safely when gtag is unavailable in SSR and browser contexts', async () => {
  const ssr = await loadAnalytics(undefined);
  assert.equal(ssr.trackEvent('page_view'), false);
  assert.equal(ssr.trackApply({ id: 1 }), false);

  const browserWithoutGtag = await loadAnalytics({});
  assert.equal(browserWithoutGtag.trackEmployerInquiry('footer'), false);
  assert.equal(browserWithoutGtag.trackCVPackage('Paket Express (Rp 49.000)', 'pricing'), false);
});

test('trackEvent catches a throwing gtag and does not propagate the error', async () => {
  const browser = await loadAnalytics({
    gtag() {
      throw new Error('analytics unavailable');
    },
  });
  assert.doesNotThrow(() => browser.trackEvent('test_event', { source: 'test' }));
  assert.equal(browser.trackEvent('test_event', { source: 'test' }), false);
});

test('trackApply sends only the job id and apply type', async () => {
  const calls = [];
  const analytics = await loadAnalytics({ gtag: (...args) => calls.push(args) });
  const job = {
    id: 42,
    applyType: 'whatsapp',
    title: 'Secret role',
    company: 'Private company',
    destination: 'https://private.example/apply',
    applicantEmail: 'person@example.com',
  };

  assert.equal(analytics.trackApply(job), true);
  assert.deepEqual(plain(calls), [['event', 'click_apply', { job_id: '42', apply_type: 'whatsapp' }]]);
  assert.doesNotMatch(JSON.stringify(calls), /Secret role|Private company|private\.example|person@example\.com/);

  assert.equal(analytics.trackApply({ id: 7 }), true);
  assert.deepEqual(plain(calls[1]), ['event', 'click_apply', { job_id: '7', apply_type: 'web' }]);
});

test('employer inquiry and CV package helpers send the specified event payloads', async () => {
  const calls = [];
  const analytics = await loadAnalytics({ gtag: (...args) => calls.push(args) });

  assert.equal(analytics.trackEmployerInquiry('footer_cta'), true);
  assert.equal(analytics.trackCVPackage('Paket Express (Rp 49.000)', 'pricing'), true);
  assert.equal(analytics.trackCVPackage('Paket Profesional (Rp 99.000)', 'modal'), true);
  assert.equal(analytics.trackCVPackage('Paket VIP Mentoring (Rp 249.000)', 'upsell'), true);
  assert.equal(analytics.trackCVPackage('Paket custom', 'modal'), true);

  assert.deepEqual(plain(calls), [
    ['event', 'open_employer_inquiry', { source: 'footer_cta' }],
    ['event', 'select_cv_package', {
      package_name: 'Paket Express (Rp 49.000)', source: 'pricing', currency: 'IDR', value: 49000,
    }],
    ['event', 'select_cv_package', {
      package_name: 'Paket Profesional (Rp 99.000)', source: 'modal', currency: 'IDR', value: 99000,
    }],
    ['event', 'select_cv_package', {
      package_name: 'Paket VIP Mentoring (Rp 249.000)', source: 'upsell', currency: 'IDR', value: 249000,
    }],
    ['event', 'select_cv_package', {
      package_name: 'Paket custom', source: 'modal', currency: 'IDR',
    }],
  ]);
});

test('index bootstrap enables only a real non-placeholder GA measurement ID', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bootstrap = index.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(bootstrap, 'index must contain an inline analytics bootstrap');

  function run(measurementId) {
    const appended = [];
    const context = vm.createContext({
      window: {},
      document: {
        head: { appendChild(node) { appended.push(node); } },
        createElement() { return {}; },
      },
      encodeURIComponent,
    });
    vm.runInContext(bootstrap.replace(/const measurementId = '[^']*';/, `const measurementId = '${measurementId}';`), context);
    return { window: context.window, appended };
  }

  for (const id of ['%VITE_GA_MEASUREMENT_ID%', 'G-XXXXXXXXXX', 'UA-123456']) {
    const result = run(id);
    assert.equal('gtag' in result.window, false, `invalid ID ${id} must not expose gtag`);
    assert.equal(result.appended.length, 0, `invalid ID ${id} must not load GA`);
  }

  const enabled = run('G-ABC123');
  assert.equal(typeof enabled.window.gtag, 'function');
  assert.ok(Array.isArray(enabled.window.dataLayer));
  const dataLayerCalls = Array.from(enabled.window.dataLayer, (args) => Array.from(args));
  assert.equal(dataLayerCalls[0][0], 'js');
  assert.equal(typeof dataLayerCalls[0][1], 'object');
  assert.deepEqual(dataLayerCalls[1], ['config', 'G-ABC123']);
  assert.equal(enabled.appended.length, 1);
  assert.equal(enabled.appended[0].async, true);
  assert.equal(enabled.appended[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-ABC123');
});

test('JobBoard wires tracking to apply, shared inquiry, pricing, upsell, and order form actions', async () => {
  const source = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');
  assert.match(source, /trackApply\(job\);/);
  assert.match(source, /trackEmployerInquiry\(source\);/);
  assert.match(source, /trackCVPackage\(packageName, replace \? 'ai_upsell' : 'pricing'\);/);
  assert.match(source, /trackCVPackage\(e\.target\.value, 'order_form'\);/);
  assert.match(source, /onOpenPostJob=\{\(\) => handleOpenEmployerInquiry\('navbar'\)\}/);
  assert.match(source, /<Footer onOpenEmployerInquiry=\{\(\) => handleOpenEmployerInquiry\('footer'\)\}/);
});
