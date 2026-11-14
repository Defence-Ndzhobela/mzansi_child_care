import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { currentUser } = useAuth();

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

  return <>{children}</>;
}
