import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Inisialisasi awal autentikasi secara eksklusif dari Supabase getSession
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (mounted) {
          if (error || !session) {
            setIsLoggedIn(false);
          } else {
            setIsLoggedIn(true);
          }
        }
      } catch {
        if (mounted) {
          setIsLoggedIn(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listener realtime untuk memantau perubahan status login, logout, atau token refresh
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setIsLoggedIn(Boolean(session));
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const login = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setIsLoggedIn(Boolean(data?.session));
    return true;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore
    } finally {
      setIsLoggedIn(false);
    }
    return true;
  };

  return {
    isLoggedIn,
    loading,
    login,
    logout,
  };
}
