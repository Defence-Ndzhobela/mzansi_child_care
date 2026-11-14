interface SummaryCardProps {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'default' | 'green' | 'amber' | 'navy';
}

export function SummaryCard({ label, value, helper, tone = 'default' }: SummaryCardProps) {
  const valueColor =
    tone === 'green'
      ? 'text-[#006847]'
      : tone === 'amber'
        ? 'text-[#9A6300]'
        : 'text-[#0F2942]';

  return (
    <div className="border border-slate-200 bg-white p-5 rounded-sm">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${valueColor}`}>
        {value}
      </p>
      {helper && <p className="mt-1.5 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}
