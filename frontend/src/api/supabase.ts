/**
 * Supabase Auth integration for Smart Roster Management.
 * Handles login, session management, and demo mode.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Demo credentials (for local development)
export const DEMO_USERS = {
  manager: {
    email: 'manager@demo.local',
    password: 'demo123',
    role: 'MANAGER',
  },
  podLead: {
    email: 'podlead@demo.local',
    password: 'demo123',
    role: 'POD_LEAD',
  },
  employee: {
    email: 'employee@demo.local',
    password: 'demo123',
    role: 'EMPLOYEE',
  },
};

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      localStorage.setItem('sb-access-token', session.access_token);
    } else {
      localStorage.removeItem('sb-access-token');
    }
    callback(session);
  });
}

export async function signInDemo(role: keyof typeof DEMO_USERS) {
  const demoUser = DEMO_USERS[role];
  return signIn(demoUser.email, demoUser.password);
}

// Check if we're in demo mode (server-side setting)
export async function checkDemoMode(): Promise<{ demoMode: boolean; coldStart: boolean }> {
  try {
    const response = await fetch('/api/v1/health');
    await response.json();
    // The server will indicate demo mode and cold start via headers or response
    return { demoMode: true, coldStart: false };
  } catch {
    return { demoMode: false, coldStart: false };
  }
}