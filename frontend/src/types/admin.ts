export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  socialWorkerId?: string;
  childId?: string;
}

export interface AdminStats {
  totalUsers: number;
  socialWorkers: number;
  activeSocialWorkers: number;
  childSupporters: number;
  children: number;
  activeAssignments: number;
  activeArrangements: number;
  pendingPayments: number;
  completedPayments: number;
  disputedPayments: number;
  childrenWithoutWorker: number;
}

export type WorkerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AdminSocialWorker {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  registrationNumber: string | null;
  accountStatus: WorkerStatus;
  assignedChildren: number;
  createdAt: string;
}

export interface AdminSocialWorkerDetail extends AdminSocialWorker {
  totalAssignments: number;
  professionalNotes: number;
  paymentReviews: number;
  activeAssignments: {
    assignmentId: string;
    childId: string;
    childName: string;
    arrangementId: string | null;
    assignedAt: string;
  }[];
}

export interface SocialWorkerInput {
  fullName: string;
  email: string;
  phone: string;
  registrationNumber: string;
  accountStatus: 'ACTIVE' | 'INACTIVE';
  password?: string;
}

export interface PersonRef {
  id: string;
  fullName: string;
}

export interface AdminArrangement {
  id: string;
  childId: string;
  childName: string;
  payingParent: PersonRef;
  receivingParent: PersonRef;
  expectedAmount: number;
  currency: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  socialWorker: PersonRef | null;
  assignedThisArrangement: boolean;
  createdAt: string;
}

export interface AdminArrangementDetail extends AdminArrangement {
  assignmentId: string | null;
  paymentSummary: { status: string; payments: number; totalAmount: number }[];
}

export type AssignmentStatus = 'ACTIVE' | 'CLOSED' | 'TRANSFERRED';

export interface AdminAssignment {
  id: string;
  status: AssignmentStatus;
  assignedAt: string;
  endedAt: string | null;
  socialWorker: PersonRef;
  child: PersonRef;
  arrangement: {
    id: string;
    payingParent: string;
    receivingParent: string;
    expectedAmount: number;
    frequency: string;
    status: string;
  } | null;
  assignedBy: { id: string; fullName: string; role: string };
  endedBy: string | null;
}

export interface AdminChildSupporter {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  accountStatus: string;
  children: number;
  arrangements: number;
  monthlyExpectedAmount: number;
  createdAt: string;
}

export interface AdminChildSupporterDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  accountStatus: string;
  createdAt: string;
  children: { id: string; fullName: string; dateOfBirth: string; relationship: string; socialWorker: string | null }[];
  arrangements: AdminArrangement[];
}

export interface AdminChild {
  id: string;
  fullName: string;
  dateOfBirth: string;
  parents: number;
  arrangements: number;
  socialWorker: PersonRef | null;
  createdAt: string;
}

export interface AdminChildDetail {
  id: string;
  fullName: string;
  dateOfBirth: string;
  createdAt: string;
  parents: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    relationship: string;
    isPrimaryCaregiver: boolean;
  }[];
  arrangements: AdminArrangement[];
  currentAssignment: AdminAssignment | null;
  assignmentHistory: AdminAssignment[];
}

export interface AdminReport {
  caseload: { id: string; fullName: string; accountStatus: string; activeCases: number; totalCases: number }[];
  arrangementsByStatus: { status: string; arrangements: number }[];
  paymentsByStatus: { status: string; payments: number; totalAmount: number }[];
  unassignedChildren: { id: string; fullName: string; createdAt: string }[];
}
