import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AppDatabaseState,
  ArrangementFrequency,
  ArrangementStatus,
  Child,
  ChildLinkRequest,
  FamilyRelationship,
  MaintenanceArrangement,
  Payment,
  PaymentConcern,
  PaymentEvidence,
  PaymentMethod,
  PaymentReview,
  ProfessionalNote,
  RelationshipType,
  ReviewStatus,
} from '../types';
import { DEMO_USER_DB_IDS, loadDatabase, resetDatabaseStorage, saveDatabase } from '../services/storageService';
import { generateId } from '../utils/format';
import { useAuth } from './AuthContext';

interface DataContextValue {
  db: AppDatabaseState;
  childrenLoading: boolean;
  childrenError: string | null;
  pendingChildLinkRequests: ChildLinkRequest[];
  refreshFamilyData: () => Promise<void>;
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
  addArrangement: (input: {
    childId: string;
    payingUserId: string;
    receivingUserId: string;
    expectedAmount: number;
    frequency: ArrangementFrequency;
    startDate: string;
    endDate?: string;
    status: ArrangementStatus;
    notes?: string;
  }) => MaintenanceArrangement;
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
  ) => void;
  recordPayment: (input: {
    arrangementId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    paymentReference: string;
    recordedByUserId: string;
    evidenceFile?: {
      fileName: string;
      fileType: string;
      fileSizeLabel: string;
      fileUrl: string;
      description: string;
    };
  }) => Payment;
  confirmOrDisputePayment: (input: {
    paymentId: string;
    action: 'CONFIRM_FULL' | 'CONFIRM_PARTIAL' | 'DISPUTE';
    confirmedAmount?: number;
    note?: string;
    actorUserId: string;
  }) => void;
  addEvidenceToPayment: (input: {
    paymentId: string;
    uploadedBy: string;
    fileName: string;
    fileType: string;
    fileSizeLabel: string;
    fileUrl: string;
    description: string;
  }) => PaymentEvidence;
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading: authLoading } = useAuth();
  const [db, setDb] = useState<AppDatabaseState>(() => loadDatabase());
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [pendingChildLinkRequests, setPendingChildLinkRequests] = useState<ChildLinkRequest[]>([]);

  const refreshChildLinkRequests = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'PARENT_CAREGIVER') {
      setPendingChildLinkRequests([]);
      return;
    }
    const response = await fetch('/api/parent/child-link-requests', {
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(await responseError(response));
    const body = await response.json() as { requests?: ChildLinkRequest[] };
    if (!Array.isArray(body.requests)) throw new Error('Invalid child-link request response.');
    setPendingChildLinkRequests(body.requests);
  }, [currentUser]);

  const refreshFamilyData = useCallback(async () => {
    if (!currentUser) {
      setDb((previous) => ({ ...previous, children: [], familyRelationships: [] }));
      setPendingChildLinkRequests([]);
      setChildrenLoading(false);
      setChildrenError(null);
      return;
    }

    setChildrenLoading(true);
    setChildrenError(null);
    try {
      const endpoint = currentUser.role === 'SOCIAL_WORKER'
        ? '/api/social-worker/children'
        : '/api/parent/children';
      const response = await fetch(endpoint, { credentials: 'same-origin' });
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
        const users = new Map(previous.users
          .filter((user) => DEMO_USER_DB_IDS.has(user.id))
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

  useEffect(() => {
    if (authLoading) return;
    void refreshFamilyData().catch(() => {});
  }, [authLoading, refreshFamilyData]);

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
    const response = await fetch('/api/parent/children', {
      method: 'POST',
      credentials: 'same-origin',
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
    const response = await fetch(`/api/parent/children/${encodeURIComponent(childId)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error(await responseError(response));
    await refreshFamilyData();
  };

  const requestChildLink: DataContextValue['requestChildLink'] = async (southAfricanId, relationshipType) => {
    const response = await fetch('/api/parent/children/link-requests', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        southAfricanId,
        relationshipType: relationshipPayload(relationshipType),
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
  };

  const respondToChildLinkRequest: DataContextValue['respondToChildLinkRequest'] = async (requestId, decision) => {
    const response = await fetch(`/api/parent/child-link-requests/${encodeURIComponent(requestId)}/respond`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    await refreshFamilyData();
  };

  const addArrangement: DataContextValue['addArrangement'] = (input) => {
    const now = new Date().toISOString();
    const arr: MaintenanceArrangement = {
      id: generateId('arr'),
      childId: input.childId,
      payingUserId: input.payingUserId,
      receivingUserId: input.receivingUserId,
      expectedAmount: input.expectedAmount,
      currency: 'ZAR',
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate || undefined,
      status: input.status,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    commit((prev) => {
      return {
        ...prev,
        arrangements: [arr, ...prev.arrangements],
      };
    });

    return arr;
  };

  const updateArrangement: DataContextValue['updateArrangement'] = (arrangementId, updates) => {
    const now = new Date().toISOString();
    commit((prev) => ({
      ...prev,
      arrangements: prev.arrangements.map((a) =>
        a.id === arrangementId
          ? {
              ...a,
              expectedAmount: updates.expectedAmount,
              frequency: updates.frequency,
              startDate: updates.startDate,
              endDate: updates.endDate || undefined,
              status: updates.status,
              notes: updates.notes?.trim() || undefined,
              updatedAt: now,
            }
          : a
      ),
    }));
  };

  const recordPayment: DataContextValue['recordPayment'] = (input) => {
    const now = new Date().toISOString();
    const arrangement = db.arrangements.find((a) => a.id === input.arrangementId);
    if (!arrangement) {
      throw new Error('Selected maintenance arrangement was not found.');
    }

    const child = db.children.find((c) => c.id === arrangement.childId);
    const payer = db.users.find((u) => u.id === arrangement.payingUserId);

    const newPayment: Payment = {
      id: generateId('pay'),
      arrangementId: arrangement.id,
      childId: arrangement.childId,
      payingUserId: arrangement.payingUserId,
      receivingUserId: arrangement.receivingUserId,
      amount: input.amount,
      currency: 'ZAR',
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference.trim() || `REF-${Date.now().toString().slice(-6)}`,
      status: 'Awaiting confirmation',
      createdAt: now,
      updatedAt: now,
    };

    const newEvidence: PaymentEvidence | null = input.evidenceFile
      ? {
          id: generateId('ev'),
          paymentId: newPayment.id,
          uploadedBy: input.recordedByUserId,
          fileName: input.evidenceFile.fileName,
          fileType: input.evidenceFile.fileType,
          fileSizeLabel: input.evidenceFile.fileSizeLabel,
          fileUrl: input.evidenceFile.fileUrl,
          description: input.evidenceFile.description,
          uploadedAt: now,
        }
      : null;

    const assignedWorker = db.assignments.find(
      (a) => a.childId === arrangement.childId && a.assignmentStatus === 'ACTIVE'
    );

    const newReview: PaymentReview | null = assignedWorker
      ? {
          id: generateId('rev'),
          paymentId: newPayment.id,
          reviewedBy: assignedWorker.socialWorkerId,
          reviewStatus: 'Pending Review',
          reviewNotes: 'Newly recorded payment awaiting recipient confirmation and case review.',
          reviewedAt: now,
        }
      : null;

    const newNotifications = [
      {
        id: generateId('notif'),
        userId: arrangement.receivingUserId,
        title: 'New payment awaiting confirmation',
        message: `${payer?.fullName ?? 'Paying parent'} recorded R ${input.amount.toFixed(2)} for ${
          child ? `${child.firstName} ${child.lastName}` : 'child'
        }.`,
        isRead: false,
        createdAt: now,
        linkTo: '/parent/payments',
      },
    ];

    commit((prev) => ({
      ...prev,
      payments: [newPayment, ...prev.payments],
      evidence: newEvidence ? [newEvidence, ...prev.evidence] : prev.evidence,
      reviews: newReview ? [newReview, ...prev.reviews] : prev.reviews,
      notifications: [...newNotifications, ...prev.notifications],
    }));

    return newPayment;
  };

  const confirmOrDisputePayment: DataContextValue['confirmOrDisputePayment'] = (input) => {
    const now = new Date().toISOString();
    commit((prev) => {
      const target = prev.payments.find((p) => p.id === input.paymentId);
      if (!target) return prev;

      const child = prev.children.find((c) => c.id === target.childId);
      const childName = child ? `${child.firstName} ${child.lastName}` : 'Child';

      let updatedPayment: Payment = { ...target, updatedAt: now };
      const extraConcerns = [...prev.concerns];
      const extraNotifications = [...prev.notifications];

      if (input.action === 'CONFIRM_FULL') {
        updatedPayment = {
          ...updatedPayment,
          status: 'Confirmed by recipient',
          confirmedAmount: target.amount,
          recipientNote: input.note?.trim() || 'Full amount confirmed as received by recipient.',
          disputeReason: undefined,
        };
      } else if (input.action === 'CONFIRM_PARTIAL') {
        const partial = Math.max(0, Math.min(target.amount, input.confirmedAmount ?? 0));
        updatedPayment = {
          ...updatedPayment,
          status: 'Partially confirmed',
          confirmedAmount: partial,
          recipientNote:
            input.note?.trim() ||
            `Partially confirmed R ${partial.toFixed(2)} out of R ${target.amount.toFixed(2)}.`,
          disputeReason: undefined,
        };
        extraConcerns.unshift({
          id: generateId('conc'),
          paymentId: target.id,
          childId: target.childId,
          reportedBy: input.actorUserId,
          category: 'Short Payment',
          description:
            input.note?.trim() ||
            `Confirmed R ${partial.toFixed(2)} of R ${target.amount.toFixed(2)} recorded for ${childName}.`,
          status: 'Open',
          createdAt: now,
          updatedAt: now,
        });
      } else {
        updatedPayment = {
          ...updatedPayment,
          status: 'Disputed',
          confirmedAmount: input.confirmedAmount ?? 0,
          disputeReason: input.note?.trim() || 'Payment disputed by receiving caregiver.',
        };
        extraConcerns.unshift({
          id: generateId('conc'),
          paymentId: target.id,
          childId: target.childId,
          reportedBy: input.actorUserId,
          category: 'Not Received',
          description: input.note?.trim() || `Receiving parent disputed payment for ${childName}.`,
          status: 'Open',
          createdAt: now,
          updatedAt: now,
        });
      }

      extraNotifications.unshift({
        id: generateId('notif'),
        userId: target.payingUserId,
        title: `Payment ${updatedPayment.status.toLowerCase()}`,
        message: `Recipient updated payment ${target.paymentReference} for ${childName} to "${updatedPayment.status}".`,
        isRead: false,
        createdAt: now,
        linkTo: '/parent/history',
      });

      const assignedWorkers = prev.assignments.filter(
        (a) => a.childId === target.childId && a.assignmentStatus === 'ACTIVE'
      );
      assignedWorkers.forEach((w) => {
        if (input.action !== 'CONFIRM_FULL') {
          extraNotifications.unshift({
            id: generateId('notif'),
            userId: w.socialWorkerId,
            title: `Payment concern for ${childName}`,
            message: `Payment ${target.paymentReference} marked "${updatedPayment.status}" and requires review.`,
            isRead: false,
            createdAt: now,
            linkTo: '/social-worker/concerns',
          });
        }
      });

      return {
        ...prev,
        payments: prev.payments.map((p) => (p.id === target.id ? updatedPayment : p)),
        concerns: extraConcerns,
        notifications: extraNotifications,
      };
    });
  };

  const addEvidenceToPayment: DataContextValue['addEvidenceToPayment'] = (input) => {
    const now = new Date().toISOString();
    const item: PaymentEvidence = {
      id: generateId('ev'),
      paymentId: input.paymentId,
      uploadedBy: input.uploadedBy,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSizeLabel: input.fileSizeLabel,
      fileUrl: input.fileUrl,
      description: input.description,
      uploadedAt: now,
    };
    commit((prev) => ({
      ...prev,
      evidence: [item, ...prev.evidence],
    }));
    return item;
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
    void refreshFamilyData().catch(() => {});
  };

  return (
    <DataContext.Provider
      value={{
        db,
        childrenLoading,
        childrenError,
        pendingChildLinkRequests,
        refreshFamilyData,
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
