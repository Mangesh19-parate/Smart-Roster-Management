/**
 * Supabase Auth integration for Smart Roster Management.
 * Handles login, session management, and demo mode.
 */

import { createClient } from '@supabase/supabase-js';

// Safe fallbacks to prevent crash when env vars are missing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Demo credentials
export const DEMO_USERS = {
  manager: {
    email: 'manager@demo.local',
    password: 'demo123',
    role: 'MANAGER',
    id: '11111111-1111-1111-1111-111111111111',
  },
  podLead: {
    email: 'podlead@demo.local',
    password: 'demo123',
    role: 'POD_LEAD',
    id: '22222222-2222-2222-2222-222222222222',
  },
  employee: {
    email: 'employee@demo.local',
    password: 'demo123',
    role: 'EMPLOYEE',
    id: '33333333-3333-3333-3333-333333333333',
  },
};

const listeners = new Set<(session: any) => void>();

function notify(session: any) {
  for (const fn of listeners) {
    try {
      fn(session);
    } catch {
      // ignore
    }
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  localStorage.removeItem('demo-session');
  localStorage.removeItem('sb-access-token');
  notify(null);
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
}

export async function getSession() {
  const demoRaw = localStorage.getItem('demo-session');
  if (demoRaw) {
    try {
      return JSON.parse(demoRaw);
    } catch {
      localStorage.removeItem('demo-session');
    }
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

export function onAuthStateChange(callback: (session: any) => void) {
  listeners.add(callback);
  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem('sb-access-token', session.access_token);
      } else if (!localStorage.getItem('demo-session')) {
        localStorage.removeItem('sb-access-token');
      }
      callback(session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
            subscription?.unsubscribe();
          },
        },
      },
    };
  } catch {
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  }
}

// ponytail: instant local demo login without waiting on remote network timeouts
export async function signInDemo(role: keyof typeof DEMO_USERS) {
  const demoUser = DEMO_USERS[role];
  const isLive = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
  );

  if (isLive) {
    try {
      return await signIn(demoUser.email, demoUser.password);
    } catch {
      // Fall through to local demo session if live login fails
    }
  }

  const mockSession = {
    access_token: `demo-token-${demoUser.role.toLowerCase()}`,
    user: {
      id: demoUser.id,
      email: demoUser.email,
      role: demoUser.role,
      user_metadata: { role: demoUser.role },
      app_metadata: {
        role: demoUser.role,
        pod_id: demoUser.role === 'POD_LEAD' ? '33333333-3333-3333-3333-333333333333' : undefined,
      },
    },
  };
  localStorage.setItem('demo-session', JSON.stringify(mockSession));
  localStorage.setItem('sb-access-token', mockSession.access_token);
  notify(mockSession);
  return { user: mockSession.user, session: mockSession };
}

export async function checkDemoMode(): Promise<{ demoMode: boolean; coldStart: boolean }> {
  return { demoMode: true, coldStart: false };
}
