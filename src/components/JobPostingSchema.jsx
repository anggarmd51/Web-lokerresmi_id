import React, { useEffect } from 'react';
import createJobPostingJsonLd from '../lib/jobPosting.js';

export { createJobPostingJsonLd };

const SCRIPT_ID = 'lokerresmi-google-jobs-schema';

export default function JobPostingSchema({ job }) {
  useEffect(() => {
    const schemaData = createJobPostingJsonLd(job);
    const previous = document.getElementById(SCRIPT_ID);
    if (previous) previous.remove();

    if (!schemaData) return undefined;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.remove();
    };
  }, [job]);

  return null;
}
