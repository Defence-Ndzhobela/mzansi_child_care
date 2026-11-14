import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[#0F2942]">About</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">
        Mzansi ChildCare helps families keep child maintenance arrangements, payments and
        confirmations in one place.
      </p>

      <div className="mt-8 space-y-6 border-t border-slate-200 pt-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#0F2942]">Features</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>Manage child profiles and maintenance arrangements.</li>
            <li>Record payments, attach evidence and confirm or dispute entries.</li>
            <li>View and export payment reports.</li>
            <li>Review assigned cases and add social worker notes.</li>
          </ul>
        </div>

        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center rounded-sm bg-[#006847] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#005238]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
