import { SEED_DATA } from '../data/seedData';
import { AppDatabaseState } from '../types';

const DB_STORAGE_KEY = 'mzansi_childcare_db_v1';

const DEMO_USER_IDS = new Map([
  ['user-parent-thandiwe', '11111111-1111-4111-8111-111111111101'],
  ['user-parent-sipho', '11111111-1111-4111-8111-111111111102'],
  ['user-worker-nomsa', '11111111-1111-4111-8111-111111111103'],
  ['user-parent-lerato', '11111111-1111-4111-8111-111111111104'],
  ['user-parent-kabelo', '11111111-1111-4111-8111-111111111105'],
]);

function migrateDemoData(raw: string): Partial<AppDatabaseState> {
  return JSON.parse(raw, (key, value: unknown) => {
    if (key === 'password') return undefined;
    return typeof value === 'string' ? DEMO_USER_IDS.get(value) ?? value : value;
  }) as Partial<AppDatabaseState>;
}

function freshDemoData(): AppDatabaseState {
  return migrateDemoData(JSON.stringify(SEED_DATA)) as AppDatabaseState;
}

export function loadDatabase(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) {
      const cloned = freshDemoData();
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(cloned));
      return cloned;
    }
    const parsed = migrateDemoData(raw);
    // Ensure all expected collections exist
    const seed = freshDemoData();
    const migrated = {
      users: parsed.users ?? seed.users,
      children: parsed.children ?? seed.children,
      familyRelationships: parsed.familyRelationships ?? seed.familyRelationships,
      arrangements: parsed.arrangements ?? seed.arrangements,
      payments: parsed.payments ?? seed.payments,
      evidence: parsed.evidence ?? seed.evidence,
      assignments: parsed.assignments ?? seed.assignments,
      reviews: parsed.reviews ?? seed.reviews,
      professionalNotes: parsed.professionalNotes ?? seed.professionalNotes,
      concerns: parsed.concerns ?? seed.concerns,
      notifications: parsed.notifications ?? seed.notifications,
    };
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    const fallback = freshDemoData();
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

export function saveDatabase(state: AppDatabaseState): void {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
}

export function resetDatabaseStorage(): AppDatabaseState {
  const fresh = freshDemoData();
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
