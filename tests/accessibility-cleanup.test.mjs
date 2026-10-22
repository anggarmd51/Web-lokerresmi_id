import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const ratio = (foreground, background) => {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
};

test('cleanup aksesibilitas mempertahankan kontras minimum dan props Hero tetap minimal', async () => {
  const modal = await readFile(new URL('../src/components/AdminLoginModal.jsx', import.meta.url), 'utf8');
  const board = await readFile(new URL('../src/components/JobBoard.jsx', import.meta.url), 'utf8');

  assert.match(modal, /dark:bg-slate-900/);
  assert.match(modal, /dark:text-slate-200/);
  assert.match(modal, /dark:bg-slate-800/);
  assert.ok(ratio('#E2E8F0', '#0F172A') >= 4.5, 'label modal dark harus WCAG AA');
  assert.ok(ratio('#F8FAFC', '#1E293B') >= 4.5, 'teks input modal dark harus WCAG AA');

  assert.match(board, /text-slate-600 dark:text-slate-200[^>]*>Ikuti kanal komunitas/);
  assert.match(board, /bg-teal hover:bg-\[#115E59\] active:bg-\[#134E4A\][^>]*>Gabung Grup Komunitas Loker/);
  assert.match(board, /text-slate-200 text-xs[^>]*>©/);
  assert.ok(ratio('#475569', '#F0FDFA') >= 4.5, 'deskripsi komunitas light harus WCAG AA');
  assert.ok(ratio('#E2E8F0', '#123F3D') >= 4.5, 'deskripsi komunitas dark harus WCAG AA');
  assert.ok(ratio('#FFFFFF', '#0F766E') >= 4.5, 'tombol WhatsApp default harus WCAG AA');
  assert.ok(ratio('#FFFFFF', '#115E59') >= 4.5, 'tombol WhatsApp hover harus WCAG AA');
  assert.ok(ratio('#E2E8F0', '#1E2B45') >= 4.5, 'copyright footer harus WCAG AA');

  assert.match(board, /const Hero = \(\{ searchTerm, setSearchTerm, locationTerm, setLocationTerm, landing, activeCount \}\)/);
  assert.doesNotMatch(board, /<Hero[^>]*selectedTag=/);
  assert.match(board, /const \[selectedTag, setSelectedTag\] = useState\('\'\)/);
});
