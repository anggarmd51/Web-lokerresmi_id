import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function useAuth() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (mounted) {
        setIsAdmin(false);
        setLoading(Boolean(nextSession));
        setSession(nextSession ? { ...nextSession } : null);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted && !receivedAuthEvent) setSession(error ? null : data?.session || null);
    }).catch(() => {
      if (mounted && !receivedAuthEvent) setSession(null);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  // RPC di luar callback onAuthStateChange; hindari deadlock Supabase Auth.
  useEffect(() => {
    let current = true;
    if (session === undefined) return undefined;
    setIsAdmin(false);
    if (!session) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_lokerresmi_admin');
        if (current) setIsAdmin(!error && data === true);
      } catch {
        if (current) setIsAdmin(false);
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; };
  }, [session]);

  const login = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: allowed, error: adminError } = await supabase.rpc('is_lokerresmi_admin');
    if (!data?.session || adminError || allowed !== true) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setIsAdmin(false);
      const accessError = new Error('Akun ini tidak memiliki hak akses admin');
      accessError.code = 'admin_access_denied';
      throw accessError;
    }
    setSession(data.session);
    return true;
  };

  const logout = async () => {
    setIsAdmin(false);
    setSession(null);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    return true;
  };

  // Alias kompatibel: panel lama memakai isLoggedIn sebagai gerbang admin.
  return { isAdmin, isLoggedIn: isAdmin, loading, login, logout };
}
