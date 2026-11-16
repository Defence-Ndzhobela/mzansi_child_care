import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AppDatabaseState,
  ArrangementFrequency,
  ArrangementStatus,
  Child,
  ChildLinkRequest,
  DashboardSummary,
  FamilyRelationship,
  MaintenanceArrangement,
  MaintenanceRole,
  Payment,
  PaymentConcern,
  PaymentEvidence,
  PaymentMethod,
  PaymentReview,
  ProfessionalNote,
  RelationshipType,
  ReviewStatus,
  User,
} from '../types';
import { DEMO_USER_DB_IDS, loadDatabase, resetDatabaseStorage, saveDatabase } from '../services/storageService';
import { apiFetch } from '../services/apiClient';
import { generateId } from '../utils/format';
import { useAuth } from './AuthContext';

interface EvidenceInput {
  fileName: string;
  fileType: string;
  fileSizeLabel: string;
  description: string;
}

interface DataContextValue {
  db: AppDatabaseState;
  childrenLoading: boolean;
  childrenError: string | null;
  maintenanceLoading: boolean;
  maintenanceError: string | null;
  dashboardSummary: DashboardSummary | null;
  pendingChildLinkRequests: ChildLinkRequest[];
  refreshFamilyData: () => Promise<void>;
  refreshMaintenanceData: () => Promise<void>;
  refreshChildLinkRequests: () => Promise<void>;
  updateUserProfile: (
    userId: string,
    updates: { fullName: string; phone: string; region?: string }
  ) => void;
  addChild: (input: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    southAfricanId: string;
    relationshipType: RelationshipType;
    isPrimaryCaregiver: boolean;
  }) => Promise<void>;
  updateChild: (
    childId: string,
    updates: { firstName: string; lastName: string; dateOfBirth: string }
  ) => Promise<void>;
  requestChildLink: (southAfricanId: string, relationshipType: RelationshipType) => Promise<void>;
  respondToChildLinkRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED') => Promise<void>;
  // The server decides who pays and who receives from myRole and the signed-in account.
  addArrangement: (input: {
    childId: string;
    myRole: MaintenanceRole;
    otherUserId: string;
    expectedAmount: number;
    frequency: ArrangementFrequency;
    startDate: string;
    endDate?: string;
    notes?: string;
  }) => Promise<void>;
  updateArrangement: (
    arrangementId: string,
    updates: {
      expectedAmount: number;
      frequency: ArrangementFrequency;
      startDate: string;
      endDate?: string;
      status: ArrangementStatus;
      notes?: string;
    }
  ) => Promise<void>;
  recordPayment: (input: {
    arrangementId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    paymentReference: string;
    evidenceFile?: EvidenceInput;
  }) => Promise<void>;
  confirmOrDisputePayment: (input: {
    paymentId: string;
    action: 'CONFIRM_FULL' | 'CONFIRM_PARTIAL' | 'DISPUTE';
    confirmedAmount?: number;
    note?: string;
  }) => Promise<void>;
  addEvidenceToPayment: (input: { paymentId: string } & EvidenceInput) => Promise<void>;
  upsertPaymentReview: (input: {
    paymentId: string;
    reviewedBy: string;
    reviewStatus: ReviewStatus;
    reviewNotes: string;
  }) => PaymentReview;
  addProfessionalNote: (input: {
    socialWorkerId: string;
    childId: string;
    note: string;
  }) => ProfessionalNote;
  updateConcernStatus: (
    concernId: string,
    status: PaymentConcern['status']
  ) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  resetDemoData: () => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

interface ApiChild extends Child {
  relationships: FamilyRelationship[];
}

async function responseError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    return 'The server returned an invalid response.';
  }
  return 'The request could not be completed.';
}

function relationshipPayload(relationshipType: RelationshipType): string {
  return relationshipType.replace(/[\s-]+/g, '_').toUpperCase();
}

