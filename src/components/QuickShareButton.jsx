import React, { useState, useRef, useEffect } from 'react';
import { Share2, MessageCircle, Copy, Check, Linkedin, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jobUrl } from '../lib/seo';

export default function QuickShareButton({ job, className = '' }) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!job) return null;

  const currentUrl = jobUrl(job.id);
  const shareTitle = `Lowongan ${job.title} - ${job.company}`;
  const shareText = `📌 Info Lowongan Kerja di Lokerresmi.id:\n\nPosisi: *${job.title}*\nPerusahaan: *${job.company}*\nLokasi: ${job.location}\nKisaran Gaji: ${job.salary}\n\nLamar segera melalui tautan resmi:\n${currentUrl}`;

  // 1. WhatsApp Share
  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    toast.success('Membuka WhatsApp untuk membagikan info loker...');
  };

  // 2. Telegram Share
  const handleShareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    toast.success('Membuka Telegram...');
  };

  // 3. LinkedIn Share
  const handleShareLinkedIn = () => {
    const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`;
    window.open(liUrl, '_blank', 'noopener,noreferrer');
    toast.success('Membuka LinkedIn...');
  };

  // 4. Salin Tautan (Copy Link)
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Tautan lowongan berhasil disalin ke clipboard!');
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Gagal menyalin tautan');
    }
  };

  // 5. Native Mobile Web Share (jika didukung)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Cek lowongan ${job.title} di ${job.company} melalui Lokerresmi.id`,
          url: currentUrl,
        });
        toast.success('Berhasil membuka menu bagikan!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleShareWhatsApp();
        }
      }
    } else {
      handleShareWhatsApp();
    }
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:bg-slate-800/80 dark:border-slate-700 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Share2 className="h-3.5 w-3.5 text-teal shrink-0" />
          Bagikan Info Lowongan Ini:
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">1-Klik ke Teman</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Tombol Cepat WhatsApp */}
        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold py-2 px-2.5 text-xs transition shadow-xs cursor-pointer active:scale-95"
          title="Bagikan ke WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>WhatsApp</span>
        </button>

        {/* Salin Tautan */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-semibold py-2 px-2.5 text-xs transition shadow-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600 cursor-pointer active:scale-95"
          title="Salin Link Lowongan"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
          <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
        </button>

        {/* LinkedIn */}
        <button
          type="button"
          onClick={handleShareLinkedIn}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0077b5] hover:bg-[#006097] text-white font-semibold py-2 px-2.5 text-xs transition shadow-xs cursor-pointer active:scale-95"
          title="Bagikan ke LinkedIn"
        >
          <Linkedin className="h-3.5 w-3.5" />
          <span>LinkedIn</span>
        </button>

        {/* Native Share / Telegram */}
        <button
          type="button"
          onClick={handleNativeShare}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy hover:bg-slate-800 text-white font-semibold py-2 px-2.5 text-xs transition shadow-xs dark:bg-teal dark:text-navy dark:hover:bg-teal/90 cursor-pointer active:scale-95"
          title="Bagikan Lainnya"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Lainnya</span>
        </button>
      </div>
    </div>
  );
}
