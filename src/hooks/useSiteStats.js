import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const SESSION_STORAGE_KEY = 'lokerresmi_visit_logged_v1';

export default function useSiteStats() {
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const hasRecordedRef = useRef(false);

  // Fungsi membaca statistik saat ini dari Supabase
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('site_stats')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        setTotalViews(0);
      } else if (data) {
        const viewsCount =
          data.total_views ??
          data.views ??
          data.count ??
          data.total_visits ??
          data.visits ??
          data.value ??
          0;
        setTotalViews(Number(viewsCount) || 0);
      } else {
        setTotalViews(0);
      }
    } catch {
      setTotalViews(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fungsi mencatat kunjungan halaman (increment view counter)
  const recordPageView = useCallback(async () => {
    // Hindari duplikasi penghitungan dalam sesi browser yang sama
    if (typeof window === 'undefined') return;
    if (hasRecordedRef.current) return;
    if (sessionStorage.getItem(SESSION_STORAGE_KEY)) return;

    hasRecordedRef.current = true;
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');

    try {
      // 1. Coba panggil RPC increment_site_views jika tersedia
      const { data: rpcData, error: rpcErr } = await supabase.rpc('increment_site_views');

      if (!rpcErr && typeof rpcData === 'number') {
        setTotalViews(rpcData);
        return;
      }

      // 2. Jika RPC belum dibuat atau ditolak, lakukan operasi table update / insert langsung
      const { data: existingRow, error: checkErr } = await supabase
        .from('site_stats')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (checkErr) {
        return;
      }

      if (existingRow) {
        const currentCount = Number(existingRow.total_views || 0);
        const newCount = currentCount + 1;

        const updatePayload = {
          total_views: newCount,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
          .from('site_stats')
          .update(updatePayload)
          .eq('id', existingRow.id);

        if (!updateErr) {
          setTotalViews(newCount);
        }
      } else {
        // Jika tabel kosong, insert baris pertama dengan nilai 1
        const insertPayload = {
          id: 1,
          total_views: 1,
          updated_at: new Date().toISOString(),
        };

        const { error: insertErr } = await supabase
          .from('site_stats')
          .insert([insertPayload]);

        if (!insertErr) {
          setTotalViews(1);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Jalankan fetch stats dan aktifkan realtime subscription
  useEffect(() => {
    fetchStats();

    // Supabase Realtime Subscription untuk pembaruan live jika ada row change
    let channel;
    try {
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase
          .channel('site_stats_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'site_stats' },
            (payload) => {
              if (payload.new) {
                const updatedCount =
                  payload.new.total_views ??
                  payload.new.views ??
                  payload.new.count ??
                  payload.new.total_visits ??
                  payload.new.value;
                if (updatedCount !== undefined) {
                  setTotalViews(Number(updatedCount));
                  setIsLive(true);
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsLive(true);
            }
          });
      }
    } catch {
      // ignore realtime errors
    }

    return () => {
      if (channel && supabase && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchStats]);

  return {
    totalViews,
    loading,
    isLive,
    fetchStats,
    recordPageView,
  };
}
