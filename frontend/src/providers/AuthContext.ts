/**
 * Auth Context - shared context for authentication state
 */
import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);