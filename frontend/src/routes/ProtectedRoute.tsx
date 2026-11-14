import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { currentUser, isLoading, sessionError } = useAuth();
  const [access, setAccess] = useState<{
    userId: string;
    role: UserRole;
    status: 'allowed' | 'denied' | 'error';
  } | null>(null);

  useEffect(() => {
    let active = true;
    setAccess(null);
    if (!currentUser || currentUser.role !== allowedRole) return () => { active = false; };
    const userId = currentUser.id;
    const path = allowedRole === 'SOCIAL_WORKER' ? '/api/social-worker/me' : '/api/parent/me';
    fetch(path, { credentials: 'same-origin' })
      .then((response) => {
        if (active) setAccess({
          userId,
          role: allowedRole,
          status: response.ok ? 'allowed' : response.status === 401 || response.status === 403 ? 'denied' : 'error',
        });
      })
      .catch(() => { if (active) setAccess({ userId, role: allowedRole, status: 'error' }); });
    return () => { active = false; };
  }, [currentUser?.id, currentUser?.role, allowedRole]);

  if (isLoading) return <p>Checking your session...</p>;
  if (sessionError) return <p role="alert">{sessionError}</p>;

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== allowedRole) {
    const fallback =
      currentUser.role === 'SOCIAL_WORKER'
        ? '/social-worker/dashboard'
        : '/parent/dashboard';
    return <Navigate to={fallback} replace />;
  }

  if (!access || access.userId !== currentUser.id || access.role !== allowedRole) return <p>Checking access...</p>;
  if (access.status === 'denied') return <Navigate to="/login" replace />;
  if (access.status === 'error') return <p role="alert">Unable to verify access. Check the backend connection and reload.</p>;

  return <>{children}</>;
}
