import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { SAMPLE_PDF_BASE64, decodeSamplePdf } from '../src/lib/sampleCv.js';

const pdf = Buffer.from(SAMPLE_PDF_BASE64, 'base64');

function objectOffsets(bytes) {
  const xrefAt = bytes.indexOf(Buffer.from('xref\n'));
  assert.ok(xrefAt >= 0, 'PDF must contain an xref table');
  const xrefEnd = bytes.indexOf(Buffer.from('trailer'), xrefAt);
  const rows = bytes.subarray(xrefAt, xrefEnd).toString('ascii').trimEnd().split('\n').slice(2);
  return rows.slice(1).map((row) => Number(row.slice(0, 10)));
}

test('shared sample is a valid deterministic PDF with consistent xref and stream length', () => {
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  const offsets = objectOffsets(pdf);
  for (const offset of offsets) assert.match(pdf.subarray(offset, offset + 8).toString('ascii'), /^\d+ 0 obj/);
  const streamStart = pdf.indexOf(Buffer.from('stream\n')) + 'stream\n'.length;
  const streamEnd = pdf.indexOf(Buffer.from('endstream'), streamStart);
  const declared = Number(pdf.toString('ascii', pdf.lastIndexOf('/Length ', streamStart) + 8, streamStart).split(/[\s>]/, 1)[0]);
  assert.equal(streamEnd - streamStart, declared);
  assert.match(pdf.toString('ascii'), /\/Font\s*<<\s*\/F1\s+5 0 R/);
  assert.match(pdf.toString('ascii'), /\/BaseFont\s*\/Helvetica/);
});

test('decoded fixture is binary PDF and pdftotext extracts the synthetic CV', async () => {
  assert.deepEqual(Buffer.from(decodeSamplePdf()), pdf);
  const path = '/tmp/lokerresmi-sample-cv-test.pdf';
  await writeFile(path, pdf);
  const result = spawnSync('pdftotext', [path, '-'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '', `pdftotext warnings: ${result.stderr}`);
  const text = result.stdout;
  assert.match(text, /Andi Pratama/);
  assert.match(text, /andi\.pratama@example\.com/);
  assert.match(text, /React Tailwind Git 2 years/);
  assert.match(text, /S1 Informatika/);
});

test('both modals use the shared fixture and decode bytes before creating sample Blob', async () => {
  for (const file of ['src/components/AICVCheckerModal.jsx', 'src/components/AICoverLetterModal.jsx']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /from ['']\.\.\/lib\/sampleCv['']/);
    assert.match(source, /new Blob\(\[decodeSamplePdf\(SAMPLE_PDF_BASE64\)\]/);
    assert.doesNotMatch(source, /new Blob\(\[SAMPLE_PDF_BASE64\]/);
    assert.match(source, /_sampleBase64\s*=\s*SAMPLE_PDF_BASE64/);
  }
});
