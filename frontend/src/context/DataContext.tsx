import React, { createContext, useContext, useState } from 'react';
import {
  AppDatabaseState,
  ArrangementFrequency,
  ArrangementStatus,
  Child,
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
import { loadDatabase, resetDatabaseStorage, saveDatabase } from '../services/storageService';
import { generateId } from '../utils/format';

interface DataContextValue {
  db: AppDatabaseState;
  updateUserProfile: (
    userId: string,
    updates: { fullName: string; phone: string; region?: string }
  ) => void;
  addChild: (input: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    createdBy: string;
    relationshipType: RelationshipType;
    isPrimaryCaregiver: boolean;
    coParentUserId?: string;
    coParentRelationship?: RelationshipType;
  }) => Child;
  updateChild: (
    childId: string,
    updates: { firstName: string; lastName: string; dateOfBirth: string }
  ) => void;
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<AppDatabaseState>(() => loadDatabase());

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

  const addChild: DataContextValue['addChild'] = (input) => {
    const now = new Date().toISOString();
    const newChild: Child = {
      id: generateId('child'),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const newRelationships = [
      {
        id: generateId('rel'),
        childId: newChild.id,
        userId: input.createdBy,
        relationshipType: input.relationshipType,
        isPrimaryCaregiver: input.isPrimaryCaregiver,
        createdAt: now,
      },
    ];

    if (input.coParentUserId && input.coParentUserId !== input.createdBy) {
      newRelationships.push({
        id: generateId('rel'),
        childId: newChild.id,
        userId: input.coParentUserId,
        relationshipType: input.coParentRelationship ?? 'Father',
        isPrimaryCaregiver: !input.isPrimaryCaregiver,
        createdAt: now,
      });
    }

    commit((prev) => ({
      ...prev,
      children: [...prev.children, newChild],
      familyRelationships: [...prev.familyRelationships, ...newRelationships],
    }));
    return newChild;
  };

  const updateChild: DataContextValue['updateChild'] = (childId, updates) => {
    const now = new Date().toISOString();
    commit((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === childId
          ? {
              ...c,
              firstName: updates.firstName.trim(),
              lastName: updates.lastName.trim(),
              dateOfBirth: updates.dateOfBirth,
              updatedAt: now,
            }
          : c
      ),
    }));
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
      // Ensure both parties have a relationship link to the child so both dashboards can see it
      const existingPayingRel = prev.familyRelationships.some(
        (r) => r.childId === input.childId && r.userId === input.payingUserId
      );
      const existingRecRel = prev.familyRelationships.some(
        (r) => r.childId === input.childId && r.userId === input.receivingUserId
      );
      const extraRels = [...prev.familyRelationships];
      if (!existingPayingRel) {
        extraRels.push({
          id: generateId('rel'),
          childId: input.childId,
          userId: input.payingUserId,
          relationshipType: 'Paying Parent',
          isPrimaryCaregiver: false,
          createdAt: now,
        });
      }
      if (!existingRecRel) {
        extraRels.push({
          id: generateId('rel'),
          childId: input.childId,
          userId: input.receivingUserId,
          relationshipType: 'Primary Caregiver',
          isPrimaryCaregiver: true,
          createdAt: now,
        });
      }

      return {
        ...prev,
        arrangements: [arr, ...prev.arrangements],
        familyRelationships: extraRels,
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
  };

  return (
    <DataContext.Provider
      value={{
        db,
        updateUserProfile,
        addChild,
        updateChild,
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
