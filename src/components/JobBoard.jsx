import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Calendar, ExternalLink, Facebook, Instagram, Linkedin, MapPin, Moon, Music2, Search, SearchX, SlidersHorizontal, Sun, Sparkles, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { sortJobsByFeatured } from '../lib/utils';
import { trackApply, trackEmployerInquiry, trackCVPackage } from '../lib/analytics';
import useAuth from '../hooks/useAuth';
import useJobs from '../hooks/useJobs';
import useJobRoute from '../hooks/useJobRoute';
import { jobPath, updatePageMetadata } from '../lib/seo';
import { filterJobsForLanding } from '../lib/landingPages';
import useJobActions from '../hooks/useJobActions';
import useCVOrders from '../hooks/useCVOrders';
import useSiteStats from '../hooks/useSiteStats';
import useDarkMode from '../hooks/useDarkMode';
import AdminLoginModal from './AdminLoginModal';
import RequirementsInput, { parseRequirements, formatRequirementsToText } from './RequirementsInput';
import { JobFeedSkeleton } from './LoadingSkeleton';
import JobPostingSchema from './JobPostingSchema';
import QuickShareButton from './QuickShareButton';
import AICVCheckerModal from './AICVCheckerModal';
import AICoverLetterModal from './AICoverLetterModal';
import EmployerInquiryModal from './EmployerInquiryModal';
import { displayDate, displayDeadline, displayJobType, displaySalary, displaySource } from '../lib/jobPresentation';

const publicCategories = ['IT & Software', 'Sales & Marketing', 'Keuangan/Akuntansi', 'HRD/Personalia', 'Administrasi', 'Teknik/Engineering', 'Logistik/Operasional', 'Pelayanan Pelanggan'];

const formatJobDate = (dateVal) => {
  if (!dateVal) return 'Baru Saja';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return String(dateVal);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatJobTime = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
};

const Navbar = ({ onOpenPostJob, onOpenAdminLogin, isAdmin, isDark, toggleDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeMenu = () => setIsOpen(false);
  return (
    <nav className="editorial-nav bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800">
      <div className="editorial-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[68px] items-center justify-between gap-4">
          <a href="#top" className="editorial-brand flex items-center gap-3" onClick={closeMenu}>
            <img src="/logo.png" alt="Logo Lokerresmi.id" className="h-9 w-auto object-contain" />
            <span className="editorial-wordmark">LokerResmi<span>.id</span></span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href="#jobs" className="editorial-nav-link hover:text-teal">Cari Lowongan</a>
            <a href="#cv-service" className="editorial-nav-link hover:text-teal">Layanan Karier</a>
            <button type="button" onClick={onOpenPostJob} className="editorial-nav-link editorial-company-nav hover:text-teal">Untuk Perusahaan ↗</button>
            <button type="button" onClick={onOpenAdminLogin} className="editorial-nav-link editorial-login hover:text-teal">{isAdmin ? 'Dashboard Admin' : 'Masuk'}</button>
            <button type="button" onClick={toggleDarkMode} aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'} className="editorial-theme-toggle rounded-lg border border-slate-300 dark:border-slate-700 p-2 hover:border-teal">
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button type="button" onClick={toggleDarkMode} aria-label="Ubah mode warna" className="rounded-lg border border-slate-300 p-2 dark:border-slate-700">{isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}</button>
            <button type="button" onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen} aria-label="Buka menu" className="rounded-lg border border-slate-300 p-2 dark:border-slate-700"><SlidersHorizontal className="h-5 w-5" /></button>
          </div>
        </div>
        {isOpen && <div className="editorial-mobile-menu flex flex-col gap-1 border-t border-slate-200 py-3 dark:border-slate-800 md:hidden">
          <a href="#jobs" onClick={closeMenu} className="rounded-lg px-3 py-3 font-semibold">Cari Lowongan</a>
          <a href="#cv-service" onClick={closeMenu} className="rounded-lg px-3 py-3 font-semibold">Layanan Karier</a>
          <button type="button" onClick={() => { closeMenu(); onOpenPostJob(); }} className="rounded-lg px-3 py-3 text-left font-semibold">Untuk Perusahaan ↗</button>
          <button type="button" onClick={() => { closeMenu(); onOpenAdminLogin(); }} className="rounded-lg px-3 py-3 text-left font-semibold">{isAdmin ? 'Dashboard Admin' : 'Masuk'}</button>
        </div>}
      </div>
    </nav>
  );
};

