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
    <div className="size-20 shrink-0 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 sm:size-28">
      <div className="grid size-full place-items-center">
        {showImage ? (
          <img
            src={src ?? ""}
            alt={alt}
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-2xl font-semibold tracking-tight text-emerald-800 sm:text-3xl">
            {getInitials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
