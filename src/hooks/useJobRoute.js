import { useCallback, useEffect, useRef, useState } from 'react';
import {
  closeModalHistory,
  initializeModalHistory,
  openJobHistory,
  openModalHistory,
  readNavigation,
} from '../lib/modalHistory';

export default function useJobRoute() {
  const [navigation, setNavigation] = useState(() => readNavigation(window));
  const closing = useRef(false);

  useEffect(() => {
    const syncRoute = () => {
      closing.current = false;
      setNavigation(initializeModalHistory(window));
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
    if (!closing.current) setNavigation(openJobHistory(window, job));
  }, []);

  const openModal = useCallback((type, payload = null, options = {}) => {
    if (!closing.current) setNavigation(openModalHistory(window, type, payload, options));
  }, []);

  const closeModal = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const next = closeModalHistory(window);
    if (next) {
      closing.current = false;
      setNavigation(next);
    }
  }, []);

  return { ...navigation, openJob, closeJob: closeModal, openModal, closeModal };
}