const Hero = ({ searchTerm, setSearchTerm, locationTerm, setLocationTerm, selectedTag, setSelectedTag, landing, activeCount }) => {
  return (
    <section id="top" className="editorial-hero px-4 py-8 text-navy">
      <div className="editorial-container relative mx-auto max-w-7xl">
        <div className="editorial-hero-heading">
          <p className="editorial-eyebrow text-xs font-bold uppercase tracking-[0.18em] text-teal">Langkah berikutnya, lebih jelas.</p>
          <h1 className="editorial-hero-title max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">{landing?.h1 || <>Temukan pekerjaan.<br /><span className="text-teal">Tentukan langkahmu.</span></>}</h1>
          <p className="editorial-hero-description text-sm leading-relaxed text-slate-600">Mulai dari posisi dan kota yang kamu tuju. Baca informasi penting, lalu telusuri sumbernya.</p>
        </div>
        <div className="editorial-search-panel mt-6 grid gap-2 rounded-xl bg-white p-2 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-left"><Search className="h-5 w-5 shrink-0 text-slate-400" /><span className="flex-1"><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Posisi atau perusahaan</span><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Contoh: IT Engineer, Indofood" className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" /></span></label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2 text-left"><MapPin className="h-5 w-5 shrink-0 text-slate-400" /><span className="flex-1"><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Kota atau kabupaten</span><input value={locationTerm} onChange={(e) => setLocationTerm(e.target.value)} placeholder="Contoh: Medan, Semarang" className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" /></span></label>
          <button type="button" onClick={() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl bg-teal px-6 py-3 font-bold text-white hover:bg-teal/90">Cari lowongan</button>
        </div>
        <div className="editorial-hero-foot mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600"><span className="h-2 w-2 rounded-full bg-teal" /><strong className="text-navy dark:text-white">{activeCount} lowongan aktif</strong><span aria-hidden="true">/</span><span>Data langsung dari inventori publik saat ini</span></div>

      </div>
    </section>
  );
};

const StatsBar = ({ totalJobs }) => (
  <div className="editorial-inventory-note border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="editorial-container mx-auto max-w-7xl px-4 py-4 text-sm text-slate-600 dark:text-slate-300"><strong className="text-navy dark:text-white">{totalJobs} lowongan aktif tercatat.</strong> Jumlah ini mengikuti inventori publik dan dapat berubah saat data diperbarui.</div></div>
);

const JobFeed = ({ jobs, onSelectJob, searchTerm, locationTerm, selectedTag, setSelectedTag, onResetFilters, loading, landing }) => {
  const [visibleCount, setVisibleCount] = useState(6);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sortOrder, setSortOrder] = useState('featured');
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const types = [...new Set(jobs.filter((j) => j.status === 'Aktif').map((j) => displayJobType(j.type)).filter(Boolean))];
  const filteredJobs = useMemo(() => {
    const query = (searchTerm || '').toLowerCase().trim(); const place = (locationTerm || '').toLowerCase().trim();
    const result = jobs.filter((job) => {
      if (job.status !== 'Aktif') return false;
      const haystack = [job.title, job.company].filter(Boolean).join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (!place || String(job.location || '').toLowerCase().includes(place)) && (!selectedTag || job.category === selectedTag) && (!selectedTypes.length || selectedTypes.includes(displayJobType(job.type)));
    });
    if (sortOrder === 'latest') return [...result].sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));
    if (sortOrder === 'deadline') return [...result].sort((a, b) => { const da = getDeadlineTime(a); const db = getDeadlineTime(b); return (da || Infinity) - (db || Infinity); });
    return sortJobsByFeatured(result);
  }, [jobs, searchTerm, locationTerm, selectedTag, selectedTypes, sortOrder]);
  function getDeadlineTime(job) { const value = job.valid_through ?? job.validThrough ?? job.deadline; const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0; }
  useEffect(() => setVisibleCount(6), [searchTerm, locationTerm, selectedTag, selectedTypes, sortOrder]);
  const reset = () => { setSelectedTypes([]); setSortOrder('featured'); onResetFilters(); };
  return <section id="jobs" className="editorial-jobs editorial-container mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between"><div><p className="editorial-eyebrow text-xs font-bold uppercase tracking-[0.18em] text-teal">Daftar lowongan</p><h2 className="mt-2 text-2xl font-extrabold text-navy dark:text-white sm:text-3xl">{landing ? `Lowongan ${landing.key === 'fresh-graduate' ? 'Fresh Graduate' : 'di ' + landing.location}` : 'Peluang yang tersedia'}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{filteredJobs.length} hasil sesuai pencarian dan filter.</p></div><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><ArrowUpDown className="h-4 w-4" /><span>Urutkan</span><select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-900"><option value="featured">Unggulan terlebih dahulu</option><option value="latest">Terbaru</option><option value="deadline">Batas waktu terdekat</option></select></label></div>
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]"><aside className="editorial-filter h-fit rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><details open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}><summary className="flex items-center justify-between gap-2 font-bold text-navy dark:text-white"><span>Filter lowongan</span><SlidersHorizontal className="h-4 w-4 text-teal" /></summary><label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">Bidang pekerjaan<select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-800"><option value="">Semua bidang</option>{publicCategories.map((cat) => <option key={cat}>{cat}</option>)}</select></label><fieldset className="mt-5"><legend className="text-xs font-bold uppercase tracking-wide text-slate-500">Jenis pekerjaan</legend><div className="mt-2 space-y-2">{types.map((type) => <label key={type} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={selectedTypes.includes(type)} onChange={(e) => setSelectedTypes((current) => e.target.checked ? [...current, type] : current.filter((item) => item !== type))} />{type}</label>)}</div></fieldset><button type="button" onClick={reset} className="mt-5 text-sm font-bold text-teal hover:underline">Reset filter & pencarian</button></details></aside>
      <div><p className="mb-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Gaji dan batas waktu mengikuti field data lowongan. Jika belum dicantumkan di sini, periksa deskripsi dan sumber sebelum melamar.</p>{loading ? <JobFeedSkeleton count={6} /> : filteredJobs.length === 0 ? <div className="editorial-empty rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700"><SearchX className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-4 text-xl font-bold text-navy dark:text-white">Lowongan tidak ditemukan</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">Coba ubah kata kunci atau reset filter untuk melihat seluruh lowongan aktif.</p><button type="button" onClick={reset} className="mt-5 rounded-lg bg-navy px-4 py-2.5 text-sm font-bold text-white dark:bg-teal dark:text-white">Reset filter</button></div> : <><div className="editorial-job-list divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">{filteredJobs.slice(0, visibleCount).map((job) => { const featured = Boolean(job.featured || job.is_featured); const source = displaySource(job); return <article key={job.id} className={`editorial-job-card group cursor-pointer py-6 first:pt-2 ${featured ? 'editorial-job-card--featured' : ''}`} onClick={() => onSelectJob(job)}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold leading-tight text-navy group-hover:text-teal dark:text-white">{job.title}</h3>{featured && <span className="rounded-full bg-teal px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">FEATURED · PENEMPATAN UNGGULAN</span>}</div><p className="mt-1 font-semibold text-slate-700 dark:text-slate-300">{job.company}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-teal" />{job.location || 'Lokasi tidak dicantumkan'}</span><span>{displayJobType(job.type)}</span></div></div><a href={jobPath(job.id)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectJob(job); }} className="shrink-0 text-sm font-semibold text-teal">Lihat detail →<span className="sr-only"> {job.title}</span></a></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span><b className="text-slate-500 dark:text-slate-400">Gaji</b><br /><strong className="text-slate-800 dark:text-white">{displaySalary(job.salary)}</strong></span><span><b className="text-slate-500 dark:text-slate-400">Batas waktu</b><br /><strong className="text-slate-800 dark:text-white">{displayDeadline(job, formatJobDate)}</strong></span></div><div className="editorial-source-meta mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><span>Sumber: {source !== 'LokerResmi · detail lowongan' ? <a href={source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-teal hover:underline">Situs sumber <ExternalLink className="inline h-3 w-3" /></a> : source}</span><span>Terdaftar {displayDate(job, formatJobDate)}</span></div></article>; })}</div>{visibleCount < filteredJobs.length && <button type="button" onClick={() => setVisibleCount((n) => n + 6)} className="mt-8 rounded-lg bg-navy px-5 py-3 font-bold text-white dark:bg-slate-800">Muat lebih banyak</button>}</>}</div></div>
  </section>;
};

const CVServicePromo = ({ onSelectPackage, onOpenAIChecker, onOpenCoverLetter }) => {
  return (
    <div id="cv-service" className="bg-slate-50 dark:bg-slate-950 py-10 sm:py-16 text-navy dark:text-slate-100 my-8 sm:my-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="bg-teal text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
            Layanan Karir Profesional
          </span>
          <h2 className="text-2xl sm:text-3xl text-navy dark:text-slate-100 font-extrabold mt-3 mb-3 sm:mb-4">
            Buat CV ATS-Friendly & Optimasi LinkedIn
          </h2>
          <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm md:text-base mb-6 leading-relaxed">
            Susun CV yang mudah dibaca sistem ATS dengan format yang rapi dan bahasa profesional.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAIChecker}
              className="bg-teal hover:bg-[#115E59] active:bg-[#134E4A] text-white font-bold px-5 py-3.5 sm:py-3 rounded-xl shadow-xs transition w-full sm:w-auto text-xs sm:text-sm cursor-pointer active:scale-98 inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Cek Skor CV dengan AI (Gratis)</span>
            </button>
            <button
              type="button"
              onClick={onOpenCoverLetter}
              className="bg-teal hover:bg-[#115E59] active:bg-[#134E4A] text-white font-bold px-5 py-3.5 sm:py-3 rounded-xl border border-teal shadow-xs transition w-full sm:w-auto text-xs sm:text-sm cursor-pointer active:scale-98 inline-flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4 text-white" />
              <span>AI Cover Letter Generator (Gratis)</span>
            </button>
          </div>
        </div>

        {/* Profesional tampil pertama di mobile; desktop tetap Express, Profesional, VIP. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-4 pt-2">
          {/* Tier 1: Paket Express */}
          <div className="order-2 md:order-1 min-w-0 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-slate-700 flex flex-col justify-between transition-[border-color] hover:border-teal dark:hover:border-teal">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-base sm:text-lg text-navy dark:text-slate-100">Paket Express</h3>
              </div>
              <div className="text-navy dark:text-slate-100 font-extrabold text-2xl sm:text-3xl mb-4">Rp 49.000</div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 mb-6">
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Format ATS Teruji</span></li>
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Template Premium</span></li>
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>AI Generated Content</span></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onSelectPackage('Paket Express (Rp 49.000)')}
              className="w-full bg-teal hover:bg-[#115E59] active:bg-[#134E4A] text-white font-bold py-2.5 sm:py-3 rounded-xl transition cursor-pointer text-xs sm:text-sm active:scale-98"
            >
              Pilih Paket
            </button>
          </div>

          {/* Tier 2: Paket Profesional (Populer) */}
          <div className="order-1 md:order-2 min-w-0 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border-2 border-teal relative flex flex-col justify-between shadow-xl transition-[border-color] hover:border-teal/80">
            <div className="absolute -top-3 right-5 bg-teal text-white text-[10px] sm:text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              Populer
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-base sm:text-lg text-navy dark:text-slate-100">Paket Profesional</h3>
              </div>
              <div className="text-navy dark:text-slate-100 font-extrabold text-2xl sm:text-3xl mb-4">Rp 99.000</div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 mb-6">
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Format ATS yang terstruktur</span></li>
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Redaksi Bahasa Profesional & SEO</span></li>
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Konsultasi & Revisi Tanpa Batas</span></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onSelectPackage('Paket Profesional (Rp 99.000)')}
              className="w-full bg-teal hover:bg-[#115E59] active:bg-[#134E4A] text-white font-black py-2.5 sm:py-3 rounded-xl transition cursor-pointer text-xs sm:text-sm active:scale-98 shadow-sm"
            >
              Pilih Paket
            </button>
          </div>

          {/* Tier 3: Paket VIP Mentoring */}
          <div className="order-3 min-w-0 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-slate-700 flex flex-col justify-between transition-[border-color] hover:border-teal dark:hover:border-teal">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-base sm:text-lg text-navy dark:text-slate-100">Paket VIP Mentoring</h3>
              </div>
              <div className="text-navy dark:text-slate-100 font-extrabold text-2xl sm:text-3xl mb-4">Rp 249.000</div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 mb-6">
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Semua di Paket Pro</span></li>
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Simulasi Interview HR</span></li>
                <li className="flex items-start gap-2"><span className="text-teal font-bold">✓</span><span>Dukungan persiapan karier</span></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onSelectPackage('Paket VIP Mentoring (Rp 249.000)')}
              className="w-full bg-teal hover:bg-[#115E59] active:bg-[#134E4A] text-white font-bold py-2.5 sm:py-3 rounded-xl transition cursor-pointer text-xs sm:text-sm active:scale-98"
            >
              Pilih Paket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CommunitySection = () => (
  <div id="community" className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <div className="bg-teal/10 border border-teal/20 rounded-2xl p-6 sm:p-12 shadow-xs">
      <h2 className="text-xl sm:text-3xl font-bold text-navy mb-2 sm:mb-3">Gabung Komunitas Loker Resmi (Lokerresmi.id)</h2>
      <p className="text-slate-600 max-w-xl mx-auto mb-5 sm:mb-6 text-xs sm:text-sm leading-relaxed">Ikuti kanal komunitas untuk membaca pembaruan lowongan dan informasi karier.</p>
      <a href="https://chat.whatsapp.com/E00jf6uXmuF742oQjkvn39?s=cl&p=a&mlu=4" target="_blank" rel="noopener noreferrer" className="bg-teal hover:bg-teal/90 active:bg-teal text-white font-bold px-6 sm:px-8 py-3.5 sm:py-3 rounded-xl shadow-xs transition inline-block w-full sm:w-auto text-xs sm:text-sm cursor-pointer active:scale-98">Gabung Grup Komunitas Loker</a>
    </div>
  </div>
);

