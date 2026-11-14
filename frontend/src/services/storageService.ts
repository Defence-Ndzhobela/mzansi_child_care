import { SEED_DATA } from '../data/seedData';
import { AppDatabaseState } from '../types';

const DB_STORAGE_KEY = 'mzansi_childcare_db_v1';
const SESSION_STORAGE_KEY = 'mzansi_childcare_session_v1';

export interface StoredSession {
  userId: string;
  loggedInAt: string;
}

export function loadDatabase(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const cloned = structuredClone(SEED_DATA);
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(cloned));
      return cloned;
    }
    const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
    // Ensure all expected collections exist
    return {
      users: parsed.users ?? structuredClone(SEED_DATA.users),
      children: parsed.children ?? structuredClone(SEED_DATA.children),
      familyRelationships: parsed.familyRelationships ?? structuredClone(SEED_DATA.familyRelationships),
      arrangements: parsed.arrangements ?? structuredClone(SEED_DATA.arrangements),
      payments: parsed.payments ?? structuredClone(SEED_DATA.payments),
      evidence: parsed.evidence ?? structuredClone(SEED_DATA.evidence),
      assignments: parsed.assignments ?? structuredClone(SEED_DATA.assignments),
      reviews: parsed.reviews ?? structuredClone(SEED_DATA.reviews),
      professionalNotes: parsed.professionalNotes ?? structuredClone(SEED_DATA.professionalNotes),
      concerns: parsed.concerns ?? structuredClone(SEED_DATA.concerns),
      notifications: parsed.notifications ?? structuredClone(SEED_DATA.notifications),
    };
  } catch {
    const fallback = structuredClone(SEED_DATA);
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

export function saveDatabase(state: AppDatabaseState): void {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
}

export function resetDatabaseStorage(): AppDatabaseState {
  const fresh = structuredClone(SEED_DATA);
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}
