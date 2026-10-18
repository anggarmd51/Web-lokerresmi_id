const CV_PACKAGE_VALUES = Object.freeze({
  'Paket Express (Rp 49.000)': 49000,
  'Paket Profesional (Rp 99.000)': 99000,
  'Paket VIP Mentoring (Rp 249.000)': 249000,
});

/**
 * Send an analytics event when the browser's configured gtag is available.
 * Analytics must never block or break the UI, so failures are intentionally swallowed.
 */
export function trackEvent(name, params = {}) {
  try {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return false;
    }

    window.gtag('event', name, params);
    return true;
  } catch {
    return false;
  }
}

export function trackApply(job) {
  return trackEvent('click_apply', {
    job_id: String(job?.id),
    apply_type: job?.applyType || 'web',
  });
}

export function trackEmployerInquiry(source) {
  return trackEvent('open_employer_inquiry', { source });
}

export function trackCVPackage(packageName, source) {
  const params = {
    package_name: packageName,
    source,
    currency: 'IDR',
  };
  const value = CV_PACKAGE_VALUES[packageName];
  if (value !== undefined) params.value = value;
  return trackEvent('select_cv_package', params);
}