const Footer = ({ onOpenEmployerInquiry }) => (
  <footer className="bg-navy text-white pt-12 pb-6 border-t border-slate-800">
    <nav aria-label="Jelajahi lowongan" className="mx-auto mb-8 flex max-w-7xl flex-wrap justify-center gap-4 px-4 text-sm text-slate-200"><a href="/lowongan-kerja/medan" className="hover:underline">Loker Medan</a><a href="/lowongan-admin/medan" className="hover:underline">Admin Medan</a><a href="/lowongan-fresh-graduate" className="hover:underline">Fresh Graduate</a><a href="#community" className="hover:underline">Komunitas</a></nav>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div className="inline-block bg-white/5 px-4 py-2 rounded-xl mb-2">
        <span className="text-lg font-bold tracking-[0.2em] uppercase text-white">LOKERRESMI.ID</span>
      </div>
      <p className="text-slate-400 text-sm mb-5 max-w-lg mx-auto">Informasi lowongan kerja dan layanan karier LokerResmi.id.</p>

      <button type="button" onClick={onOpenEmployerInquiry} className="mb-5 min-h-[44px] rounded-xl border border-teal/40 px-5 py-3 text-sm font-bold text-teal hover:bg-white/10 transition">
        Untuk Perusahaan
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
        <a href="https://www.instagram.com/lokerresmi_id?stkn=MWtwcTJjbnUydHVsag==" target="_blank" rel="noopener noreferrer" aria-label="Instagram Lokerresmi.id" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-400/60 hover:bg-gradient-to-r hover:from-pink-500/20 hover:to-orange-400/20 hover:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-pink-300 transition-colors duration-300 group-hover:bg-pink-500/20 group-hover:text-pink-200">
            <Instagram className="h-4 w-4" />
          </span>
          <span className="font-medium">@lokerresmi_id</span>
        </a>
        <a href="https://www.tiktok.com/@lokerresmi_id?_r=1&_t=ZS-9A9A8EQU2js" target="_blank" rel="noopener noreferrer" aria-label="TikTok Lokerresmi.id" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300/60 hover:bg-slate-100/10 hover:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-200 transition-colors duration-300 group-hover:bg-slate-100/20 group-hover:text-white">
            <Music2 className="h-4 w-4" />
          </span>
          <span className="font-medium">@lokerresmi_id</span>
        </a>
        <a href="https://www.linkedin.com/company/lokerresmiid/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Lokerresmi.id" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-blue-300 transition-colors duration-300 group-hover:bg-blue-500/20 group-hover:text-blue-100">
            <Linkedin className="h-4 w-4" />
          </span>
          <span className="font-medium">lokerresmiid</span>
        </a>
        <a href="https://www.facebook.com/lokerresmi.id" target="_blank" rel="noopener noreferrer" aria-label="Facebook Lokerresmi.id" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-blue-600/10 hover:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-blue-400 transition-colors duration-300 group-hover:bg-blue-600/20 group-hover:text-blue-100">
            <Facebook className="h-4 w-4" />
          </span>
          <span className="font-medium">lokerresmi.id</span>
        </a>
      </div>

      <p className="text-slate-500 text-xs">© {new Date().getFullYear()} Lokerresmi.id. Seluruh hak cipta dilindungi.</p>
    </div>
  </footer>
);

const normalizeWhatsappNumber = (value = '') => {
  const raw = String(value).trim();
  if (!raw) return '';

  const withoutSpaces = raw.replace(/\s+/g, '');
  let normalized = withoutSpaces.replace(/[^\d+]/g, '');

  if (!normalized) return '';
  if (normalized.startsWith('62')) return normalized;
  if (normalized.startsWith('0')) return `62${normalized.slice(1)}`;
  return normalized.startsWith('+') ? normalized.replace('+', '') : normalized;
};

