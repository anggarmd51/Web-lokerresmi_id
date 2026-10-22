import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const rgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
};

const luminance = (hex) => rgb(hex)
  .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (foreground, background) => {
  const [dark, light] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
};

const assertAA = (foreground, background, label) => {
  assert.ok(contrast(foreground, background) >= 4.5,
    `${label}: ${foreground} on ${background} is ${contrast(foreground, background).toFixed(2)}:1`);
};

test('warna harga dan paket CV memenuhi WCAG AA di light/dark untuk ketiga kartu', () => {
  const cards = ['Express', 'Profesional', 'VIP'];
  for (const card of cards) {
    assertAA('#1E2B45', '#FFFFFF', `${card} heading/price light`);
    assertAA('#334155', '#FFFFFF', `${card} feature light`);
    assertAA('#0F766E', '#FFFFFF', `${card} check light`);
    assertAA('#F1F5F9', '#0F172A', `${card} heading/price dark`);
    assertAA('#E2E8F0', '#0F172A', `${card} feature dark`);
    assertAA('#7DD3C7', '#0F172A', `${card} check dark`);
  }

  assertAA('#1E2B45', '#F8FAFC', 'section text light');
  assertAA('#334155', '#F8FAFC', 'promo description light');
  assertAA('#F1F5F9', '#020617', 'section text dark');
  assertAA('#CBD5E1', '#020617', 'promo description dark');

  for (const button of ['default', 'hover', 'active']) {
    const background = { default: '#0F766E', hover: '#115E59', active: '#134E4A' }[button];
    assertAA('#FFFFFF', background, `select button ${button}`);
  }
});

test('CVServicePromo mempertahankan kelas kontras, tiga kartu, dan handler bisnis', async () => {
  const source = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const CVServicePromo');
  const end = source.indexOf('const CommunitySection', start);
  assert.ok(start >= 0 && end > start, 'batas CVServicePromo harus ditemukan');
  const promo = source.slice(start, end);

  assert.match(promo, /id="cv-service"[^>]*className="[^"]*bg-slate-50[^\"]*dark:bg-slate-950[^\"]*text-navy[^\"]*dark:text-slate-100/);
  assert.equal((promo.match(/transition-\[border-color\]/g) ?? []).length, 3, 'ketiga kartu mengganti latar tema tanpa transisi kontras rendah');
  assert.equal((promo.match(/bg-white dark:bg-slate-900/g) ?? []).length, 3, 'tepat tiga kartu light/dark');
  assert.equal((promo.match(/text-navy dark:text-slate-100/g) ?? []).length, 8, 'heading/price/section menggunakan teks light/dark');
  assert.equal((promo.match(/text-slate-700 dark:text-slate-200/g) ?? []).length, 3, 'tepat tiga daftar fitur');
  assert.match(promo, /text-slate-700 dark:text-slate-300/, 'deskripsi header memakai teks terbaca');
  assert.equal((promo.match(/bg-teal hover:bg-\[#115E59\] active:bg-\[#134E4A\] text-white/g) ?? []).length, 5, 'semua tombol aksi memakai state kontras');
  assert.equal((promo.match(/className="[^"]*text-navy dark:text-slate-100 font-extrabold text-2xl/g) ?? []).length, 3, 'tepat tiga harga');
  assert.equal((promo.match(/<ul className="[^"]*text-slate-700 dark:text-slate-200/g) ?? []).length, 3, 'tepat tiga list fitur');

  assert.match(promo, /onSelectPackage\('Paket Express \(Rp 49\.000\)'\)/);
  assert.match(promo, /onSelectPackage\('Paket Profesional \(Rp 99\.000\)'\)/);
  assert.match(promo, /onSelectPackage\('Paket VIP Mentoring \(Rp 249\.000\)'\)/);
  assert.match(promo, /onClick=\{onOpenAIChecker\}/);
  assert.match(promo, /onClick=\{onOpenCoverLetter\}/);

  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /\.dark \.text-teal[^\{]*\{[^}]*#7DD3C7/i, 'check fitur dark memakai mint global');
});
