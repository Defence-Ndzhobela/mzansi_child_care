import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MaintenanceArrangement, MaintenanceRole, Payment } from '../types';

// Responsibilities are per arrangement: the same account can pay for one child and receive for another.
export function roleInArrangement(
  arrangement: Pick<MaintenanceArrangement, 'payingUserId' | 'receivingUserId'>,
  userId: string
): MaintenanceRole | null {
  if (arrangement.payingUserId === userId) return 'PAYING';
  if (arrangement.receivingUserId === userId) return 'RECEIVING';
  return null;
}

export function isAwaitingMyConfirmation(payment: Payment, userId: string): boolean {
  return (
    payment.receivingUserId === userId &&
    (payment.status === 'Awaiting confirmation' || payment.status === 'Submitted')
  );
}

export function useParentScope() {
  const { currentUser } = useAuth();
  const { db } = useData();

  return useMemo(() => {
    if (!currentUser) {
      return {
        children: [],
        arrangements: [],
        payingArrangements: [],
        receivingArrangements: [],
        payments: [],
        concerns: [],
        awaitingMyConfirmation: [],
        isPayer: false,
        isReceiver: false,
      };
    }

    const relChildIds = new Set(
      db.familyRelationships.filter((r) => r.userId === currentUser.id).map((r) => r.childId)
    );
    const arrChildIds = new Set(
      db.arrangements
        .filter((a) => a.payingUserId === currentUser.id || a.receivingUserId === currentUser.id)
        .map((a) => a.childId)
    );

    const accessibleChildIds = new Set([...relChildIds, ...arrChildIds]);

    const children = db.children.filter((c) => accessibleChildIds.has(c.id));
    const arrangements = db.arrangements.filter(
      (a) => a.payingUserId === currentUser.id || a.receivingUserId === currentUser.id
    );
    const payingArrangements = arrangements.filter((a) => a.payingUserId === currentUser.id);
    const receivingArrangements = arrangements.filter((a) => a.receivingUserId === currentUser.id);
    const payments = db.payments
      .filter((p) => p.payingUserId === currentUser.id || p.receivingUserId === currentUser.id)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

    const concerns = db.concerns.filter((c) => accessibleChildIds.has(c.childId));
    const awaitingMyConfirmation = payments.filter((p) => isAwaitingMyConfirmation(p, currentUser.id));

    return {
      children,
      arrangements,
      payingArrangements,
      receivingArrangements,
      payments,
      concerns,
      awaitingMyConfirmation,
      isPayer: payingArrangements.length > 0,
      isReceiver: receivingArrangements.length > 0,
    };
  }, [currentUser, db]);
}

export function useSocialWorkerScope() {
  const { currentUser } = useAuth();
  const { db } = useData();

  return useMemo(() => {
    if (!currentUser || currentUser.role !== 'SOCIAL_WORKER') {
      return {
        assignedChildIds: new Set<string>(),
        children: [],
        arrangements: [],
        payments: [],
        concerns: [],
        reviews: [],
        notes: [],
        awaitingReviewCount: 0,
        openConcernsCount: 0,
        recentlyUpdatedCount: 0,
      };
    }

    const assignedChildIds = new Set(
      db.assignments
        .filter((a) => a.socialWorkerId === currentUser.id && a.assignmentStatus === 'ACTIVE')
        .map((a) => a.childId)
    );

    const children = db.children.filter((c) => assignedChildIds.has(c.id));
    const arrangements = db.arrangements.filter((a) => assignedChildIds.has(a.childId));
    const payments = db.payments
      .filter((p) => assignedChildIds.has(p.childId))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

    const paymentIdSet = new Set(payments.map((p) => p.id));
    const reviews = db.reviews.filter((r) => paymentIdSet.has(r.paymentId));
    const concerns = db.concerns.filter((c) => assignedChildIds.has(c.childId));
    const notes = db.professionalNotes
      .filter((n) => assignedChildIds.has(n.childId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const awaitingReviewCount = payments.filter((p) => {
      const rev = reviews.find((r) => r.paymentId === p.id);
      return !rev || rev.reviewStatus === 'Pending Review' || rev.reviewStatus === 'Additional Info Requested';
    }).length;

    const openConcernsCount = concerns.filter((c) => c.status !== 'Resolved').length;
    const recentlyUpdatedCount = payments.filter((p) => p.updatedAt.startsWith('2026-11')).length;

    return {
      assignedChildIds,
      children,
      arrangements,
      payments,
      concerns,
      reviews,
      notes,
      awaitingReviewCount,
      openConcernsCount,
      recentlyUpdatedCount,
    };
  }, [currentUser, db]);
}
