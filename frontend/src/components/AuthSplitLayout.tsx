import React from 'react';
import { SiteImage } from '../config/images';
import { GovernmentBranding } from './GovernmentBranding';
import { PhotoFrame } from './PhotoFrame';

interface AuthSplitLayoutProps {
  image: SiteImage;
  imagePosition?: string;
  headline: string;
  text: string;
  children: React.ReactNode;
}

// Shared split-screen frame for sign in and registration. The existing form sits on one side and a photo
// on the other. On phones the photo becomes a short banner above the form, so the form stays easy to use.
export function AuthSplitLayout({ image, imagePosition, headline, text, children }: AuthSplitLayoutProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid grid-cols-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:grid-cols-12">
        <PhotoFrame image={image} position={imagePosition} bare className="h-32 sm:h-44 lg:hidden" />

        <div className="space-y-6 px-5 py-8 sm:px-8 lg:col-span-7 lg:px-12 lg:py-10">
          {children}
          <GovernmentBranding className="border-t border-slate-200 pt-5" />
        </div>

        <PhotoFrame
          image={image}
          position={imagePosition}
          bare
          priority
          className="hidden min-h-[34rem] lg:col-span-5 lg:block"
          caption={
            <>
              <span className="block font-display text-lg font-semibold leading-snug">{headline}</span>
              <span className="mt-1 block text-sm font-normal text-white/90">{text}</span>
            </>
          }
        />
      </div>
    </div>
  );
}
