import { useCallback, useEffect, useState } from 'react';
import { jobPath, readJobRoute } from '../lib/seo';

export default function useJobRoute() {
  const [route, setRoute] = useState(() => readJobRoute(window.location));
  useEffect(() => {
    const syncRoute = () => {
      const next = readJobRoute(window.location);
      if (next.legacy && !next.invalid) {
        window.history.replaceState(null, '', jobPath(next.id));
      }
      setRoute(next);
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const openJob = useCallback((job) => {
    window.history.pushState({ jobModal: true }, '', jobPath(job.id));
    setRoute(readJobRoute(window.location));
  }, []);

  const closeJob = useCallback(() => {
    if (window.history.state?.jobModal) {
      window.history.back();
    } else {
      // Direct entry has no guaranteed same-site history to return to.
      window.history.replaceState(null, '', '/');
      setRoute(readJobRoute(window.location));
    }
  }, []);

  return { route, openJob, closeJob };
}