const JobDetailModal = ({ job, onClose, onApplyTrack, onOpenCoverLetter }) => {
  if (!job) return null;
  if (job.status && job.status !== 'Aktif') return null;

  const handleApply = () => {
    trackApply(job);
    if (!job.applyTarget || !job.applyTarget.trim()) {
      toast.error(`Informasi lamaran untuk posisi ${job.title} belum tersedia.`);
      return;
    }

    onApplyTrack(job.id);

    const applyType = (job.applyType || '').toLowerCase();
    const safeTarget = job.applyTarget.trim();

    if (applyType === 'whatsapp') {
      const normalizedWa = normalizeWhatsappNumber(safeTarget);
      if (!normalizedWa) {
        toast.error(`Informasi lamaran untuk posisi ${job.title} belum tersedia.`);
        return;
      }

      const message = encodeURIComponent(`Halo, saya ingin melamar posisi ${job.title} di ${job.company} melalui Lokerresmi.id`);
      window.open(`https://wa.me/${normalizedWa}?text=${message}`, '_blank', 'noopener,noreferrer');
      toast.success(`Lamaran untuk ${job.title} siap dikirim melalui WhatsApp.`);
      return;
    }

    if (applyType === 'email') {
      window.location.href = `mailto:${safeTarget}?subject=${encodeURIComponent(`Lamaran ${job.title} - ${job.company}`)}`;
      toast.success(`Lamaran untuk ${job.title} siap dikirim via email.`);
      return;
    }

    let targetUrl = safeTarget;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Lamaran untuk ${job.title} sedang dibuka di form pelamaran.`);
  };

  const buttonClass = (job.applyType || '').toLowerCase() === 'whatsapp'
    ? 'w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold py-3.5 sm:py-3 rounded-xl transition shadow text-center block cursor-pointer active:scale-98'
    : 'w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 sm:py-3 rounded-xl transition shadow text-center block cursor-pointer active:scale-98';

  const jobReqs = Array.isArray(job.requirements)
    ? job.requirements
    : parseRequirements(job.requirements);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="job-detail-title" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto border border-transparent dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-800 transition font-bold text-base z-20 shadow-xs cursor-pointer"
          title="Tutup Modal"
          aria-label="Tutup"
        >
          ✕
        </button>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3 pr-12 sm:pr-14">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-[10px] sm:text-xs font-bold text-teal bg-teal/10 px-2.5 sm:px-3 py-1 rounded-full">{job.category}</span>
            {(job.featured || job.is_featured) && (
              <span className="text-[10px] sm:text-xs font-extrabold text-white bg-teal px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">Penempatan unggulan</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 px-2.5 py-1 rounded-full shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-teal shrink-0" />
            <span>Terdaftar: {displayDate(job, formatJobDate)}</span>
          </span>
        </div>
        <h1 id="job-detail-title" className="text-xl sm:text-2xl font-bold text-navy dark:text-white mt-1 mb-1 leading-snug">{job.title}</h1>
        <p className="text-slate-600 dark:text-slate-300 font-semibold mb-3 sm:mb-4 text-xs sm:text-sm md:text-base">{job.company} • {job.location}</p>
        <div className="bg-slate-50 dark:bg-slate-800/80 p-3 sm:p-4 rounded-xl mb-4 text-xs sm:text-sm space-y-2 border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between gap-3 text-slate-700 dark:text-slate-200"><strong>Kisaran Gaji:</strong> <span className="text-teal font-bold text-right">{displaySalary(job.salary)}</span></div>
          <div className="flex justify-between gap-3 text-slate-700 dark:text-slate-200"><strong>Tipe Pekerjaan:</strong> <span className="text-right">{displayJobType(job.type)}</span></div>
        </div>
        <h3 className="font-bold text-navy dark:text-white mb-1.5 text-xs sm:text-sm md:text-base">Deskripsi Pekerjaan:</h3>
        <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm mb-4 leading-relaxed">{job.desc}</p>

        {jobReqs && jobReqs.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-navy dark:text-white mb-2 text-xs sm:text-sm md:text-base flex items-center justify-between">
              <span>Persyaratan / Kualifikasi:</span>
              <span className="text-[10px] sm:text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                {jobReqs.length} Butir
              </span>
            </h3>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm bg-slate-50/80 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-700">
              {jobReqs.map((req, idx) => (
                <li key={`job-req-${job.id || 'curr'}-${idx}`} className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Share Button (WhatsApp, Telegram, LinkedIn, Copy Link) */}
        <QuickShareButton job={job} className="mb-5" />

        <button onClick={handleApply} className={`${buttonClass} text-xs sm:text-sm md:text-base min-h-[46px]`}>
          KIRIM LAMARAN
        </button>
        <button type="button" onClick={() => onOpenCoverLetter(job)} className="mt-3 w-full min-h-[46px] border border-teal rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-teal dark:text-teal hover:bg-teal/10 transition inline-flex items-center justify-center gap-2">
          <FileText className="h-4 w-4 shrink-0" />
          Buat Surat Lamaran AI untuk Posisi Ini
        </button>
      </div>
    </div>
  );
};

const OrderCVModal = ({ isOpen, onClose, onSubmitOrder, selectedPackage = 'Paket Profesional (Rp 99.000)' }) => {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [packageType, setPackageType] = useState(selectedPackage);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedPackage) {
      setPackageType(selectedPackage);
    }
  }, [selectedPackage, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanWa = whatsapp.trim();

    if (!cleanName) {
      toast.error('Nama lengkap wajib diisi.');
      return;
    }
    if (!cleanWa) {
      toast.error('Nomor WhatsApp aktif wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. WhatsApp Redirection with pre-filled dynamic template
      const waMessage = `Halo Admin Lokerresmi.id, saya ${cleanName} ingin memesan ${packageType}. Mohon info selanjutnya.`;
      const waUrl = `https://wa.me/6285179905019?text=${encodeURIComponent(waMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      // 2. Simpan pesanan ke Supabase / State untuk tracking
      if (onSubmitOrder) {
        const result = await onSubmitOrder({ name: cleanName, whatsapp: cleanWa, packageType });
        if (!result?.valid) return;
      }

      setName('');
      setWhatsapp('');
      onClose();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition font-bold text-base z-20 cursor-pointer shadow-xs"
          title="Tutup"
        >
          ✕
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-navy dark:text-white mb-4 pr-8">Pesan Layanan CV ATS Profesional</h2>
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"
              placeholder="Masukkan nama..."
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp Aktif</label>
            <input
              type="text"
              required
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"
              placeholder="Contoh: 08123456789"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Pilih Paket Layanan</label>
            <select
              value={packageType}
              onChange={e => {
                setPackageType(e.target.value);
                trackCVPackage(e.target.value, 'order_form');
              }}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none cursor-pointer"
            >
              <option value="Paket Express (Rp 49.000)">Paket Express (Rp 49.000)</option>
              <option value="Paket Profesional (Rp 99.000)">Paket Profesional (Rp 99.000)</option>
              <option value="Paket VIP Mentoring (Rp 249.000)">Paket VIP Mentoring (Rp 249.000)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal hover:bg-teal/90 active:bg-teal/95 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-xs transition cursor-pointer min-h-[46px] active:scale-98 mt-2 flex items-center justify-center gap-2"
          >
            {submitting && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />}
            <span>{submitting ? 'Memproses Pesanan...' : 'Kirim Pesanan Sekarang'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

const PostJobModal = ({ isOpen, onClose, onAddJob, isAdminMode = false }) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('IT & Software');
  const [type, setType] = useState('Full Time');
  const [applyType, setApplyType] = useState('whatsapp');
  const [applyTarget, setApplyTarget] = useState('');
  const [requirementsText, setRequirementsText] = useState(
    '• Pendidikan minimal D3 / S1 semua jurusan\n• Pengalaman kerja minimal 1-2 tahun di bidang terkait\n• Komunikatif dan mampu bekerja sama dalam tim'
  );

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedReqs = parseRequirements(requirementsText);
    const newJob = {
      title,
      company,
      location: location || 'Remote',
      type,
      salary: salary || 'Kompetitif',
      category,
      status: isAdminMode ? 'Aktif' : 'Menunggu Persetujuan',
      featured: false,
      urgent: false,
      created_at: new Date().toISOString(),
      desc,
      requirements: parsedReqs.length > 0 ? parsedReqs : ['Pengalaman relevan di bidangnya', 'Mampu bekerja dalam tim', 'Inisiatif dan proaktif'],
      applyType,
      applyTarget,
      applicantsCount: 0,
    };
    const savedJob = await onAddJob(newJob);
    if (!savedJob) return;

    if (!isAdminMode) {
      const adminWa = '085179905019';
      const waMessage = encodeURIComponent('Halo Admin, saya ingin memasang lowongan kerja di website Lokerresmi.id');
      window.open(`https://wa.me/62${adminWa.replace(/^0/, '')}?text=${waMessage}`, '_blank', 'noopener,noreferrer');
      toast.success('Lowongan berhasil diajukan! Mengarahkan ke WhatsApp Admin...', { duration: 4000 });
    } else {
      toast.success(`Lowongan "${title}" berhasil ditambahkan.`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-800 transition font-bold text-base z-20 cursor-pointer shadow-xs"
          title="Tutup"
        >
          ✕
        </button>
        <h2 className="text-lg sm:text-2xl font-bold text-navy mb-1.5 pr-8 leading-snug">
          {isAdminMode ? 'Tambah Lowongan Baru (Superadmin)' : 'Pasang Lowongan Pekerjaan Baru'}
        </h2>
        <p className="text-slate-500 text-[11px] sm:text-xs mb-4">
          {isAdminMode
            ? 'Lowongan yang ditambahkan oleh admin akan langsung berstatus Aktif di portal.'
            : 'Lowongan akan ditinjau admin setelah Anda melakukan konfirmasi via WhatsApp.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          <div><label className="block font-semibold text-slate-700 mb-1">Posisi Jabatan</label><input required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" placeholder="Contoh: Digital Marketing Specialist" /></div>
          <div><label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan</label><input required value={company} onChange={e => setCompany(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" placeholder="Contoh: PT Inovasi Teknologi Nusantara" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div><label className="block font-semibold text-slate-700 mb-1">Lokasi</label><input value={location} onChange={e => setLocation(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" placeholder="Medan / Remote" /></div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none">
                {publicCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div><label className="block font-semibold text-slate-700 mb-1">Jenis Pekerjaan</label><select value={type} onChange={e => setType(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"><option>Full Time</option><option>Kontrak</option><option>Remote</option><option>Mitra</option><option>Freelance</option></select></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Kisaran Gaji</label><input value={salary} onChange={e => setSalary(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" placeholder="Rp 5jt - 8jt" /></div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deskripsi Pekerjaan</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows="3" className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" placeholder="Tuliskan gambaran pekerjaan dan tanggung jawab utama..."></textarea>
          </div>

          <RequirementsInput
            value={requirementsText}
            onChange={setRequirementsText}
            label="Persyaratan / Kualifikasi (Daftar Poin)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-slate-200 pt-3">
            <div><label className="block font-semibold text-slate-700 mb-1">Metode Pelamar Melamar</label><select value={applyType} onChange={e => setApplyType(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"><option value="whatsapp">WhatsApp HR</option><option value="email">Email HR</option><option value="gform">Google Form / Web URL</option></select></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Tujuan (No WA / Email / Link)</label><input required value={applyTarget} onChange={e => setApplyTarget(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" placeholder="0812xxxx atau hr@mail.com" /></div>
          </div>

          <button type="submit" className="w-full bg-teal hover:bg-teal/90 active:bg-teal/95 text-white font-bold py-3.5 rounded-xl shadow-xs mt-2 cursor-pointer active:scale-98 min-h-[46px]">
            {isAdminMode ? 'Simpan & Tayangkan Lowongan' : 'Kirim & Konfirmasi ke WhatsApp Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};

const EditJobModal = ({ job, onClose, onSave }) => {
  const [title, setTitle] = useState(job.title || '');
  const [company, setCompany] = useState(job.company || '');
  const [location, setLocation] = useState(job.location || '');
  const [salary, setSalary] = useState(job.salary || '');
  const [desc, setDesc] = useState(job.desc || '');
  const [type, setType] = useState(job.type || 'Full Time');
  const [category, setCategory] = useState(job.category || 'IT & Software');
  const [applyType, setApplyType] = useState(job.applyType || 'whatsapp');
  const [applyTarget, setApplyTarget] = useState(job.applyTarget || '');
  const [requirementsText, setRequirementsText] = useState(() => formatRequirementsToText(job.requirements));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updatedRequirements = parseRequirements(requirementsText);
    const saved = await onSave({
      ...job,
      title,
      company,
      location,
      salary,
      desc,
      type,
      category,
      applyType,
      applyTarget,
      requirements: updatedRequirements,
    });
    if (saved) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-800 transition font-bold text-base z-20 cursor-pointer shadow-xs"
          title="Tutup"
        >
          ✕
        </button>
        <h2 className="text-lg sm:text-2xl font-bold text-navy mb-4 pr-8 leading-snug">Edit Lowongan Pekerjaan</h2>
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          <div><label className="block font-semibold text-slate-700 mb-1">Posisi Jabatan</label><input required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" /></div>
          <div><label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan</label><input required value={company} onChange={e => setCompany(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div><label className="block font-semibold text-slate-700 mb-1">Lokasi</label><input value={location} onChange={e => setLocation(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" /></div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none">
                {publicCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div><label className="block font-semibold text-slate-700 mb-1">Jenis Pekerjaan</label><select value={type} onChange={e => setType(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"><option>Full Time</option><option>Kontrak</option><option>Remote</option><option>Mitra</option><option>Freelance</option></select></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Gaji</label><input value={salary} onChange={e => setSalary(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" /></div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deskripsi Pekerjaan</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows="3" className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"></textarea>
          </div>

          <RequirementsInput
            value={requirementsText}
            onChange={setRequirementsText}
            label="Persyaratan / Kualifikasi (Daftar Poin)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-slate-200 pt-3">
            <div><label className="block font-semibold text-slate-700 mb-1">Metode Lamaran</label><select value={applyType} onChange={e => setApplyType(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="gform">Google Form / URL</option></select></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Target Tujuan</label><input value={applyTarget} onChange={e => setApplyTarget(e.target.value)} className="w-full border border-slate-300 p-2.5 sm:p-3 rounded-xl focus:ring-2 focus:ring-teal outline-none" /></div>
          </div>
          <button type="submit" className="w-full bg-teal hover:bg-teal/90 active:bg-teal/95 text-white font-bold py-3.5 rounded-xl shadow-xs cursor-pointer active:scale-98 min-h-[46px]">Simpan Perubahan</button>
        </form>
      </div>
    </div>
  );
};

const SuperAdminDashboard = ({
  jobs,
  setJobs,
  cvOrders,
  loadingCVOrders,
  fetchCVOrders,
  updateCVStatus,
  deleteCVOrder,
  isStatsLive,
  fetchStats,
  onLogout,
  updateJobStatus,
  toggleFeatured,
  deleteJob,
  saveEditedJob,
  onAddJob,
}) => {
  const [activeTab, setActiveTab] = useState('stats');
  const [editingJob, setEditingJob] = useState(null);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name, type: 'cv' | 'job' }
  const [isDeleting, setIsDeleting] = useState(false);

  // 7 Variabel State Dinamis untuk Metrik Ringkasan Dashboard (100% dari Supabase)
  const [totalViews, setTotalViews] = useState(0);
  const [activeJobs, setActiveJobs] = useState(0);
  const [pendingJobs, setPendingJobs] = useState(0);
  const [premiumJobs, setPremiumJobs] = useState(0);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [totalCVOrders, setTotalCVOrders] = useState(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Fetch semua metrik langsung dari tabel Supabase
  const fetchDashboardMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      // 1) Total Kunjungan Web dari Supabase tabel 'site_stats'
      const { data: statsData, error: statsError } = await supabase
        .from('site_stats')
        .select('total_views')
        .eq('id', 1)
        .maybeSingle();

      if (!statsError && statsData) {
        setTotalViews(Number(statsData.total_views) || 0);
      } else {
        const { data: fallbackStats } = await supabase
          .from('site_stats')
          .select('total_views')
          .limit(1)
          .maybeSingle();
        setTotalViews(Number(fallbackStats?.total_views) || 0);
      }

      // 2, 3, 4, 5, 6) Query dari Supabase tabel 'jobs'
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*');

      if (!jobsError && Array.isArray(jobsData)) {
        // 2) Lowongan Aktif
        setActiveJobs(jobsData.filter((j) => j.status === 'Aktif').length);

        // 3) Menunggu Review
        setPendingJobs(jobsData.filter((j) => j.status === 'Menunggu Persetujuan').length);

        // 4) Lowongan Premium
        setPremiumJobs(jobsData.filter((j) => (j.featured || j.is_featured) && j.status === 'Aktif').length);

        // 5) Perusahaan Mitra
        const uniqueCompanies = new Set(
          jobsData.map((j) => (j.company || '').trim()).filter(Boolean)
        ).size;
        setTotalCompanies(uniqueCompanies);

        // 6) Total Pelamar Masuk
        const applicantsSum = jobsData.reduce(
          (sum, j) => sum + (Number(j.applicantsCount) || Number(j.applicants_count) || 0),
          0
        );
        setTotalApplicants(applicantsSum);
      } else {
        setActiveJobs(0);
        setPendingJobs(0);
        setPremiumJobs(0);
        setTotalCompanies(0);
        setTotalApplicants(0);
      }

      // 7) Total Pesanan Layanan CV dari Supabase tabel 'cv_orders'
      const { data: cvData, error: cvError, count: cvCount } = await supabase
        .from('cv_orders')
        .select('*', { count: 'exact' });

      if (!cvError && Array.isArray(cvData)) {
        setTotalCVOrders(cvData.length ?? cvCount ?? 0);
      } else {
        setTotalCVOrders(0);
      }
    } catch {
      setActiveJobs(0);
      setPendingJobs(0);
      setPremiumJobs(0);
      setTotalCompanies(0);
      setTotalApplicants(0);
      setTotalCVOrders(0);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardMetrics();
    if (fetchCVOrders) {
      fetchCVOrders();
    }
  }, [fetchDashboardMetrics, fetchCVOrders]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      if (confirmDelete.type === 'cv') {
        await deleteCVOrder(confirmDelete.id);
      } else if (confirmDelete.type === 'job') {
        await deleteJob(confirmDelete.id);
      }
      fetchDashboardMetrics();
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-navy text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shadow flex-wrap gap-2">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <span className="bg-teal text-white font-extrabold px-2.5 py-1 rounded text-xs uppercase tracking-wider">Superadmin</span>
          <h1 className="text-sm sm:text-base lg:text-lg font-bold">Lokerresmi.id Control Center</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={onLogout} className="bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer">Keluar Admin</button>
        </div>
      </div>

      <div className="bg-white border-b px-4 sm:px-6 flex space-x-3 sm:space-x-6 text-xs sm:text-sm font-semibold overflow-x-auto whitespace-nowrap">
        <button onClick={() => setActiveTab('stats')} className={`py-3 sm:py-3.5 border-b-2 transition cursor-pointer ${activeTab === 'stats' ? 'border-teal text-navy' : 'border-transparent text-slate-600 hover:text-navy'}`}>📊 Ringkasan Dashboard</button>
        <button onClick={() => setActiveTab('jobs')} className={`py-3 sm:py-3.5 border-b-2 transition cursor-pointer ${activeTab === 'jobs' ? 'border-teal text-navy' : 'border-transparent text-slate-600 hover:text-navy'}`}>💼 Manajemen Loker ({jobs.length})</button>
        <button onClick={() => setActiveTab('cv')} className={`py-3 sm:py-3.5 border-b-2 transition cursor-pointer ${activeTab === 'cv' ? 'border-teal text-navy' : 'border-transparent text-slate-600 hover:text-navy'}`}>📄 Pesanan CV Klien ({cvOrders.length})</button>
      </div>

      <div className="max-w-7xl mx-auto w-full p-3 sm:p-6 flex-1">
        {activeTab === 'stats' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-navy">Statistik Utama Platform</h2>
                <div className="text-xs text-slate-500 mt-0.5">Ringkasan performa kunjungan dan aktivitas rekrutmen terkini.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchDashboardMetrics();
                  fetchStats?.();
                }}
                disabled={loadingMetrics}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
                title="Segarkan data langsung dari Supabase"
              >
                <span className={loadingMetrics ? 'inline-block animate-spin' : ''}>🔄</span>
                <span>{loadingMetrics ? 'Menyinkronkan...' : 'Segarkan Statistik'}</span>
              </button>
            </div>

            {/* Baris 1: Visitor Counter & Job Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {/* 1) GLOBAL VISITOR COUNTER (site_stats) */}
              <div className="bg-gradient-to-br from-white to-teal/5 p-4 sm:p-6 rounded-2xl shadow-xs border border-teal/30 hover:border-teal/50 transition relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="text-slate-600 font-medium text-xs sm:text-sm">Total Kunjungan Web</div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isStatsLive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-teal/10 text-white border-teal/30'
                    }`}
                    title="Terhubung ke Supabase tabel site_stats"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isStatsLive ? 'bg-emerald-500 animate-pulse' : 'bg-teal'}`} />
                    {isStatsLive ? 'Live' : 'Cloud Sync'}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-navy mt-2 flex items-baseline gap-1.5">
                  <span>{loadingMetrics ? '...' : (totalViews || 0).toLocaleString('id-ID')}</span>
                  <span className="text-xs font-semibold text-slate-400">views</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <span>🌐</span>
                  <span>Tersinkronisasi dengan Supabase site_stats</span>
                </div>
              </div>

              {/* 2) Lowongan Aktif (jobs) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
                <div className="text-slate-500 text-xs sm:text-sm">Lowongan Aktif</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-navy mt-2">{activeJobs || 0}</div>
                <div className="text-[11px] text-slate-400 mt-2">Ditayangkan ke pencari kerja</div>
              </div>

              {/* 3) Menunggu Review (jobs) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
                <div className="text-slate-500 text-xs sm:text-sm">Menunggu Review</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 mt-2">{pendingJobs || 0}</div>
                <div className="text-[11px] text-slate-400 mt-2">Menunggu persetujuan admin</div>
              </div>

              {/* 4) Lowongan Premium (jobs) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
                <div className="text-slate-500 text-xs sm:text-sm">Lowongan Premium</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-violet-600 mt-2">{premiumJobs || 0}</div>
                <div className="text-[11px] text-slate-400 mt-2">Disorot di posisi teratas</div>
              </div>
            </div>

            {/* Baris 2: Pelamar, Mitra & Layanan CV */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mt-3 sm:mt-4">
              {/* 5) Perusahaan Mitra (jobs) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
                <div className="text-slate-500 text-xs sm:text-sm">Perusahaan Mitra</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-teal mt-1">{totalCompanies || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1.5">Pemberi kerja terdaftar</div>
              </div>

              {/* 6) Total Pelamar Masuk (jobs) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
                <div className="text-slate-500 text-xs sm:text-sm">Total Pelamar Masuk</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-navy mt-1">{totalApplicants || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1.5">Klik lamar WhatsApp / Email</div>
              </div>

              {/* 7) Total Pesanan Layanan CV (cv_orders) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
                <div className="text-slate-500 text-xs sm:text-sm">Total Pesanan Layanan CV</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-navy mt-1">{totalCVOrders || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1.5">Tersimpan di Supabase cv_orders</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-navy text-sm sm:text-base">Kelola Daftar Lowongan Kerja</div>
                <div className="text-xs text-slate-500 mt-0.5">Setujui, tolak, edit kualifikasi/persyaratan, atur status PREMIUM, atau hapus lowongan.</div>
              </div>
              <button
                onClick={() => setIsAddJobOpen(true)}
                className="bg-teal hover:bg-teal/90 active:bg-teal/95 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto active:scale-98"
              >
                <span className="text-base leading-none font-extrabold">+</span>
                <span>Tambah Lowongan Baru</span>
              </button>
            </div>
            <div className="sm:hidden px-4 py-2 bg-amber-50/60 border-b border-amber-200/50 text-[11px] text-amber-800 flex items-center justify-between">
              <span>👉 Geser tabel ke samping untuk melihat seluruh kolom data</span>
            </div>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full text-left text-xs sm:text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 border-b">
                    <tr>
                      <th className="p-3">Tanggal Masuk</th>
                      <th className="p-3">Posisi & Perusahaan</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Jumlah Pelamar</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">PREMIUM</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                          Belum ada data lowongan kerja di database Supabase.
                        </td>
                      </tr>
                    ) : (
                      jobs.map(job => {
                        const isFeatured = job.featured || job.is_featured || false;
                        return (
                          <tr key={job.id} className="hover:bg-slate-50">
                            <td className="p-3 align-middle">
                              <div className="inline-flex items-center gap-1.5 font-bold text-navy text-xs bg-slate-100 px-2.5 py-1 rounded-md">
                                <Calendar className="h-3.5 w-3.5 text-teal shrink-0" />
                                <span>{formatJobDate(job.created_at || job.date)}</span>
                              </div>
                              {formatJobTime(job.created_at) && (
                                <div className="text-[10px] text-slate-400 mt-0.5 pl-1 font-normal">
                                  {formatJobTime(job.created_at)}
                                </div>
                              )}
                            </td>
                            <td className="p-3"><div className="font-bold text-navy whitespace-normal max-w-xs">{job.title}</div><div className="text-xs text-slate-500 whitespace-normal max-w-xs">{job.company} • {job.location}</div></td>
                            <td className="p-3"><span className="bg-slate-100 px-2.5 py-1 rounded text-xs">{job.category}</span></td>
                            <td className="p-3 font-extrabold text-teal">{job.applicantsCount || 0} pelamar</td>
                            <td className="p-3">
                              <select value={job.status} onChange={(e) => updateJobStatus(job.id, e.target.value)} className="border p-1.5 rounded text-xs bg-slate-50 font-semibold cursor-pointer">
                                <option value="Aktif">Aktif</option>
                                <option value="Tidak Aktif">Tidak Aktif</option>
                                <option value="Menunggu Persetujuan">Menunggu Persetujuan</option>
                                <option value="Ditolak">Ditolak</option>
                              </select>
                            </td>
                            <td className="p-3"><button onClick={() => toggleFeatured(job.id, isFeatured)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer active:scale-95 ${isFeatured ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'}`}><span>{isFeatured ? '★ PREMIUM' : '☆ Standar'}</span></button></td>
                            <td className="p-3 text-right">
                              <div className="flex flex-wrap justify-end gap-1.5 min-w-[200px]">
                                {job.status !== 'Aktif' && <button onClick={() => updateJobStatus(job.id, 'Aktif')} className="text-xs bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 px-2.5 py-1.5 rounded font-bold transition cursor-pointer">Setujui</button>}
                                {job.status !== 'Ditolak' && <button onClick={() => updateJobStatus(job.id, 'Ditolak')} className="text-xs bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 px-2.5 py-1.5 rounded font-bold transition cursor-pointer">Tolak</button>}
                                <button onClick={() => setEditingJob(job)} className="text-xs bg-slate-200 hover:bg-slate-300 active:bg-slate-400 px-2.5 py-1.5 rounded font-semibold transition cursor-pointer">Edit</button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete({ id: job.id, name: job.title, type: 'job' })}
                                  className="text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 active:bg-rose-300 px-2.5 py-1.5 rounded font-semibold transition cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cv' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-navy text-sm sm:text-base">Kelola Pesanan Layanan CV Klien & Status Pengerjaan</div>
                <div className="text-xs text-slate-500 mt-0.5">Tersinkronisasi otomatis dengan cloud Supabase (tabel cv_orders).</div>
              </div>
              <button
                type="button"
                onClick={() => fetchCVOrders?.()}
                disabled={loadingCVOrders}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
                title="Sinkronisasi ulang data dari Supabase"
              >
                <span className={loadingCVOrders ? 'inline-block animate-spin' : ''}>🔄</span>
                <span>{loadingCVOrders ? 'Memuat...' : 'Segarkan Data'}</span>
              </button>
            </div>
            <div className="sm:hidden px-4 py-2 bg-amber-50/60 border-b border-amber-200/50 text-[11px] text-amber-800">
              👉 Geser tabel ke samping untuk melihat seluruh detail pesanan
            </div>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                {loadingCVOrders ? (
                  <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal border-t-transparent mb-2" />
                    <div>Memuat pesanan CV dari Supabase...</div>
                  </div>
                ) : cvOrders.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                    Belum ada pesanan CV klien di database Supabase.
                  </div>
                ) : (
                  <table className="min-w-full text-left text-xs sm:text-sm whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-600 border-b">
                      <tr><th className="p-3">Nama Klien</th><th className="p-3">WhatsApp</th><th className="p-3">Paket</th><th className="p-3">Status Pengerjaan</th><th className="p-3 text-right">Aksi</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cvOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-navy">{order.name}<div className="text-xs text-slate-400 font-normal">{order.date || (order.created_at ? order.created_at.split('T')[0] : 'Baru')}</div></td>
                          <td className="p-3"><a href={`https://wa.me/${order.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-teal font-medium hover:underline">{order.whatsapp}</a></td>
                          <td className="p-3 whitespace-normal max-w-xs">{order.package}</td>
                          <td className="p-3">
                            <select
                              value={order.status}
                              onChange={(e) => updateCVStatus(order.id, e.target.value)}
                              className="border border-slate-300 p-1.5 rounded-lg text-xs bg-white font-semibold cursor-pointer focus:ring-2 focus:ring-teal outline-none"
                            >
                              <option value="Menunggu Review">Menunggu Review</option>
                              <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                              <option value="Selesai">Selesai</option>
                            </select>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setConfirmDelete({ id: order.id, name: order.name, type: 'cv' })}
                              className="text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 active:bg-rose-300 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-navy mb-2">Konfirmasi Hapus Permanen</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              Apakah Anda yakin ingin menghapus {confirmDelete.type === 'cv' ? 'pesanan CV' : 'lowongan kerja'} <strong>&quot;{confirmDelete.name}&quot;</strong> secara permanen dari Supabase? Data tidak dapat dipulihkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isDeleting && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={async (updated) => {
            return saveEditedJob(updated);
          }}
        />
      )}

      {isAddJobOpen && (
        <PostJobModal
          isOpen={isAddJobOpen}
          onClose={() => setIsAddJobOpen(false)}
          onAddJob={async (newJob) => {
            if (onAddJob) {
              return onAddJob(newJob);
            }
            return null;
          }}
          isAdminMode={true}
        />
      )}
    </div>
  );
};

export default function JobBoard() {
  const { jobs, activeJobs, loading, error: jobsError, setJobs } = useJobs();
  const { route, modal, openJob, closeJob, openModal, closeModal } = useJobRoute();
  const { createJob, updateJobStatus, toggleFeatured, deleteJob, updateJob } = useJobActions({ setJobs });
  const { isLoggedIn, loading: authLoading, login, logout } = useAuth();
  const { isDark, toggleDarkMode } = useDarkMode();
  const {
    cvOrders,
    loading: loadingCVOrders,
    fetchCVOrders,
    createCVOrder,
    updateCVStatus,
    deleteCVOrder,
  } = useCVOrders({ isAdmin: isLoggedIn });
  const {
    isLive: isStatsLive,
    fetchStats,
    recordPageView,
  } = useSiteStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationTerm, setLocationTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('Paket Profesional (Rp 99.000)');

  const handleOpenCoverLetter = (job = null) => {
    openModal('cover-letter', job ? { title: job.title, company: job.company } : null);
  };

  const handleOpenOrderCV = (packageName, replace = false) => {
    if (packageName) {
      setSelectedPackage(packageName);
      trackCVPackage(packageName, replace ? 'ai_upsell' : 'pricing');
    }
    openModal('cv-order', null, { replace });
  };

  const handleOpenEmployerInquiry = (source) => {
    trackEmployerInquiry(source);
    openModal('employer-inquiry');
  };

  // Auto-Increment Total Kunjungan Web terhubung ke tabel Supabase 'site_stats' (validasi session storage)
  useEffect(() => {
    recordPageView();
  }, [recordPageView]);

  // Filter lowongan khusus halaman publik: hanya yang berstatus 'Aktif'
  const publicJobs = useMemo(() => {
    if (activeJobs && Array.isArray(activeJobs)) {
      return activeJobs;
    }
    return (jobs || []).filter((j) => j.status === 'Aktif');
  }, [activeJobs, jobs]);

  const landing = route.isLanding ? route.landing : null;
  const landingJobs = useMemo(() => landing ? filterJobsForLanding(publicJobs, landing) : publicJobs, [publicJobs, landing]);

  const selectedJob = !route.invalid && route.isDetail
    ? publicJobs.find((job) => String(job.id) === route.id) || null
    : null;

  useEffect(() => {
    updatePageMetadata(selectedJob, route, { loading, error: jobsError, landingJobs });
  }, [selectedJob, route, loading, jobsError, landingJobs]);

  const handleApplyTrack = async (jobId) => {
    // jobs publik read-only: jangan UPDATE applicantsCount dari browser.
    // Tautan lamaran tetap berfungsi; tracking tepercaya perlu endpoint terpisah.
    void jobId;
  };

  const handleAddJob = async (newJobData) => {
    if (!isLoggedIn) {
      toast.error('Publik hanya dapat membaca lowongan. Hubungi admin untuk memasang lowongan.');
      return null;
    }
    return createJob(newJobData);
  };

  const saveEditedJob = async (updated) => {
    return updateJob(updated);
  };

  // Menunggu validasi sesi Supabase selesai sebelum mengevaluasi proteksi SuperAdminDashboard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal border-t-transparent" />
          <span className="text-xs text-slate-500 font-medium">Memverifikasi sesi keamanan...</span>
        </div>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <SuperAdminDashboard
        jobs={jobs}
        setJobs={setJobs}
        cvOrders={cvOrders}
        loadingCVOrders={loadingCVOrders}
        fetchCVOrders={fetchCVOrders}
        updateCVStatus={updateCVStatus}
        deleteCVOrder={deleteCVOrder}
        isStatsLive={isStatsLive}
        fetchStats={fetchStats}
        onLogout={async () => {
          try {
            await logout();
          } catch {
            // ignore
          }
        }}
        updateJobStatus={updateJobStatus}
        toggleFeatured={toggleFeatured}
        deleteJob={deleteJob}
        saveEditedJob={saveEditedJob}
        onAddJob={handleAddJob}
      />
    );
  }

  return (
    <div className="editorial-page min-h-screen bg-light dark:bg-slate-950 flex flex-col justify-between">
      {/* Google Jobs Structured Data (Schema.org JobPosting) */}
      <JobPostingSchema job={selectedJob} />

      <div>
        <Navbar
          onOpenPostJob={() => handleOpenEmployerInquiry('navbar')}
          onOpenAdminLogin={() => openModal('admin-login')}
          isAdmin={false}
          isDark={isDark}
          toggleDarkMode={toggleDarkMode}
        />
        <Hero activeCount={publicJobs.length} searchTerm={searchTerm} setSearchTerm={setSearchTerm} locationTerm={locationTerm} setLocationTerm={setLocationTerm} selectedTag={selectedTag} setSelectedTag={setSelectedTag} landing={landing} />
        <StatsBar totalJobs={publicJobs.length} />
        <JobFeed
          jobs={landingJobs}
          onSelectJob={openJob}
          searchTerm={searchTerm}
          locationTerm={locationTerm}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          loading={loading}
          landing={landing}
          onResetFilters={() => {
            setSearchTerm('');
            setLocationTerm('');
            setSelectedTag('');
          }}
        />
        <CVServicePromo
          onSelectPackage={handleOpenOrderCV}
          onOpenAIChecker={() => openModal('cv-checker')}
          onOpenCoverLetter={() => handleOpenCoverLetter()}
        />
        <CommunitySection />
      </div>
      <Footer onOpenEmployerInquiry={() => handleOpenEmployerInquiry('footer')} />

      {!modal && (route.isDetail || route.invalid) && !selectedJob && (
        <div role="dialog" aria-modal="true" aria-labelledby="job-route-status" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <section className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 id="job-route-status" className="text-xl font-bold text-navy dark:text-white">
              {loading ? 'Memuat lowongan...' : jobsError ? 'Lowongan belum dapat dimuat' : 'Lowongan tidak ditemukan'}
            </h2>
            <p className="my-4 text-slate-600 dark:text-slate-300">
              {loading ? 'Mohon tunggu sebentar.' : jobsError ? 'Silakan muat ulang halaman untuk mencoba lagi.' : 'Lowongan ini tidak tersedia atau sudah tidak aktif.'}
            </p>
            <button onClick={closeJob} className="bg-teal text-white font-bold px-4 py-2 rounded-xl">Kembali ke daftar lowongan</button>
          </section>
        </div>
      )}
      <JobDetailModal job={modal ? null : selectedJob} onClose={closeJob} onApplyTrack={handleApplyTrack} onOpenCoverLetter={handleOpenCoverLetter} />
      <EmployerInquiryModal isOpen={modal?.type === 'employer-inquiry'} onClose={closeModal} />
      <OrderCVModal
        isOpen={modal?.type === 'cv-order'}
        onClose={closeModal}
        onSubmitOrder={createCVOrder}
        selectedPackage={selectedPackage}
      />
      <AICVCheckerModal
        isOpen={modal?.type === 'cv-checker'}
        onClose={closeModal}
        onOpenOrderModal={(pkg) => {
          handleOpenOrderCV(pkg, true);
        }}
      />
      <AICoverLetterModal
        isOpen={modal?.type === 'cover-letter'}
        initialJob={modal?.type === 'cover-letter' ? modal.payload : null}
        onClose={closeModal}
        onOpenOrderModal={(pkg) => {
          handleOpenOrderCV(pkg, true);
        }}
      />
      <AdminLoginModal isOpen={modal?.type === 'admin-login'} onClose={closeModal} login={login} />
    </div>
  );
}
