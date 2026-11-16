import { Link } from 'react-router-dom';
import { GovernmentBranding } from '../../components/GovernmentBranding';
import { PhotoFrame } from '../../components/PhotoFrame';
import { IMAGES } from '../../config/images';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[#0F2942]">About</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-700">
        Mzansi ChildCare helps families keep child maintenance arrangements, payments and
        confirmations in one place.
      </p>

      <PhotoFrame
        image={IMAGES.communityDevelopment}
        position="center 35%"
        priority
        className="mt-8 aspect-[16/9] w-full sm:aspect-[2/1]"
        caption="Communities and families working together for children."
      />

      <div className="mt-8 space-y-6 border-t border-slate-200 pt-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#0F2942]">Who we serve</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Mzansi ChildCare is for every South African family. Black, Coloured, Indian and White families, and all
            other communities, have the same access to the platform and the same right to care, protection and
            support for their children.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-[#0F2942]">Features</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>Manage child profiles and maintenance arrangements.</li>
            <li>Record payments, attach evidence and confirm or dispute entries.</li>
            <li>View and export payment reports.</li>
            <li>Review assigned cases and add social worker notes.</li>
          </ul>
        </div>

        <section className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm sm:flex-row">
          <PhotoFrame
            image={IMAGES.socialWorker}
            position="72% center"
            bare
            className="h-44 shrink-0 sm:h-auto sm:w-56"
          />
          <div className="p-5">
            <h2 className="font-display text-lg font-semibold text-[#0F2942]">For social workers</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Social workers are registered by a Mzansi ChildCare administrator. Once your account is created you
              will see the children and families assigned to you, review their payment records and add professional
              notes.
            </p>
          </div>
        </section>

        <div>
          <h2 className="font-display text-xl font-semibold text-[#0F2942]">Independence</h2>
          <GovernmentBranding className="mt-3" />
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
