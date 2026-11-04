/**
 * Auth Provider - manages Supabase authentication state
 */
import { useEffect, useState, type ReactNode } from 'react';
import { supabase, onAuthStateChange, getSession } from '../api/supabase';
import type { User } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    getSession()
      .then((session) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth changes
    const sub = onAuthStateChange((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const session = await getSession();
      setSession(session);
      setUser(session?.user ?? null);
    } catch {
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
