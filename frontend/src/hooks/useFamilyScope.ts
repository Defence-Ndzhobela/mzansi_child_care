import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export const CURRENT_DEMO_MONTH = '2026-11';

export function useParentScope() {
  const { currentUser } = useAuth();
  const { db } = useData();

  return useMemo(() => {
    if (!currentUser) {
      return {
        children: [],
        arrangements: [],
        payments: [],
        concerns: [],
        expectedMonthly: 0,
        receivedCurrentMonth: 0,
        outstandingCurrentMonth: 0,
        latestPaymentDate: '',
        awaitingConfirmationCount: 0,
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
    const payments = db.payments
      .filter((p) => p.payingUserId === currentUser.id || p.receivingUserId === currentUser.id)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

    const concerns = db.concerns.filter((c) => accessibleChildIds.has(c.childId));

    const activeArrangements = arrangements.filter((a) => a.status === 'Active');
    const expectedMonthly = activeArrangements.reduce((sum, a) => {
      if (a.frequency === 'Weekly') return sum + a.expectedAmount * 4;
      if (a.frequency === 'Fortnightly') return sum + a.expectedAmount * 2;
      return sum + a.expectedAmount;
    }, 0);

    const currentMonthPayments = payments.filter((p) => p.paymentDate.startsWith(CURRENT_DEMO_MONTH));

    const receivedCurrentMonth = currentMonthPayments.reduce((sum, p) => {
      if (p.status === 'Confirmed by recipient') {
        return sum + (p.confirmedAmount ?? p.amount);
      }
      if (p.status === 'Partially confirmed') {
        return sum + (p.confirmedAmount ?? 0);
      }
      return sum;
    }, 0);

    const outstandingCurrentMonth = Math.max(0, expectedMonthly - receivedCurrentMonth);
    const latestPaymentDate = payments.length > 0 ? payments[0].paymentDate : '';
    const awaitingConfirmationCount = payments.filter(
      (p) =>
        p.receivingUserId === currentUser.id &&
        (p.status === 'Awaiting confirmation' || p.status === 'Submitted')
    ).length;

    return {
      children,
      arrangements,
      payments,
      concerns,
      expectedMonthly,
      receivedCurrentMonth,
      outstandingCurrentMonth,
      latestPaymentDate,
      awaitingConfirmationCount,
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
