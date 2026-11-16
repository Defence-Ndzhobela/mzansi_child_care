import { Link } from 'react-router-dom';
import { AdminArrangement } from '../../types/admin';
import { formatSADateShort, formatZAR } from '../../utils/format';
import { StatusPill } from './StatusPill';
import { TABLE_HEAD, TD, TH } from './ListFrame';

// Compact read-only arrangement table. "Assign" jumps to the assignment page with the child and
// arrangement already chosen.
export function ArrangementTable({ arrangements }: { arrangements: AdminArrangement[] }) {
  if (arrangements.length === 0) {
    return <p className="text-sm text-slate-600">No maintenance arrangements.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-sm border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className={TABLE_HEAD}>
          <tr>
            <th className={TH}>Child</th>
            <th className={TH}>Paying parent</th>
            <th className={TH}>Receiving parent</th>
            <th className={`${TH} text-right`}>Expected</th>
            <th className={TH}>Frequency</th>
            <th className={TH}>Period</th>
            <th className={TH}>Status</th>
            <th className={TH}>Social worker</th>
            <th className={`${TH} text-right`}> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {arrangements.map((arrangement) => (
            <tr key={arrangement.id}>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-[#0F2942]">{arrangement.childName}</td>
              <td className={`${TD} whitespace-nowrap`}>{arrangement.payingParent.fullName}</td>
              <td className={`${TD} whitespace-nowrap`}>{arrangement.receivingParent.fullName}</td>
              <td className={`${TD} text-right font-mono tabular-nums whitespace-nowrap`}>{formatZAR(arrangement.expectedAmount)}</td>
              <td className={TD}>{arrangement.frequency}</td>
              <td className={`${TD} whitespace-nowrap text-xs`}>
                {formatSADateShort(arrangement.startDate)} – {arrangement.endDate ? formatSADateShort(arrangement.endDate) : 'open'}
              </td>
              <td className="px-4 py-3"><StatusPill status={arrangement.status} /></td>
              <td className={`${TD} whitespace-nowrap`}>{arrangement.socialWorker?.fullName ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <Link
                  to={`/admin/assignments?childId=${arrangement.childId}&arrangementId=${arrangement.id}`}
                  className="text-xs font-medium text-[#006847] hover:underline"
                >
                  Assign
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
