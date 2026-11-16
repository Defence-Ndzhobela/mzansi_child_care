import React from 'react';
import { SiteImage } from '../config/images';

interface PhotoFrameProps {
  image: SiteImage;
  // Sizing comes from the caller, for example "aspect-[4/3]" or "h-full min-h-[8rem]".
  className?: string;
  // CSS object-position, used to keep faces in view when a photo is cropped.
  position?: string;
  // The first image on a page loads straight away; everything else loads lazily.
  priority?: boolean;
  // Drops the border, radius and shadow when the frame sits inside another card.
  bare?: boolean;
  caption?: React.ReactNode;
}

// A cropped photo that is never stretched: the image fills the frame with object-fit: cover.
export function PhotoFrame({
  image,
  className = '',
  position = 'center',
  priority = false,
  bare = false,
  caption,
}: PhotoFrameProps) {
  return (
    <figure
      className={`group relative overflow-hidden bg-slate-100 ${
        bare ? '' : 'rounded-md border border-slate-200 shadow-sm'
      } ${className}`}
    >
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ objectPosition: position }}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      {caption && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0F2942]/85 via-[#0F2942]/45 to-transparent px-4 pb-3 pt-10 text-sm font-medium text-white">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
