"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Renders a manager's photo from /public/manager-photos/{slug}.jpg. Until
 * that file is provided, falls back to an initials avatar so the layout
 * never shows a broken image.
 */
export function ManagerPhoto({
  src,
  alt,
  initials,
}: {
  src: string;
  alt: string;
  initials: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-gold-500 bg-burgundy-800 text-xl font-semibold text-gold-300"
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={112}
      height={112}
      className="h-28 w-28 rounded-full border-2 border-gold-500 object-cover"
      onError={() => setErrored(true)}
    />
  );
}
