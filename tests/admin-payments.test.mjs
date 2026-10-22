import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/components/AdminPayments.jsx', import.meta.url), 'utf8');
const jobBoard = fs.readFileSync(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');

const validatorSource = source.match(/export function validatePaymentAmount[\s\S]*?\n}/)[0].replace('export ', '');
const validate = vm.runInNewContext(`(${validatorSource})`);

test('payment amount validation rejects empty, zero, oversized, and invalid precision values', () => {
  assert.equal(validate(''), false);
  assert.equal(validate('0'), false);
  assert.equal(validate('1000000000001'), false);
  assert.equal(validate('100.123'), false);
  assert.equal(validate('100.123', 'JPY'), false);
  assert.equal(validate('100.00'), true);
  assert.equal(validate('100', 'JPY'), true);
});

test('payment source uses explicit B2B columns, bounded query, and supported currencies', () => {
  assert.match(source, /select\(B2B_COLUMNS\)/);
  assert.match(source, /order\('created_at', \{ ascending: false \}\)\.limit\(100\)/);
  assert.match(source, /amount_paid: Number\(amount\), currency/);
  for (const currency of ['IDR', 'USD', 'SGD', 'MYR', 'EUR', 'AUD', 'GBP', 'JPY']) assert.match(source, new RegExp(currency));
});

test('payment source preserves immutable paid records and uses authenticated purchase endpoint', () => {
  assert.match(source, /if \(order\.paid_at\) return/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.match(source, /fetch\('\/api\/purchase'/);
  assert.match(source, /transaction_id: transactionId/);
  assert.doesNotMatch(source, /gtag\s*\(/);
});

test('JobBoard exposes the requested trusted-admin payments tab without changing CV hook wiring', () => {
  assert.match(jobBoard, /import AdminPayments from '\.\/AdminPayments'/);
  assert.match(jobBoard, /Pembayaran CV &amp; B2B/);
  assert.match(jobBoard, /<AdminPayments cvOrders=\{cvOrders\} onRefreshCV=\{fetchCVOrders\} \/>/);
  assert.match(jobBoard, /useCVOrders\(\{ isAdmin: isLoggedIn \}\)/);
});

test('payment source uses synchronous kind:id busy keys and guards new B2B submits', () => {
  assert.match(source, /busyKeys\.current\.has\(key\)/);
  assert.match(source, /orderKey\(order\.__kind, order\.id\)/);
  assert.match(source, /const key = 'new-b2b'/);
  assert.match(source, /if \(!beginBusy\(key\)\) return/);
});

test('delivery status is read from purchase_outbox without automatic send on refresh', () => {
  assert.match(source, /from\('purchase_outbox'\)\.select\('transaction_id,delivery_status'\)\.in\('transaction_id', transactionIds\)\.limit\(200\)/);
  assert.match(source, /transaction_id,delivery_status/);
  assert.match(source, /Trigger delivery only after the trusted database transition succeeds/);
  assert.ok(source.indexOf('if (error || !data)') < source.indexOf('await sendPurchaseAnalytics(data.transaction_id)'));
  assert.match(source, /Diterima endpoint GA4/);
  assert.match(source, /body\?\.status \|\|/);
});

test('delivery investigation button is limited to pending or unknown, and CV Lunas is paid-only', () => {
  assert.match(source, /value === 'pending' \|\| value === 'unknown'/);
  assert.match(jobBoard, /value="Lunas" disabled=\{!order\.paid_at\}/);
});
