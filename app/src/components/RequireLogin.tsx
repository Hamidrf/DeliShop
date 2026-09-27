import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../lib/auth';

/** Gates studio pages behind a session cookie; shows nothing until `GET /api/auth/me` answers. */
export function RequireLogin({ children }: { children: ReactNode }) {
  const { data, isPending } = useMe();
  if (isPending) return null;
  if (!data) return <Navigate to="/studio/login" replace />;
  return <>{children}</>;
}
