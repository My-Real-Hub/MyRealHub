"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "MRH";
}

export function ProfileImage({
  alt,
  name,
  src,
}: {
  alt: string;
  name: string;
  src: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-gradient-to-br from-emerald-50 to-stone-100">
      <div className="grid aspect-square place-items-center">
        {showImage ? (
          <img
            src={src ?? ""}
            alt={alt}
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-emerald-700 text-2xl font-semibold text-white shadow-sm">
            {getInitials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
