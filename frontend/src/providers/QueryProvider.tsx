/**
 * TanStack Query Provider
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { queryClient } from '../api/client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => queryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}