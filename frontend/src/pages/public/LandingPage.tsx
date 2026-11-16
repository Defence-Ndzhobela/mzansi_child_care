import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardPathFor } from '../../utils/roles';

export function LandingPage() {
  const { currentUser } = useAuth();
  const dashboardPath = dashboardPathFor(currentUser?.role);

  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#006847]">
                Child maintenance records
              </p>
              <h1
                className="mt-3 font-display text-3xl font-bold tracking-tight text-[#0F2942] sm:text-4xl lg:text-[42px] lg:leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                Keep Child Maintenance Records in One Place
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700">
                Record contributions, confirm payments and keep a shared payment history.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {currentUser ? (
                  <Link
                    to={dashboardPath}
                    className="inline-flex items-center gap-2 rounded-sm bg-[#006847] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005238] transition-colors whitespace-nowrap"
                  >
                    <span>Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 rounded-sm bg-[#006847] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005238] transition-colors whitespace-nowrap"
                    >
                      <span>Sign in</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/register"
                      className="inline-flex items-center rounded-sm border border-[#0F2942] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F2942] hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      Create account
                    </Link>
                  </>
                )}
              </div>

            </div>

            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="border border-slate-200 bg-slate-50 p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-sm font-semibold text-[#0F2942]">
                    Sample payment record
                  </span>
                  <span className="text-xs font-mono text-slate-500">November 2026</span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Child</dt>
                    <dd className="font-medium text-[#0F2942]">Thabo Mokoena</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Expected monthly</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#0F2942]">
                      R 1,500.00
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Confirmed</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#006847]">
                      R 1,000.00
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <dt className="font-medium text-slate-800">Outstanding</dt>
                    <dd className="font-mono font-bold tabular-nums text-[#9A6300]">
                      R 500.00
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-[#0F2942]">
              Keep records clear
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Keep arrangements, payment evidence and confirmations together.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="border border-slate-200 bg-white p-6 rounded-sm">
              <p className="text-xs font-mono font-semibold text-[#006847]">01</p>
              <h3 className="mt-2 font-display text-base font-semibold text-[#0F2942]">
                Record Arrangements
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Add child profiles and expected contribution amounts.
              </p>
            </div>

            <div className="border border-slate-200 bg-white p-6 rounded-sm">
              <p className="text-xs font-mono font-semibold text-[#006847]">02</p>
              <h3 className="mt-2 font-display text-base font-semibold text-[#0F2942]">
                Submit &amp; Confirm Payments
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Record payments with evidence. Recipients can confirm, partially confirm or dispute.
              </p>
            </div>

            <div className="border border-slate-200 bg-white p-6 rounded-sm">
              <p className="text-xs font-mono font-semibold text-[#006847]">03</p>
              <h3 className="mt-2 font-display text-base font-semibold text-[#0F2942]">
                Review &amp; Export Summaries
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Export reports and let assigned social workers review records and concerns.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
