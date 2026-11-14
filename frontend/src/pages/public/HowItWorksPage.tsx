import { Link } from 'react-router-dom';

export function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Set up an arrangement',
      desc: 'Add a child, contribution amount, schedule and caregivers.',
    },
    {
      num: '02',
      title: 'Record a payment',
      desc: 'Enter the payment details and attach evidence.',
    },
    {
      num: '03',
      title: 'Confirm receipt',
      desc: 'The receiving caregiver confirms, partially confirms or disputes the payment.',
    },
    {
      num: '04',
      title: 'Review records',
      desc: 'Balances update from confirmed records. Assigned social workers can review payments and add notes.',
    },
  ];

  const statuses = [
    {
      name: 'Submitted',
      meaning: 'The paying parent recorded a payment.',
    },
    {
      name: 'Awaiting confirmation',
      meaning: 'Waiting for the recipient to confirm or dispute.',
    },
    {
      name: 'Confirmed by recipient',
      meaning: 'The recipient confirmed the full amount.',
    },
    {
      name: 'Partially confirmed',
      meaning: 'The recipient confirmed a smaller amount.',
    },
    {
      name: 'Disputed',
      meaning: 'The recipient reports the payment was not received or details are incorrect.',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[#0F2942]">How it works</h1>

      <div className="mt-8 space-y-4">
        {steps.map((step) => (
          <div key={step.num} className="border border-slate-200 bg-white p-5 rounded-sm">
            <div className="flex items-start gap-4">
              <span className="font-mono text-sm font-bold text-[#006847]">{step.num}</span>
              <div>
                <h2 className="font-display text-lg font-semibold text-[#0F2942]">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="font-display text-xl font-semibold text-[#0F2942]">
          Payment Status Definitions
        </h2>
        <div className="mt-4 overflow-x-auto border border-slate-200 rounded-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[#0F2942]">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-[#0F2942]">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {statuses.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-3 font-medium text-[#0F2942] whitespace-nowrap">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/login"
          className="rounded-sm bg-[#006847] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#005238]"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="rounded-sm border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
