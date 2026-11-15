import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User, UserRole } from '../types';

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string' && typeof user.fullName === 'string' &&
    typeof user.email === 'string' &&
    (user.role === 'PARENT_CAREGIVER' || user.role === 'SOCIAL_WORKER');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const authVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = authVersion.current;
    async function restoreSession() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (response.status === 401) return;
        if (!response.ok) throw new Error('Session check failed');
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('user' in body) || !isAuthUser(body.user)) {
          throw new Error('Invalid session response');
        }
        if (active && version === authVersion.current) setAuthUser(body.user);
      } catch {
        if (active && version === authVersion.current) {
          setSessionError('Unable to verify your session. Check the backend connection and reload.');
        }
      } finally {
        if (active && version === authVersion.current) setIsLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  const currentUser = useMemo((): User | null => {
    if (!authUser) return null;
    return {
      phone: '',
      accountStatus: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
      ...authUser,
    };
  }, [authUser]);

  const login: AuthContextValue['login'] = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.status === 401) {
        return { ok: false, error: 'Invalid email or password, or account unavailable.' };
      }
      if (!response.ok) return { ok: false, error: 'Unable to sign in. Please try again.' };
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('user' in body) || !isAuthUser(body.user)) {
        return { ok: false, error: 'The server returned an invalid response.' };
      }
      authVersion.current += 1;
      setAuthUser(body.user);
      setSessionError(null);
      setIsLoading(false);
      return { ok: true, user: body.user };
    } catch {
      return { ok: false, error: 'Unable to reach the login server. Please try again.' };
    }
  };

  const logout = async () => {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error('Unable to sign out.');
    authVersion.current += 1;
    setAuthUser(null);
    setSessionError(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: Boolean(currentUser),
      isLoading,
      sessionError,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
