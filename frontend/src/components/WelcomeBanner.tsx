import React from 'react';
import { SiteImage } from '../config/images';
import { PhotoFrame } from './PhotoFrame';

interface WelcomeBannerProps {
  title: string;
  image: SiteImage;
  imagePosition?: string;
  children: React.ReactNode;
}

// A slim welcome strip for the top of a dashboard or profile page. The photo is a small side panel that
// is hidden on phones, so it never pushes tables, payments or other working content down the screen.
export function WelcomeBanner({ title, image, imagePosition, children }: WelcomeBannerProps) {
  return (
    <section className="flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-[#0F2942]">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{children}</p>
      </div>
      <PhotoFrame
        image={image}
        position={imagePosition}
        bare
        className="hidden min-h-[6.5rem] w-40 shrink-0 sm:block lg:w-56"
      />
    </section>
  );
}
