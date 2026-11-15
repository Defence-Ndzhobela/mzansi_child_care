export type UserRole = 'PARENT_CAREGIVER' | 'SOCIAL_WORKER';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  accountStatus: AccountStatus;
  region?: string;
  registrationNumber?: string; // For social worker demo reference
  createdAt: string;
  updatedAt: string;
}

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RelationshipType =
  | 'Mother'
  | 'Father'
  | 'Primary Caregiver'
  | 'Paying Parent'
  | 'Legal Guardian'
  | 'Extended Family Caregiver';

export interface FamilyRelationship {
  id: string;
  childId: string;
  userId: string;
  fullName?: string;
  email?: string;
  relationshipType: RelationshipType;
  isPrimaryCaregiver: boolean;
  createdAt: string;
}

export interface ChildLinkRequest {
  id: string;
  childId: string;
  childName: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  relationshipType: RelationshipType;
  requestedAt: string;
}

export type ArrangementFrequency = 'Monthly' | 'Fortnightly' | 'Weekly';
export type ArrangementStatus = 'Active' | 'Paused' | 'Completed';

export interface MaintenanceArrangement {
  id: string;
  childId: string;
  payingUserId: string;
  receivingUserId: string;
  expectedAmount: number;
  currency: 'ZAR';
  frequency: ArrangementFrequency;
  startDate: string;
  endDate?: string;
  status: ArrangementStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod =
  | 'EFT Bank Transfer'
  | 'eWallet / Instant Money'
  | 'Cash with Receipt'
  | 'Retail Money Transfer'
  | 'Other';

export type PaymentStatus =
  | 'Submitted'
  | 'Awaiting confirmation'
  | 'Confirmed by recipient'
  | 'Partially confirmed'
  | 'Disputed';

export interface Payment {
  id: string;
  arrangementId: string;
  childId: string;
  payingUserId: string;
  receivingUserId: string;
  amount: number;
  confirmedAmount?: number;
  currency: 'ZAR';
  paymentDate: string; // ISO YYYY-MM-DD
  paymentMethod: PaymentMethod;
  paymentReference: string;
  status: PaymentStatus;
  disputeReason?: string;
  recipientNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvidence {
  id: string;
  paymentId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  fileSizeLabel: string;
  fileUrl: string; // Simulated local data URL or demo path
  description: string;
  uploadedAt: string;
}

export type AssignmentStatus = 'ACTIVE' | 'CLOSED';

export interface SocialWorkerAssignment {
  id: string;
  socialWorkerId: string;
  childId: string;
  assignedBy: string;
  assignmentStatus: AssignmentStatus;
  assignedAt: string;
}

export type ReviewStatus =
  | 'Pending Review'
  | 'Reviewed'
  | 'Additional Info Requested'
  | 'Concern Noted';

export interface PaymentReview {
  id: string;
  paymentId: string;
  reviewedBy: string;
  reviewStatus: ReviewStatus;
  reviewNotes: string;
  reviewedAt: string;
}

export interface ProfessionalNote {
  id: string;
  socialWorkerId: string;
  childId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentConcern {
  id: string;
  paymentId: string;
  childId: string;
  reportedBy: string;
  category: 'Short Payment' | 'Not Received' | 'Missing Evidence' | 'Irregular Schedule' | 'Other';
  description: string;
  status: 'Open' | 'Under Review' | 'Info Requested' | 'Resolved';
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  linkTo?: string;
}

export interface AppDatabaseState {
  users: User[];
  children: Child[];
  familyRelationships: FamilyRelationship[];
  arrangements: MaintenanceArrangement[];
  payments: Payment[];
  evidence: PaymentEvidence[];
  assignments: SocialWorkerAssignment[];
  reviews: PaymentReview[];
  professionalNotes: ProfessionalNote[];
  concerns: PaymentConcern[];
  notifications: AppNotification[];
}
