export const SITE_URL = 'https://lokerresmi.vercel.app';
export const jobPath = (id) => `/lowongan/${encodeURIComponent(String(id))}`;
export const jobUrl = (id) => `${SITE_URL}${jobPath(id)}`;
