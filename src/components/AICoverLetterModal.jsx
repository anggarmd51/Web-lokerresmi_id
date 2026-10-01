import React, { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import {
  Sparkles,
  FileText,
  UploadCloud,
  Trash2,
  FileCheck,
  X,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Download,
  Copy,
  Briefcase,
  Building,
  Target,
  SlidersHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Minimal sample PDF (base64) for instant 1-click test
const SAMPLE_PDF_BASE64 =
  'JVBERi0xLjcKCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzMgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8Ci9MZW5ndGggMTg5Cj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDcwMCBUZAooQU5ESCBQUkFUQU1BIC0gRnJvbnRlbmQgRGV2ZWxvcGVyKSBUagowIC0yMCBUZAooRW1haWw6IGFuZGkucHJhdGFtYUBnbWFpbC5jb20gfCBXaGF0c0FwcDogMDg1MTc5OTA1MDE5KSBUagowIC0yMCBUZAooUGVuZ2FsYW1hbjogRnJvbnRlbmQgRW5naW5lZXIgc2VsYW1hIDIgdGFodW4gbWVuZ2d1bmFrYW4gUmVhY3QsIFRhaWx3aW5kLCBzb3VyY2UgY29udHJvbCBHaXQpIFRqCjAgLTIwIFRkCihQZW5kaWRpa2FuOiBTMVRla25payBJbmZvcm1hdGlrYSBJUEsgMy42MCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExOSAwMDAwMCBuIAowMDAwMDAwMjE3IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzUwCiUlRU9GCg==';

// Tone options
const TONE_OPTIONS = [
  {
    id: 'formal',
    label: '👔 Profesional & Formal (Cocok untuk Korporat / BUMN / Bank)',
    description: 'Bahasa baku, terstruktur rapi, sopan, dan mengedepankan etika korporasi.',
  },
  {
    id: 'dynamic',
    label: '🚀 Santai & Dinamis (Cocok untuk Startup / Agensi Kreatif)',
    description: 'Komunikatif, modern, antusias, dan menonjolkan inovasi serta inisiatif tinggi.',
  },
  {
    id: 'confident',
    label: '💪 Percaya Diri & Tegas (Cocok untuk Posisi Sales / Manajerial)',
    description: 'Fokus pada hasil (result-oriented), kepemimpinan, dan pencapaian target konkret.',
  },
];

// Sanitizer helper for user inputs to prevent prompt injection and delimiter breakout
const sanitizePromptInput = (text, maxLength = 2000) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/```/g, '') // strip markdown code block fences
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // strip control characters
    .slice(0, maxLength);
};

// Helper to convert File to base64 using native FileReader with safety timeout guard & magic bytes verification
const readFileAsBase64 = (file, timeoutMs = 10000) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Berkas tidak ditemukan.'));
      return;
    }

    const reader = new FileReader();
    const timer = setTimeout(() => {
      try {
        reader.abort();
      } catch {}
      reject(new Error('Batas waktu membaca berkas PDF terlampaui.'));
    }, timeoutMs);

    reader.onload = () => {
      clearTimeout(timer);
      try {
        const resultString = reader.result;
        if (typeof resultString === 'string') {
          const base64Clean = resultString.includes(',')
            ? resultString.split(',')[1]
            : resultString;
          if (!base64Clean || base64Clean.trim().length === 0) {
            reject(new Error('Isi dokumen PDF kosong atau tidak terbaca.'));
            return;
          }

          const trimmedBase64 = base64Clean.trim();
          // Security Check: Verify genuine PDF magic bytes (%PDF- in base64 starts with JVBERi)
          if (!trimmedBase64.startsWith('JVBERi')) {
            reject(new Error('Integritas berkas gagal: file bukan merupakan dokumen PDF yang valid.'));
            return;
          }

          resolve(trimmedBase64);
        } else {
          reject(new Error('Format pembacaan file tidak valid.'));
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Gagal membaca file PDF dari perangkat.'));
    };

    reader.onabort = () => {
      clearTimeout(timer);
      reject(new Error('Proses pembacaan file PDF dibatalkan.'));
    };

    reader.readAsDataURL(file);
  });
};

// Helper for fetch with AbortController timeout
const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

// Generate realistic simulated cover letter for offline/timeout fallback
const generateSimulatedCoverLetter = (jobTitle, companyName, tone) => {
  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const company = companyName ? companyName.trim() : 'PT Inovasi Digital Nusantara';
  const role = jobTitle ? jobTitle.trim() : 'Posisi Pekerjaan Terkait';

  if (tone.includes('Santai & Dinamis') || tone.includes('dynamic')) {
    return `${today}
Yth. Tim Rekrutmen / Manajer HRD
${company}
di Tempat

Dengan hormat,

Saya mengajukan diri untuk posisi ${role} di ${company} dengan bekal pengalaman terbukti dalam mengeksekusi proyek digital secara adaptif dan kolaboratif. Reputasi ${company} dalam menciptakan kultur kerja yang progresif menjadi alasan kuat ketertarikan saya untuk berkontribusi langsung.

Merujuk pada pengalaman profesional yang tertera dalam CV terlampir, saya berperan dalam mengelola inisiatif kerja berbasis target, menyelesaikan tantangan operasional secara mandiri, dan mengoptimalkan kolaborasi tim lintas fungsi. Terbiasa bekerja secara terstruktur dan teliti di lingkungan yang bergerak cepat memungkinkan saya menghasilkan output kerja yang konsisten.

Saya menguasai kompetensi teknis yang relevan dengan spesifikasi peran ini serta memiliki kesiapan tinggi dalam mengadopsi standar operasional dan teknologi baru di ${company}. Sinergi antara keahlian praktis dan pemecahan masalah yang solutif akan menjadi nilai tambah langsung bagi tim kerja.

Saya menyambut baik kesempatan sesi wawancara untuk mendiskusikan lebih mendalam bagaimana kualifikasi saya dapat mendukung target strategis ${company}. Atas waktu dan pertimbangan Bapak/Ibu, saya sampaikan terima kasih.

Hormat saya,

[Nama Lengkap]
[Nomor WhatsApp]
[Email]`;
  }

  if (tone.includes('Percaya Diri') || tone.includes('confident')) {
    return `${today}
Yth. Tim Rekrutmen / Manajer HRD
${company}
di Tempat

Dengan hormat,

Saya mengajukan diri untuk peran strategis ${role} di ${company} dengan rekam jejak konkret dalam mendorong efisiensi kerja dan pencapaian target bisnis yang terukur. Kualifikasi dan kompetensi yang saya miliki selaras dengan sasaran pertumbuhan yang tengah diakselerasi oleh perusahaan.

Berdasarkan pengalaman karier pada CV terlampir, saya telah membuktikan kapabilitas dalam mengelola alur kerja operasional, mengeksekusi inisiatif pemecahan masalah secara terstruktur, dan menghasilkan dampak positif terhadap produktivitas tim. Pendekatan berbasis data dan orientasi hasil menjadi landasan saya dalam mengambil keputusan kerja yang akurat.

Saya terbiasa memimpin penyelesaian proyek dengan standar kualitas tinggi, cepat beradaptasi dengan SOP perusahaan, serta memastikan koordinasi lintas fungsi berjalan efektif. Kesiapan ini mempercepat kontribusi aktif saya dalam mendukung target ambisius ${company}.

Besar harapan saya untuk menghadiri sesi wawancara agar dapat memaparkan rencana aksi dan kontribusi strategis saya untuk posisi ${role}. Atas perhatian Bapak/Ibu, saya sampaikan terima kasih.

Hormat saya,

[Nama Lengkap]
[Nomor WhatsApp]
[Email]`;
  }

  // Default: Profesional & Formal
  return `${today}
Yth. Tim Rekrutmen / Manajer HRD
${company}
di Tempat

Dengan hormat,

Saya mengajukan lamaran untuk posisi ${role} di ${company} dengan latar belakang profesional yang solid dan kompetensi teruji di bidang terkait. Standar mutu dan reputasi positif yang dibangun oleh ${company} selaras dengan komitmen kerja saya.

Sebagaimana tercantum dalam resume CV terlampir, saya berperan dalam mengelola rangkaian tugas profesional secara terstruktur, teliti, dan tepat waktu. Rekam jejak kerja saya mencakup keberhasilan dalam mengoptimalkan proses kerja, menjaga akurasi data dan laporan, serta berkoordinasi secara efektif dalam dinamika tim korporasi.

Saya menguasai keahlian teknis esensial yang dipersyaratkan untuk peran ini, serta siap mengimplementasikan standar operasional perusahaan secara disiplin. Kemampuan analitis dan ketelitian yang saya miliki akan mendukung kelancaran operasional ${company}.

Saya sangat berterima kasih atas kesempatan untuk hadir dalam sesi wawancara guna menjelaskan lebih lanjut relevansi kualifikasi saya dengan kebutuhan ${company}. Atas perhatian dan pertimbangan Bapak/Ibu, saya ucapkan terima kasih.

Hormat saya,

[Nama Lengkap]
[Nomor WhatsApp]
[Email]`;
};

// Call Gemini API with PDF inlineData and 15s timeout
const generateCoverLetterWithGemini = async (
  base64Pdf,
  jobTitle,
  companyName,
  jobDescription,
  toneLabel
) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    console.info('VITE_GEMINI_API_KEY absent. Using fallback simulated cover letter.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      text: generateSimulatedCoverLetter(jobTitle, companyName, toneLabel),
      isFallback: true,
    };
  }

  // Validate Base64 PDF
  if (!base64Pdf || typeof base64Pdf !== 'string' || base64Pdf.trim().length === 0) {
    throw new Error('Payload dokumen CV PDF kosong.');
  }

  const todayDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const cleanJobTitle = sanitizePromptInput(jobTitle, 100) || 'Posisi Terkait';
  const cleanCompanyName = sanitizePromptInput(companyName, 100) || 'Perusahaan Target';
  const cleanJobDescription = sanitizePromptInput(jobDescription, 1500) || 'Kualifikasi umum sesuai standar industri';
  const validTone = TONE_OPTIONS.some((opt) => opt.label === toneLabel)
    ? toneLabel
    : TONE_OPTIONS[0].label;

  const promptText = `Anda adalah konsultan karier profesional, HR recruitment specialist, dan copywriter surat lamaran kerja (Cover Letter) dari Lokerresmi.id.
Tugas Anda adalah menulis surat lamaran kerja (Cover Letter) yang SANGAT PERSUASIF, RINGKAS, dan BERBOBOT dalam Bahasa Indonesia berdasarkan resume CV pelamar terlampir dan spesifikasi lowongan kerja dengan standar rekrutmen modern tahun 2026.

DATA TARGET LOWONGAN:
- Posisi yang Dilamar: ${cleanJobTitle}
- Nama Perusahaan Target: ${cleanCompanyName}
- Deskripsi / Kualifikasi Pekerjaan: ${cleanJobDescription}
- Tone of Voice / Gaya Bahasa: ${validTone}
- Tanggal Sekarang: ${todayDateFormatted}

STRUKTUR OUTPUT WAJIB:
${todayDateFormatted}
Yth. Tim Rekrutmen / Manajer HRD
${cleanCompanyName}
di Tempat

Dengan hormat,

[Paragraf 1 - Pembuka Langsung: Buka langsung dengan posisi yang dilamar di ${companyName || 'perusahaan'}, ringkasan latar belakang profesional pelamar, serta proposisi nilai/keahlian inti yang langsung relevan. DILARANG menggunakan kalimat pembuka pasif/klise.]

[Paragraf 2 - Bukti Kompetensi & Pengalaman: Paparkan pencapaian dan pengalaman kerja konkret dari CV pelamar yang paling sesuai dengan deskripsi pekerjaan. Gunakan kata kerja aksi aktif dan bukti faktual.]

[Paragraf 3 - Keterampilan Teknis & Kesiapan Kerja: Soroti keahlian teknis/operasional, kemampuan pemecahan masalah, atau kesiapan mengadopsi alur kerja dan SOP perusahaan secara terstruktur dan teliti.]

[Paragraf 4 - Penutup Profesional & Call to Action: Tegaskan antusiasme kontribusi profesional dan ajukan kesiapan untuk sesi wawancara atau diskusi lebih lanjut.]

Hormat saya,

[Nama Lengkap]
[Nomor WhatsApp]
[Email]

ATURAN DAN LARANGAN KETAT:
1. PENANGANAN TANGGAL: Selalu gunakan tanggal aktual: "${todayDateFormatted}". DILARANG MENGGUNAKAN TAHUN LAMPAU.
2. PEMBUKA LANGSUNG & LUGAS: Paragraf pembuka harus langsung menyebutkan posisi yang dilamar, nama perusahaan, dan kualifikasi inti. DILARANG KERAS menggunakan frasa pembuka pasif/klise seperti "melalui surat ini saya bermaksud menyampaikan ketertarikan saya...", "dengan ini saya bermaksud mengajukan lamaran...", atau sejenisnya.
3. LARANGAN KATA KLISE GENERIK: DILARANG menggunakan kata/frasa klise klise seperti "bertanggung jawab penuh", "pribadi yang disiplin, jujur, dan pembelajar cepat", "kecepatan menyusun", "pekerja keras tanpa lelah", atau klaim kosong tanpa bukti.
4. BUKTI BERORIENTASI TINDAKAN (ACTION-ORIENTED EVIDENCE): Tuliskan pencapaian dan kapabilitas kandidat menggunakan kata kerja aksi aktif (misal: "berperan dalam mengelola...", "terbiasa bekerja secara terstruktur dan teliti", "mengembangkan solusi...", "mengoptimalkan efisiensi alur kerja...").
5. KONTROL PANJANG & TATA LETAK: Batasi panjang surat agar ringkas antara 200–250 kata agar tepat muat dalam 1 halaman A4 saat diekspor ke PDF.
6. PEMISAH PARAGRAF: Gunakan HANYA pemisah baris ganda (\\n\\n) antar paragraf. DILARANG membuat jeda baris kaku (hard line break) di tengah kalimat.
7. DILARANG MENAMBAHKAN PLACEHOLDER TANDA TANGAN: Jangan sertakan teks seperti "(Tanda Tangan)" atau "(Signature)".
8. FORMAT RESPON: Kembalikan HANYA teks surat lamaran kerja siap pakai tanpa kalimat pengantar basa-basi dari AI, tanpa ucapan selamat, dan tanpa blok pembungkus markdown seperti \`\`\`markdown atau \`\`\`.`;

  const modelsToTry = [
    { name: 'gemini-3.1-flash-lite', timeout: 8000 },
    { name: 'gemini-3.8-flash', timeout: 6000 },
  ];

  for (const { name: modelName, timeout: modelTimeout } of modelsToTry) {
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Pdf.trim(),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
            },
          }),
        },
        modelTimeout
      );

      if (response && response.ok) {
        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim().length > 50) {
          // Clean markdown wrappers if any
          let cleanText = candidateText
            .replace(/^```markdown/gi, '')
            .replace(/^```text/gi, '')
            .replace(/^```/g, '')
            .replace(/```$/g, '')
            .trim();

          return {
            text: cleanText,
            isFallback: false,
          };
        }
      } else {
        console.warn(`Gemini call to ${modelName} returned status ${response?.status}`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`Gemini call to ${modelName} timed out (${modelTimeout}ms).`);
      } else {
        console.warn(`Error with ${modelName}:`, err);
      }
    }
  }

  // Graceful fallback to realistic simulated letter
  console.info('Activating fail-safe standby cover letter preview.');
  return {
    text: generateSimulatedCoverLetter(jobTitle, companyName, toneLabel),
    isFallback: true,
  };
};

