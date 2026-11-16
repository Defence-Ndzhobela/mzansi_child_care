import { IMAGES } from '../config/images';

// The national Coat of Arms is shown with an explicit statement of independence. Mzansi ChildCare is not
// owned, operated or endorsed by the government, and the wording below must stay accurate.
export function GovernmentBranding({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <img
        src={IMAGES.governmentLogo.src}
        alt={IMAGES.governmentLogo.alt}
        width={IMAGES.governmentLogo.width}
        height={IMAGES.governmentLogo.height}
        loading="lazy"
        decoding="async"
        className="h-12 w-auto shrink-0"
      />
      <p className="text-xs leading-relaxed text-slate-600">
        Mzansi ChildCare is an independent community initiative. It is not owned, operated or endorsed by the
        Government of the Republic of South Africa. The national Coat of Arms is shown for reference only.
      </p>
    </div>
  );
}
