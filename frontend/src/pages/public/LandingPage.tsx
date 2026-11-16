import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck, Users } from 'lucide-react';
import { PhotoFrame } from '../../components/PhotoFrame';
import { IMAGES } from '../../config/images';
import { useAuth } from '../../context/AuthContext';
import { dashboardPathFor } from '../../utils/roles';

const primaryButton =
  'inline-flex items-center gap-2 rounded-sm bg-[#006847] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#005238] transition-colors whitespace-nowrap';
const secondaryButton =
  'inline-flex items-center rounded-sm border border-[#0F2942] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F2942] hover:bg-slate-50 transition-colors whitespace-nowrap';
const textLink =
  'inline-flex items-center gap-1.5 text-sm font-semibold text-[#006847] hover:underline underline-offset-4';

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Private and secure records' },
  { icon: Users, label: 'Families, caregivers and social workers' },
  { icon: HeartHandshake, label: 'Open to every community' },
];

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#006847]" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LandingPage() {
  const { currentUser } = useAuth();
  const dashboardPath = dashboardPathFor(currentUser?.role);

  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#006847]">
                Mzansi ChildCare · For every South African family
              </p>
              <h1
                className="mt-3 font-display text-3xl font-bold tracking-tight text-[#0F2942] sm:text-4xl lg:text-[42px] lg:leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                Every Child Deserves Care, Protection and Support.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-700">
                Connecting families, caregivers and social workers to build a safer and brighter future for every
                child in South Africa.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {currentUser ? (
                  <Link to={dashboardPath} className={primaryButton}>
                    <span>Open your dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className={primaryButton}>
                      <span>Create your account</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link to="/login" className={secondaryButton}>
                      Sign in
                    </Link>
                  </>
                )}
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
                {TRUST_POINTS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-[#006847]" aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-6">
              <PhotoFrame
                image={IMAGES.childrenPlaying}
                priority
                position="center 35%"
                className="aspect-[16/10] w-full"
                caption="Every child. Every community."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0F2942]">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
            One platform for every South African community
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
            Mzansi ChildCare serves families of every background: Black, Coloured, Indian and White families, and all
            other communities across South Africa. Every child has the same right to care, protection and support,
            wherever they live and whatever language their family speaks.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <PhotoFrame image={IMAGES.familySupport} position="center 30%" className="aspect-[3/2] w-full" />
          </div>
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#006847]">About Mzansi ChildCare</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[#0F2942]">
              Supporting families, protecting children
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Mzansi ChildCare brings parents, caregivers and social workers together around the child. Arrangements,
              payments and confirmations are recorded in one shared place, so everyone can see what has been agreed
              and what has been received.
            </p>
            <Checklist
              items={[
                'Clear maintenance arrangements for each child',
                'Payments confirmed by the receiving caregiver',
                'Records that assigned social workers can review',
              ]}
            />
            <Link to="/about" className={`${textLink} mt-6`}>
              <span>Learn more about us</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12">
          <div className="order-2 lg:order-1 lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#006847]">Community support</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[#0F2942]">
              Social workers who walk alongside families
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Each child&apos;s case is assigned to a social worker. They can review payment records, follow up on
              concerns and add professional notes, so families receive guidance when they need it and not only when
              something goes wrong.
            </p>
            <Checklist
              items={[
                'A named social worker for every assigned child',
                'Concerns raised early and followed up',
                'Professional notes kept with the case',
              ]}
            />
            <Link to="/how-it-works" className={`${textLink} mt-6`}>
              <span>See how it works</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="order-1 lg:order-2 lg:col-span-6">
            <PhotoFrame
              image={IMAGES.socialWorkerHelpingMother}
              position="center 35%"
              className="aspect-[3/2] w-full"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <PhotoFrame image={IMAGES.diverseKids} className="aspect-[4/3] w-full" />
          </div>
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#006847]">Children come first</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[#0F2942]">
              Equal opportunities for every child
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700">
              Records exist for one reason: children. Reliable, transparent maintenance records help make sure that
              every child, from every background and every part of the country, has what they need to learn, play and
              grow.
            </p>
            <Link to="/register" className={`${textLink} mt-6`}>
              <span>Register your family</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="font-display text-2xl font-bold text-[#0F2942]">Keep records clear</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Keep arrangements, payment evidence and confirmations together.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-sm font-semibold text-[#0F2942]">Sample payment record</span>
                  <span className="text-xs font-mono text-slate-500">November 2026</span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Child</dt>
                    <dd className="font-medium text-[#0F2942]">Thabo Mokoena</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Expected monthly</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#0F2942]">R 1,500.00</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Confirmed</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#006847]">R 1,000.00</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <dt className="font-medium text-slate-800">Outstanding</dt>
                    <dd className="font-mono font-bold tabular-nums text-[#9A6300]">R 500.00</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              ['01', 'Record Arrangements', 'Add child profiles and expected contribution amounts.'],
              [
                '02',
                'Submit & Confirm Payments',
                'Record payments with evidence. Recipients can confirm, partially confirm or dispute.',
              ],
              [
                '03',
                'Review & Export Summaries',
                'Export reports and let assigned social workers review records and concerns.',
              ],
            ].map(([num, title, text]) => (
              <div
                key={num}
                className="rounded-md border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-xs font-mono font-semibold text-[#006847]">{num}</p>
                <h3 className="mt-2 font-display text-base font-semibold text-[#0F2942]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!currentUser && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
            <h2 className="font-display text-2xl font-bold text-[#0F2942]">Ready to get started?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Create an account in a few minutes, or sign in to continue where you left off.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/register" className={primaryButton}>
                <span>Create your account</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className={secondaryButton}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
