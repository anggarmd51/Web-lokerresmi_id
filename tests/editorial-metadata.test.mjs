import assert from 'node:assert/strict';
import test from 'node:test';
import { displaySource, displayDate, displayDeadline, getConfirmedDeadline } from '../src/lib/jobPresentation.js';

test('sumber publik hanya menerima HTTPS tanpa kredensial URL', () => {
  for (const source_url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.test/job', 'https://user:password@example.test/job', {}, null]) {
    assert.equal(displaySource({ source_url }), 'LokerResmi · detail lowongan');
  }
  assert.equal(displaySource({ source_url: 'https://example.test/job?id=12' }), 'https://example.test/job?id=12');
});

test('tanggal metadata kosong atau kalender tidak valid tidak menghasilkan klaim tanggal baru', () => {
  assert.equal(displayDate({}, String), 'Tidak dicantumkan');
  for (const valid_through of ['2026-02-30', '2026-13-01', '-', 'segera', null]) {
    assert.equal(getConfirmedDeadline({ valid_through }), '');
    assert.equal(displayDeadline({ valid_through }, String), 'Tidak dicantumkan');
  }
  assert.equal(displayDeadline({ valid_through: '2028-02-29' }, String), '2028-02-29');
});
