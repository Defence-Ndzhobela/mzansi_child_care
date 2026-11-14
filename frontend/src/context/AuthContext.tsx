import React, { createContext, useContext, useMemo, useState } from 'react';
import { User } from '../types';
import { loadSession, saveSession } from '../services/storageService';
import { useData } from './DataContext';

interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { ok: boolean; user?: User; error?: string };
  registerParent: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    region: string;
  }) => { ok: boolean; user?: User; error?: string };
  logout: () => void;
  switchDemoFamilyUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { db, addUser } = useData();
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
    const stored = loadSession();
    return stored?.userId ?? null;
  });

  const currentUser = useMemo(() => {
    if (!sessionUserId) return null;
    return db.users.find((u) => u.id === sessionUserId) ?? null;
  }, [db.users, sessionUserId]);

  const login = (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) {
      return { ok: false, error: 'No account found with that email address.' };
    }
    if (user.password !== password) {
      return { ok: false, error: 'Incorrect password.' };
    }
    if (user.accountStatus !== 'ACTIVE') {
      return { ok: false, error: 'This account is inactive.' };
    }
    setSessionUserId(user.id);
    saveSession({ userId: user.id, loggedInAt: new Date().toISOString() });
    return { ok: true, user };
  };

  const registerParent = (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    region: string;
  }) => {
    const normalized = input.email.trim().toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === normalized);
    if (existing) {
      return { ok: false, error: 'An account with this email address already exists.' };
    }
    const created = addUser({
      fullName: input.fullName.trim(),
      email: normalized,
      phone: input.phone.trim(),
      password: input.password,
      role: 'PARENT_CAREGIVER',
      region: input.region.trim() || 'South Africa',
    });
    setSessionUserId(created.id);
    saveSession({ userId: created.id, loggedInAt: new Date().toISOString() });
    return { ok: true, user: created };
  };

  const logout = () => {
    setSessionUserId(null);
    saveSession(null);
  };

  const switchDemoFamilyUser = (userId: string) => {
    const target = db.users.find((u) => u.id === userId && u.role === 'PARENT_CAREGIVER');
    if (!target) return;
    setSessionUserId(target.id);
    saveSession({ userId: target.id, loggedInAt: new Date().toISOString() });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        registerParent,
        logout,
        switchDemoFamilyUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
