import { jobPath, readJobRoute } from './seo.js';

const STATE_KEY = '__lokerresmiNavigation';
const MODAL_TYPES = new Set(['cv-checker', 'cover-letter', 'employer-inquiry', 'cv-order', 'admin-login']);

function navigationState(window) {
  const state = window.history.state?.[STATE_KEY];
  return state?.version === 1 ? state : null;
}

function entryState(window, navigation) {
  return { ...window.history.state, [STATE_KEY]: navigation };
}

export function readNavigation(window) {
  const state = navigationState(window);
  return {
    route: readJobRoute(window.location),
    modal: state?.kind === 'modal' && MODAL_TYPES.has(state.modal?.type) ? state.modal : null,
  };
}

export function initializeModalHistory(window) {
  const route = readJobRoute(window.location);
  if (route.legacy && !route.invalid) {
    window.history.replaceState(window.history.state, '', jobPath(route.id));
  }
  // A direct/shared detail URL needs its own same-site parent before Back can close it.
  // Preserve existing managed entries on reload and React StrictMode effect replays.
  if ((route.isDetail || route.invalid) && !navigationState(window)) {
    const detailUrl = window.location.pathname + window.location.search + window.location.hash;
    window.history.replaceState(entryState(window, null), '', '/');
    window.history.pushState(entryState(window, { version: 1, kind: 'job' }), '', detailUrl);
  }
  return readNavigation(window);
}

export function openJobHistory(window, job) {
  window.history.pushState(entryState(window, { version: 1, kind: 'job' }), '', jobPath(job.id));
  return readNavigation(window);
}

export function openModalHistory(window, type, payload = null, { replace = false } = {}) {
  if (!MODAL_TYPES.has(type)) throw new Error(`Unknown modal type: ${type}`);
  const state = entryState(window, { version: 1, kind: 'modal', modal: { type, payload } });
  // Replacing an AI upsell with the order form avoids a stale intermediate modal.
  const method = replace && navigationState(window)?.kind === 'modal' ? 'replaceState' : 'pushState';
  window.history[method](state, '', window.location.href);
  return readNavigation(window);
}

export function closeModalHistory(window) {
  if (navigationState(window)) {
    window.history.back();
    return null; // popstate publishes the completed navigation, not an optimistic URL.
  }
  // Never navigate to an unknown (possibly external) predecessor.
  window.history.replaceState(entryState(window, null), '', '/');
  return readNavigation(window);
}
