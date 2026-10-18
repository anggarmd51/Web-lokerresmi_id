import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { trackEmployerInquiryHandoff, trackFeaturedJobPackage } from '../lib/analytics';

// Gunakan kontak admin yang sama dengan alur pemesanan CV.
const ADMIN_WHATSAPP = '6285179905019';
export const EMPLOYER_PACKAGES = ['Standard', 'Featured Job', 'Paid placement'];

export function buildEmployerInquiry({ company, whatsapp, needs, packageName = 'Standard' }) {
  const cleanCompany = company.trim();
  const cleanNeeds = needs.trim();
  let cleanWhatsapp = whatsapp.trim().replace(/[\s().-]/g, '');
  if (cleanWhatsapp.startsWith('+')) cleanWhatsapp = cleanWhatsapp.slice(1);
  if (cleanWhatsapp.startsWith('0')) cleanWhatsapp = `62${cleanWhatsapp.slice(1)}`;

  if (!cleanCompany || !cleanNeeds) {
    throw new Error('Nama perusahaan dan kebutuhan rekrutmen wajib diisi.');
  }
  if (!/^\d{8,15}$/.test(cleanWhatsapp)) {
    throw new Error('Masukkan nomor WhatsApp yang valid (8–15 digit, dengan kode negara).');
  }
  if (!EMPLOYER_PACKAGES.includes(packageName)) {
    throw new Error('Pilih paket pemasangan yang tersedia.');
  }

  const message = `Halo Admin Lokerresmi.id, saya ingin berkonsultasi tentang pemasangan lowongan dan rekrutmen.\n\nPilihan Paket Pemasangan: ${packageName}\nNama Perusahaan: ${cleanCompany}\nWhatsApp: ${cleanWhatsapp}\nKebutuhan Rekrutmen: ${cleanNeeds}`;
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export default function EmployerInquiryModal({ isOpen, onClose }) {
  const [company, setCompany] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [needs, setNeeds] = useState('');
  const [packageName, setPackageName] = useState('Standard');
  const [inquiryUrl, setInquiryUrl] = useState('');
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button, input, select, textarea, a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    try {
      const url = buildEmployerInquiry({ company, whatsapp, needs, packageName });
      trackFeaturedJobPackage(packageName, 'employer_inquiry');
      trackEmployerInquiryHandoff(packageName, 'whatsapp');
      setInquiryUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal outline-none';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="employer-inquiry-title" aria-describedby="employer-inquiry-description" className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onClose} aria-label="Tutup inquiry perusahaan" className="absolute right-3 top-3 h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">✕</button>
        <h2 id="employer-inquiry-title" className="pr-10 text-xl font-bold text-navy dark:text-white">Kebutuhan Rekrutmen Perusahaan</h2>
        <p id="employer-inquiry-description" className="mt-2 mb-5 text-sm text-slate-600 dark:text-slate-300">Ceritakan kebutuhan tim Anda. Admin akan membantu pemasangan lowongan melalui WhatsApp.</p>
        <form onSubmit={handleSubmit} onChange={() => setInquiryUrl('')} className="space-y-4 text-sm">
          <div>
            <label htmlFor="employer-company" className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Nama Perusahaan</label>
            <input id="employer-company" autoComplete="organization" required maxLength={150} value={company} onChange={(event) => setCompany(event.target.value)} className={inputClass} placeholder="Contoh: PT Maju Bersama" />
          </div>
          <div>
            <label htmlFor="employer-package" className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Paket Pemasangan</label>
            <select id="employer-package" value={packageName} onChange={(event) => setPackageName(event.target.value)} className={inputClass}>
              {EMPLOYER_PACKAGES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Harga dan detail layanan dikonfirmasi admin; belum ada pembayaran melalui form ini.</p>
          </div>
          <div>
            <label htmlFor="employer-whatsapp" className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">WhatsApp</label>
            <input id="employer-whatsapp" type="tel" autoComplete="tel" required maxLength={25} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className={inputClass} placeholder="Contoh: 081234567890 atau +6281234567890" />
          </div>
          <div>
            <label htmlFor="employer-needs" className="block mb-1 font-semibold text-slate-700 dark:text-slate-300">Kebutuhan Rekrutmen</label>
            <textarea id="employer-needs" required maxLength={2000} rows={4} value={needs} onChange={(event) => setNeeds(event.target.value)} className={inputClass} placeholder="Posisi, jumlah kandidat, lokasi, dan target waktu rekrutmen" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Data diteruskan ke WhatsApp admin, bukan disimpan melalui form ini. Tekan Kirim di WhatsApp untuk mengirim inquiry Anda.</p>
          <button type="submit" className="w-full min-h-[46px] rounded-xl bg-teal hover:bg-teal/90 py-3 px-4 font-bold text-navy">Lanjutkan ke WhatsApp Admin</button>
          {inquiryUrl && (
            <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
              Jika WhatsApp belum terbuka, <a href={inquiryUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-teal underline">buka inquiry di WhatsApp</a>. Inquiry baru terkirim setelah Anda menekan Kirim di WhatsApp.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
