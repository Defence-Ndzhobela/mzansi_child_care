import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { apiFetch } from '../services/apiClient';
import { dashboardPathFor, roleCheckPathFor } from '../utils/roles';

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
    const path = roleCheckPathFor(allowedRole);
    apiFetch(path)
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
    return <Navigate to={dashboardPathFor(currentUser.role)} replace />;
  }

  if (!access || access.userId !== currentUser.id || access.role !== allowedRole) return <p>Checking access...</p>;
  if (access.status === 'denied') return <Navigate to="/login" replace />;
  if (access.status === 'error') return <p role="alert">Unable to verify access. Check the backend connection and reload.</p>;

  return <>{children}</>;
}
