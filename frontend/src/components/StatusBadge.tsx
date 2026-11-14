import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  HelpCircle,
  Send,
} from 'lucide-react';
import { PaymentConcern, PaymentStatus, ReviewStatus } from '../types';

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'Confirmed by recipient':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-700/25 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Confirmed by recipient</span>
        </span>
      );
    case 'Partially confirmed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-amber-700/30 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Partially confirmed</span>
        </span>
      );
    case 'Disputed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-red-700/30 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Disputed</span>
        </span>
      );
    case 'Awaiting confirmation':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-sky-700/25 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Awaiting confirmation</span>
        </span>
      );
    case 'Submitted':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Submitted</span>
        </span>
      );
  }
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  switch (status) {
    case 'Reviewed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-700/25 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
          <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Reviewed</span>
        </span>
      );
    case 'Additional Info Requested':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-amber-700/30 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 whitespace-nowrap">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Additional Info Requested</span>
        </span>
      );
    case 'Concern Noted':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-red-700/30 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Concern Noted</span>
        </span>
      );
    case 'Pending Review':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Pending Review</span>
        </span>
      );
  }
}

export function ConcernStatusBadge({ status }: { status: PaymentConcern['status'] }) {
  switch (status) {
    case 'Resolved':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-700/25 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Resolved</span>
        </span>
      );
    case 'Info Requested':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-amber-700/30 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 whitespace-nowrap">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Info Requested</span>
        </span>
      );
    case 'Under Review':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-sky-700/25 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Under Review</span>
        </span>
      );
    case 'Open':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-red-700/30 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Open</span>
        </span>
      );
  }
}
