import React, { useEffect } from 'react';

const mapEmploymentType = (type = '') => {
  const t = type.toLowerCase();
  if (t.includes('part time')) return 'PART_TIME';
  if (t.includes('kontrak') || t.includes('contract')) return 'CONTRACTOR';
  if (t.includes('magang') || t.includes('intern')) return 'INTERN';
  if (t.includes('freelance')) return 'OTHER';
  return 'FULL_TIME';
};

export const createJobPostingJsonLd = (job) => {
  if (!job) return null;

  const postedDate = job.created_at || job.date || new Date().toISOString();
  const postedDateTime = new Date(postedDate).getTime();
  const validUntilDate = !isNaN(postedDateTime)
    ? new Date(postedDateTime + 60 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const isRemote =
    (job.type && job.type.toLowerCase().includes('remote')) ||
    (job.location && job.location.toLowerCase().includes('remote'));

  const reqsList = Array.isArray(job.requirements)
    ? job.requirements.join('. ')
    : typeof job.requirements === 'string'
    ? job.requirements
    : '';

  const fullDescription = [
    job.desc || '',
    reqsList ? `Persyaratan: ${reqsList}` : '',
    job.salary ? `Gaji: ${job.salary}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title || 'Lowongan Kerja',
    description: fullDescription || 'Informasi lowongan kerja terverifikasi di Lokerresmi.id',
    identifier: {
      '@type': 'PropertyValue',
      name: 'Lokerresmi.id',
      value: String(job.id || 'lr-job'),
    },
    datePosted: !isNaN(postedDateTime) ? new Date(postedDateTime).toISOString() : new Date().toISOString(),
    validThrough: validUntilDate,
    employmentType: mapEmploymentType(job.type),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company || 'Perusahaan Mitra Lokerresmi',
      sameAs: 'https://lokerresmi.id',
      logo: 'https://lokerresmi.id/logo.png',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location || 'Indonesia',
        addressRegion: 'Indonesia',
        addressCountry: 'ID',
      },
    },
    directApply: true,
  };

  if (isRemote) {
    schema.jobLocationType = 'TELECOMMUTE';
    schema.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'ID',
    };
  }

  return schema;
};

export default function JobPostingSchema({ job, jobs = [] }) {
  useEffect(() => {
    let schemaData = null;

    if (job) {
      schemaData = createJobPostingJsonLd(job);
    } else if (jobs && jobs.length > 0) {
      // Buat ItemList terstruktur untuk beberapa lowongan teratas
      const topJobs = jobs.slice(0, 10);
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: topJobs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: createJobPostingJsonLd(item),
        })),
      };
    }

    if (!schemaData) return;

    const scriptId = 'lokerresmi-google-jobs-schema';
    let scriptTag = document.getElementById(scriptId);

    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    scriptTag.textContent = JSON.stringify(schemaData, null, 2);

    return () => {
      const el = document.getElementById(scriptId);
      if (el) {
        el.remove();
      }
    };
  }, [job, jobs]);

  return null;
}