const PAYMENT_METHOD_CODES: Record<PaymentMethod, string> = {
  'EFT Bank Transfer': 'EFT_BANK_TRANSFER',
  'eWallet / Instant Money': 'E_WALLET_INSTANT_MONEY',
  'Cash with Receipt': 'CASH_WITH_RECEIPT',
  'Retail Money Transfer': 'RETAIL_MONEY_TRANSFER',
  Other: 'OTHER',
};

type ApiArrangement = MaintenanceArrangement & { payerName: string; receiverName: string };
type ApiPayment = Payment & { payerName: string; receiverName: string; evidence: PaymentEvidence[] };

async function readList<T>(response: Response, key: string): Promise<T[]> {
  if (!response.ok) throw new Error(await responseError(response));
  const body = await response.json() as Record<string, unknown>;
  const list = body[key];
  if (!Array.isArray(list)) throw new Error('The server returned an invalid response.');
  return list as T[];
}

async function sendJson(path: string, method: string, body: unknown): Promise<void> {
  const response = await apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await responseError(response));
}

function partyUser(id: string, fullName: string): User {
  return {
    id, fullName, email: '', phone: '', role: 'PARENT_CAREGIVER',
    accountStatus: 'ACTIVE', createdAt: '', updatedAt: '',
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading: authLoading } = useAuth();
  const [db, setDb] = useState<AppDatabaseState>(() => loadDatabase());
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [pendingChildLinkRequests, setPendingChildLinkRequests] = useState<ChildLinkRequest[]>([]);
  const maintenanceRequest = useRef(0);

  const refreshChildLinkRequests = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'PARENT_CAREGIVER') {
      setPendingChildLinkRequests([]);
      return;
    }
    const response = await apiFetch('/parent/child-link-requests');
    if (!response.ok) throw new Error(await responseError(response));
    const body = await response.json() as { requests?: ChildLinkRequest[] };
    if (!Array.isArray(body.requests)) throw new Error('Invalid child-link request response.');
    setPendingChildLinkRequests(body.requests);
  }, [currentUser]);

  const refreshFamilyData = useCallback(async () => {
    if (!currentUser) {
      setDb((previous) => ({
        ...previous,
        users: previous.users.filter((user) => DEMO_USER_DB_IDS.has(user.id)),
        children: [],
        familyRelationships: [],
        arrangements: [],
        payments: [],
        evidence: [],
      }));
      setPendingChildLinkRequests([]);
      setDashboardSummary(null);
      setChildrenLoading(false);
      setChildrenError(null);
      return;
    }

    setChildrenLoading(true);
    setChildrenError(null);
    try {
      const endpoint = currentUser.role === 'SOCIAL_WORKER'
        ? '/social-worker/children'
        : '/parent/children';
      const response = await apiFetch(endpoint);
      if (!response.ok) throw new Error(await responseError(response));
      const body = await response.json() as { children?: ApiChild[] };
      if (!Array.isArray(body.children)) throw new Error('Invalid child data response.');
      const familyChildren = body.children.map((item) => ({
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        dateOfBirth: item.dateOfBirth,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      const relationships = body.children.flatMap((item) => item.relationships ?? []);

      setDb((previous) => {
        // Keep names of people already known from arrangements and payments loaded earlier.
        const partyIds = new Set([
          ...previous.arrangements.flatMap((a) => [a.payingUserId, a.receivingUserId]),
          ...previous.payments.flatMap((p) => [p.payingUserId, p.receivingUserId]),
        ]);
        const users = new Map(previous.users
          .filter((user) => DEMO_USER_DB_IDS.has(user.id) || partyIds.has(user.id))
          .map((user) => [user.id, user]));
        users.set(currentUser.id, { ...users.get(currentUser.id), ...currentUser });
        relationships.forEach((relationship) => {
          if (!relationship.userId || !relationship.fullName || !relationship.email) return;
          users.set(relationship.userId, {
            ...users.get(relationship.userId),
            id: relationship.userId,
            fullName: relationship.fullName,
            email: relationship.email,
            phone: users.get(relationship.userId)?.phone ?? '',
            role: 'PARENT_CAREGIVER',
            accountStatus: 'ACTIVE',
            createdAt: users.get(relationship.userId)?.createdAt ?? '',
            updatedAt: users.get(relationship.userId)?.updatedAt ?? '',
          });
        });
        return {
          ...previous,
          users: [...users.values()],
          children: familyChildren,
          familyRelationships: relationships,
        };
      });

      if (currentUser.role === 'PARENT_CAREGIVER') {
        await refreshChildLinkRequests();
      } else {
        setPendingChildLinkRequests([]);
      }
    } catch (error) {
      setChildrenError(error instanceof Error ? error.message : 'Unable to load child profiles.');
      throw error;
    } finally {
      setChildrenLoading(false);
    }
  }, [currentUser, refreshChildLinkRequests]);

  // Arrangements, payments and evidence always come from the backend. Responses that arrive
  // after the signed-in user changed (or after a newer request started) are ignored.
  const refreshMaintenanceData = useCallback(async () => {
    const requestId = ++maintenanceRequest.current;
    if (!currentUser) {
      setDashboardSummary(null);
      setMaintenanceLoading(false);
      setMaintenanceError(null);
      return;
    }

    setMaintenanceLoading(true);
    setMaintenanceError(null);
    try {
      const isParent = currentUser.role === 'PARENT_CAREGIVER';
      const prefix = isParent ? '/parent' : '/social-worker';
      const [arrangementResponse, paymentResponse, summaryResponse] = await Promise.all([
        apiFetch(`${prefix}/arrangements`),
        apiFetch(`${prefix}/payments`),
        isParent ? apiFetch('/parent/dashboard-summary') : Promise.resolve(null),
      ]);
      const arrangements = await readList<ApiArrangement>(arrangementResponse, 'arrangements');
      const payments = await readList<ApiPayment>(paymentResponse, 'payments');
      let summary: DashboardSummary | null = null;
      if (summaryResponse) {
        if (!summaryResponse.ok) throw new Error(await responseError(summaryResponse));
        const body = await summaryResponse.json() as { summary?: DashboardSummary };
        if (!body.summary) throw new Error('The server returned an invalid response.');
        summary = body.summary;
      }
      if (requestId !== maintenanceRequest.current) return;

      setDb((previous) => {
        const users = new Map(previous.users.map((user) => [user.id, user]));
        const learn = (id: string, name: string) => {
          if (!users.has(id)) users.set(id, partyUser(id, name));
        };
        arrangements.forEach((a) => {
          learn(a.payingUserId, a.payerName);
          learn(a.receivingUserId, a.receiverName);
        });
        payments.forEach((p) => {
          learn(p.payingUserId, p.payerName);
          learn(p.receivingUserId, p.receiverName);
        });
        return {
          ...previous,
          users: [...users.values()],
          arrangements,
          payments,
          evidence: payments.flatMap((p) => p.evidence),
        };
      });
      setDashboardSummary(summary);
    } catch (error) {
      if (requestId === maintenanceRequest.current) {
        setMaintenanceError(
          error instanceof Error ? error.message : 'Unable to load maintenance arrangements and payments.'
        );
      }
      throw error;
    } finally {
      if (requestId === maintenanceRequest.current) setMaintenanceLoading(false);
    }
  }, [currentUser]);

  // Family and maintenance data load in parallel; both merge into the same state safely.
  useEffect(() => {
    if (authLoading) return;
    if (currentUser) setMaintenanceLoading(true);
    void refreshFamilyData().catch(() => {
      // The error is already stored for the child list.
    });
    void refreshMaintenanceData().catch(() => {
      // The error is already stored for the maintenance data.
    });
  }, [authLoading, currentUser, refreshFamilyData, refreshMaintenanceData]);

  const commit = (updater: (prev: AppDatabaseState) => AppDatabaseState) => {
    setDb((prev) => {
      const next = updater(prev);
      saveDatabase(next);
      return next;
    });
  };

  const updateUserProfile: DataContextValue['updateUserProfile'] = (userId, updates) => {
    const now = new Date().toISOString();
    commit((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? { ...u, fullName: updates.fullName, phone: updates.phone, region: updates.region, updatedAt: now }
          : u
      ),
    }));
  };

  const addChild: DataContextValue['addChild'] = async (input) => {
    const response = await apiFetch('/parent/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        relationshipType: relationshipPayload(input.relationshipType),
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const body = await response.json() as { message?: string };
    if (response.status !== 201 || typeof body.message !== 'string') {
      throw new Error('The server returned an invalid child profile response.');
    }
    await refreshFamilyData();
  };

  const updateChild: DataContextValue['updateChild'] = async (childId, updates) => {
    const response = await apiFetch(`/parent/children/${encodeURIComponent(childId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error(await responseError(response));
    await refreshFamilyData();
  };

  const requestChildLink: DataContextValue['requestChildLink'] = async (southAfricanId, relationshipType) => {
    const response = await apiFetch('/parent/children/link-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        southAfricanId,
        relationshipType: relationshipPayload(relationshipType),
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
  };

  const respondToChildLinkRequest: DataContextValue['respondToChildLinkRequest'] = async (requestId, decision) => {
    const response = await apiFetch(`/parent/child-link-requests/${encodeURIComponent(requestId)}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    await refreshFamilyData();
  };

  const addArrangement: DataContextValue['addArrangement'] = async (input) => {
    await sendJson('/parent/arrangements', 'POST', {
      childId: input.childId,
      myRole: input.myRole,
      otherUserId: input.otherUserId,
      expectedAmount: input.expectedAmount,
      frequency: input.frequency.toUpperCase(),
      startDate: input.startDate,
      endDate: input.endDate || undefined,
      notes: input.notes?.trim() || undefined,
    });
    await refreshMaintenanceData();
  };

  const updateArrangement: DataContextValue['updateArrangement'] = async (arrangementId, updates) => {
    await sendJson(`/parent/arrangements/${encodeURIComponent(arrangementId)}`, 'PATCH', {
      expectedAmount: updates.expectedAmount,
      frequency: updates.frequency.toUpperCase(),
      startDate: updates.startDate,
      endDate: updates.endDate || undefined,
      status: updates.status.toUpperCase(),
      notes: updates.notes?.trim() || undefined,
    });
    await refreshMaintenanceData();
  };

  const recordPayment: DataContextValue['recordPayment'] = async (input) => {
    await sendJson('/parent/payments', 'POST', {
      arrangementId: input.arrangementId,
      amount: input.amount,
      paymentDate: input.paymentDate,
      paymentMethod: PAYMENT_METHOD_CODES[input.paymentMethod],
      paymentReference: input.paymentReference.trim(),
      evidence: input.evidenceFile,
    });
    await refreshMaintenanceData();
  };

  const confirmOrDisputePayment: DataContextValue['confirmOrDisputePayment'] = async (input) => {
    await sendJson(`/parent/payments/${encodeURIComponent(input.paymentId)}/confirmation`, 'POST', {
      action: input.action,
      confirmedAmount: input.action === 'CONFIRM_PARTIAL' ? input.confirmedAmount : undefined,
      note: input.note?.trim() || undefined,
    });
    await refreshMaintenanceData();
  };

  const addEvidenceToPayment: DataContextValue['addEvidenceToPayment'] = async ({ paymentId, ...evidence }) => {
    await sendJson(`/parent/payments/${encodeURIComponent(paymentId)}/evidence`, 'POST', evidence);
    await refreshMaintenanceData();
  };

  const upsertPaymentReview: DataContextValue['upsertPaymentReview'] = (input) => {
    const now = new Date().toISOString();
    const newReview: PaymentReview = {
      id: generateId('rev'),
      paymentId: input.paymentId,
      reviewedBy: input.reviewedBy,
      reviewStatus: input.reviewStatus,
      reviewNotes: input.reviewNotes.trim(),
      reviewedAt: now,
    };

    commit((prev) => {
      const existing = prev.reviews.find((r) => r.paymentId === input.paymentId);
      const updatedReviews = existing
        ? prev.reviews.map((r) => (r.paymentId === input.paymentId ? { ...newReview, id: r.id } : r))
        : [newReview, ...prev.reviews];

      const payment = prev.payments.find((p) => p.id === input.paymentId);
      const child = payment ? prev.children.find((c) => c.id === payment.childId) : undefined;
      const extraNotifs = [...prev.notifications];
      if (payment && input.reviewStatus === 'Additional Info Requested') {
        extraNotifs.unshift(
          {
            id: generateId('notif'),
            userId: payment.receivingUserId,
            title: 'Additional information requested',
            message: `Social worker requested additional information on payment ${payment.paymentReference} (${child?.firstName ?? ''}).`,
            isRead: false,
            createdAt: now,
            linkTo: '/parent/history',
          },
          {
            id: generateId('notif'),
            userId: payment.payingUserId,
            title: 'Additional information requested',
            message: `Social worker requested additional information on payment ${payment.paymentReference}.`,
            isRead: false,
            createdAt: now,
            linkTo: '/parent/history',
          }
        );
      }

      return {
        ...prev,
        reviews: updatedReviews,
        notifications: extraNotifs,
      };
    });

    return newReview;
  };

  const addProfessionalNote: DataContextValue['addProfessionalNote'] = (input) => {
    const now = new Date().toISOString();
    const noteObj: ProfessionalNote = {
      id: generateId('note'),
      socialWorkerId: input.socialWorkerId,
      childId: input.childId,
      note: input.note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    commit((prev) => ({
      ...prev,
      professionalNotes: [noteObj, ...prev.professionalNotes],
    }));
    return noteObj;
  };

  const updateConcernStatus: DataContextValue['updateConcernStatus'] = (concernId, status) => {
    const now = new Date().toISOString();
    commit((prev) => ({
      ...prev,
      concerns: prev.concerns.map((c) =>
        c.id === concernId ? { ...c, status, updatedAt: now } : c
      ),
    }));
  };

  const markNotificationRead: DataContextValue['markNotificationRead'] = (notificationId) => {
    commit((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
    }));
  };

  const markAllNotificationsRead: DataContextValue['markAllNotificationsRead'] = (userId) => {
    commit((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.userId === userId ? { ...n, isRead: true } : n
      ),
    }));
  };

  const resetDemoData = () => {
    const fresh = resetDatabaseStorage();
    setDb(fresh);
    void refreshFamilyData().catch(() => {}).then(() => refreshMaintenanceData()).catch(() => {});
  };

  return (
    <DataContext.Provider
      value={{
        db,
        childrenLoading,
        childrenError,
        maintenanceLoading,
        maintenanceError,
        dashboardSummary,
        pendingChildLinkRequests,
        refreshFamilyData,
        refreshMaintenanceData,
        refreshChildLinkRequests,
        updateUserProfile,
        addChild,
        updateChild,
        requestChildLink,
        respondToChildLinkRequest,
        addArrangement,
        updateArrangement,
        recordPayment,
        confirmOrDisputePayment,
        addEvidenceToPayment,
        upsertPaymentReview,
        addProfessionalNote,
        updateConcernStatus,
        markNotificationRead,
        markAllNotificationsRead,
        resetDemoData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used inside DataProvider');
  }
  return ctx;
}
