import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(false);

      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && Array.isArray(data)) {
        setJobs(data);
      } else {
        setJobs([]);
      }
    } catch {
      setError(true);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const activeJobs = jobs.filter((job) => job.status === 'Aktif');

  return {
    jobs,
    activeJobs,
    loading,
    error,
    setJobs,
  };
}