export default function AICoverLetterModal({ isOpen, onClose, onOpenOrderModal }) {
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [tone, setTone] = useState(TONE_OPTIONS[0].label);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isFallback, setIsFallback] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // File validation (accept only .pdf, max 5MB)
  const validateAndSetFile = (file) => {
    if (!file) return;

    const hasPdfExtension = Boolean(file.name && file.name.toLowerCase().endsWith('.pdf'));
    // Strict MIME validation: if MIME is declared, it must strictly be application/pdf
    const isStrictMimePdf = file.type === 'application/pdf';

    if (!hasPdfExtension || (!isStrictMimePdf && file.type !== '')) {
      toast.error('Format tidak didukung. Mohon unggah dokumen PDF (.pdf) resmi.');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSizeBytes) {
      toast.error('Ukuran file melebihi batas maksimal 5MB. Silakan gunakan file yang lebih ringkas.');
      return;
    }

    setSelectedFile(file);
    toast.success(`File "${file.name}" berhasil dipilih!`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleRemoveFile = (e) => {
    e?.stopPropagation();
    setSelectedFile(null);
  };

  // Provide quick sample PDF option
  const handleUseSample = () => {
    const sampleBlob = new Blob([SAMPLE_PDF_BASE64], { type: 'application/pdf' });
    const sampleFile = new File([sampleBlob], 'Contoh_CV_ATS_Lokerresmi.pdf', {
      type: 'application/pdf',
      lastModified: Date.now(),
    });
    sampleFile._sampleBase64 = SAMPLE_PDF_BASE64;
    setSelectedFile(sampleFile);
    setJobTitle('Frontend Developer');
    setCompanyName('PT Inovasi Digital Nusantara');
    setJobDesc('Membangun aplikasi web interaktif dengan React.js, Tailwind CSS, REST API integration, performa web tinggi, serta kolaborasi lintas fungsi.');
    toast.success('Contoh data lowongan & PDF CV berhasil dimuat!');
  };

  // Form submit handler with guaranteed loading state reset & 20s safety timeout
  const handleGenerate = async (e) => {
    e?.preventDefault();

    if (!jobTitle.trim()) {
      toast.error('Silakan isi posisi / judul pekerjaan yang dilamar.');
      return;
    }

    if (!selectedFile) {
      toast.error('Silakan unggah dokumen CV PDF Anda terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setGeneratedLetter('');
    setIsFallback(false);

    let safetyTimer = null;

    try {
      // 16-second safety timeout using Promise.race that resolves smoothly with fallback
      const timeoutPromise = new Promise((resolve) => {
        safetyTimer = setTimeout(() => {
          console.warn('Safety timeout reached (16s). Returning simulated cover letter fallback.');
          resolve({
            text: generateSimulatedCoverLetter(jobTitle, companyName, tone),
            isFallback: true,
          });
        }, 16000);
      });

      const generateTask = async () => {
        let base64Data = '';
        if (selectedFile._sampleBase64) {
          base64Data = selectedFile._sampleBase64;
        } else {
          base64Data = await readFileAsBase64(selectedFile, 6000);
        }

        if (!base64Data || typeof base64Data !== 'string' || base64Data.trim().length === 0) {
          throw new Error('Gagal mengekstrak data dari file PDF.');
        }

        return await generateCoverLetterWithGemini(
          base64Data,
          jobTitle,
          companyName,
          jobDesc,
          tone
        );
      };

      const result = await Promise.race([generateTask(), timeoutPromise]);

      setGeneratedLetter(result.text);
      setIsFallback(result.isFallback);

      if (result.isFallback) {
        toast('Gagal menganalisis CV atau koneksi terputus. Menggunakan draf standar...', {
          icon: '⚡',
        });
      } else {
        toast.success('Cover Letter berhasil dibuat dengan AI!');
      }
    } catch (err) {
      console.warn('Cover letter generation error, activating fallback:', err);
      // Fallback smoothly to generating a cover letter using generateSimulatedCoverLetter()
      const fallbackText = generateSimulatedCoverLetter(jobTitle, companyName, tone);
      setGeneratedLetter(fallbackText);
      setIsFallback(true);
      toast.error('Gagal menganalisis CV atau koneksi terputus. Menggunakan draf standar...');
    } finally {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
      }
      // CRITICAL: GUARANTEED LOADING STATE RESET - BUTTON NEVER STUCK
      setIsGenerating(false);
    }
  };

  // Export to formatted PDF using html2pdf.js with HTML string method
  const downloadPDF = async () => {
    if (!generatedLetter || !generatedLetter.trim()) {
      toast.error('Teks cover letter kosong.');
      return;
    }

    setIsExporting(true);
    try {
      // Split the cover letter text by newline (\n), filter out empty lines, and map each paragraph
      const paragraphsHtml = generatedLetter
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => `<p style="margin-bottom: 12px; margin-top: 0;">${line}</p>`)
        .join('');

      // Pure HTML string with strict inline styles (padding 15mm, Arial, 12pt, line-height 1.5, text-align: justify)
      const htmlString = `<div style="padding: 15mm; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.5; text-align: justify; color: #000;">${paragraphsHtml}</div>`;

      const safeCompany = companyName
        ? companyName.replace(/[^a-zA-Z0-9]/g, '_')
        : 'Perusahaan';
      const safeRole = jobTitle
        ? jobTitle.replace(/[^a-zA-Z0-9]/g, '_')
        : 'Lamaran';

      const opt = {
        margin: 0, // margin: 0 since 15mm padding is applied in wrapper div
        filename: `Cover_Letter_${safeRole}_${safeCompany}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(htmlString).save();
      toast.success('Surat lamaran A4 berhasil diunduh sebagai PDF!');
    } catch (err) {
      console.warn('PDF export notice:', err?.message || err);
      toast.error('Gagal mengunduh PDF. Anda dapat menyalin teks secara manual.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = downloadPDF;

  // Copy text to clipboard
  const handleCopyText = async () => {
    if (!generatedLetter) return;
    try {
      await navigator.clipboard.writeText(generatedLetter);
      toast.success('Teks cover letter berhasil disalin ke clipboard!');
    } catch {
      toast.error('Gagal menyalin teks secara otomatis.');
    }
  };

  const handleReset = () => {
    setGeneratedLetter('');
    setIsFallback(false);
  };

  const handleUpsellClick = () => {
    if (onOpenOrderModal) {
      onOpenOrderModal('Paket Profesional (Rp 99.000)');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition font-bold text-base z-20 cursor-pointer shadow-xs"
          title="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-2 pr-8">
          <div className="h-9 w-9 rounded-xl bg-teal/15 text-teal flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-navy dark:text-white leading-tight">
              AI Cover Letter Generator (Gratis)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Buat surat lamaran kerja super personal yang disesuaikan dengan CV Anda dan spesifikasi lowongan dalam hitungan detik.
            </p>
          </div>
        </div>

        {!generatedLetter ? (
          /* INPUT FORM VIEW */
          <form onSubmit={handleGenerate} className="mt-4 space-y-4 text-xs sm:text-sm">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Quick Sample Button */}
            {!selectedFile && (
              <div className="flex justify-end -mb-1">
                <button
                  type="button"
                  onClick={handleUseSample}
                  className="text-xs text-teal hover:underline font-medium cursor-pointer"
                >
                  Gunakan Contoh Data & PDF
                </button>
              </div>
            )}

            {/* Job Title & Company Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-teal" />
                  <span>Posisi / Judul Pekerjaan *</span>
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Misal: Frontend Developer, Admin HR..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-xl focus:ring-2 focus:ring-teal outline-none text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-teal" />
                  <span>Nama Perusahaan</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Misal: PT Inovasi Digital Nusantara"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-xl focus:ring-2 focus:ring-teal outline-none text-xs"
                />
              </div>
            </div>

            {/* Job Description Textarea */}
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-slate-400" />
                <span>Deskripsi Pekerjaan / Kualifikasi</span>
              </label>
              <textarea
                rows={3}
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Tempelkan (paste) deskripsi pekerjaan lengkap dari portal lowongan kerja di sini..."
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-xl focus:ring-2 focus:ring-teal outline-none text-xs leading-relaxed"
              />
            </div>

            {/* Tone of Voice Select */}
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-teal" />
                <span>Gaya Bahasa / Tone of Voice *</span>
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-xl focus:ring-2 focus:ring-teal outline-none text-xs cursor-pointer"
              >
                {TONE_OPTIONS.map((item) => (
                  <option key={item.id} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CV Upload Area */}
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-teal" />
                <span>Unggah Dokumen CV (PDF) *</span>
              </label>

              {!selectedFile ? (
                /* Drag & Drop Box */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-teal bg-teal/10 dark:bg-teal/20 scale-[0.99]'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-teal hover:bg-teal/5 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="h-10 w-10 rounded-xl bg-teal/15 text-teal flex items-center justify-center shadow-xs">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-xs">
                      Klik atau seret & jatuhkan file PDF CV Anda ke sini
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hanya format <strong className="text-teal font-semibold">.PDF</strong> (Maksimal 5MB)
                    </p>
                  </div>
                </div>
              ) : (
                /* Selected File Card */
                <div className="border border-teal/40 bg-teal/5 dark:bg-teal/10 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm truncate">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {selectedFile.size ? `${Math.round(selectedFile.size / 1024)} KB` : 'PDF'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          <FileCheck className="h-3 w-3" />
                          <span>CV Siap Dianalisis</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs text-teal hover:bg-teal/10 font-medium rounded-lg transition cursor-pointer"
                      title="Ganti file PDF"
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title="Hapus file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isGenerating || !selectedFile || !jobTitle.trim()}
              className="w-full bg-teal hover:bg-teal/90 active:bg-teal/95 disabled:opacity-50 text-navy font-black py-3.5 rounded-xl shadow-xs transition cursor-pointer min-h-[48px] active:scale-98 flex items-center justify-center gap-2 text-sm"
            >
              {isGenerating ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                  <span>Menganalisis CV & Membuat Cover Letter...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>✨ Buat Cover Letter Sekarang</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* RESULT VIEW & EXPORT */
          <div className="mt-4 space-y-4 text-xs sm:text-sm">
            {/* Warning banner if in standby/fallback mode */}
            {isFallback && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    Mode Draf Standar (Standby Preview)
                  </span>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                    Gagal menganalisis CV atau koneksi terputus. Draf surat lamaran standar profesional telah disesuaikan secara otomatis dengan posisi target Anda.
                  </p>
                </div>
              </div>
            )}

            {/* Header Result Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="font-bold text-slate-800 dark:text-white">
                  Draf Surat Lamaran Kerja
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Anda dapat menyunting teks di bawah ini secara langsung sebelum mengunduh.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Teks</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal text-navy font-black text-xs hover:bg-teal/90 transition cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {isExporting ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                      <span>Mengunduh...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>📥 Download PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editable Textarea */}
            <div>
              <textarea
                rows={14}
                value={generatedLetter}
                onChange={(e) => setGeneratedLetter(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3.5 rounded-xl focus:ring-2 focus:ring-teal outline-none font-serif text-xs sm:text-sm leading-relaxed shadow-inner"
              />
            </div>

            {/* Lead Magnet Banner for ATS CV */}
            <div className="bg-gradient-to-r from-navy via-[#243555] to-navy p-4 sm:p-5 rounded-2xl border border-teal/40 text-white relative overflow-hidden shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                <div className="text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-teal/20 text-teal text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-2">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Layanan Karir Unggulan</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                    Butuh CV Standar ATS yang Lolos HR?
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    Maksimalkan surat lamaran Anda dengan resume standar ATS bergaransi lolos seleksi HR dan revisi tanpa batas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUpsellClick}
                  className="bg-teal hover:bg-teal/90 active:bg-teal text-navy font-black px-5 py-3 rounded-xl transition cursor-pointer text-xs sm:text-sm active:scale-98 shrink-0 shadow-md flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <span>Pesan Pembuatan CV Profesional (Mulai Rp 49k)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition font-medium cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Buat Cover Letter Lainnya</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:underline cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
