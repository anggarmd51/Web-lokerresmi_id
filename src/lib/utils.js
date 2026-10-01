/**
 * Utility functions for Lokerresmi
 */

/**
 * Mengurutkan array lowongan kerja dengan memprioritaskan lowongan berstatus featured/premium.
 */
export const sortJobsByFeatured = (items = []) =>
  [...items].sort((a, b) => {
    const aFeatured = Boolean(a.featured || a.is_featured);
    const bFeatured = Boolean(b.featured || b.is_featured);
    return Number(bFeatured) - Number(aFeatured);
  });
