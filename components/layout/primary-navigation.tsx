"use client";

import { usePathname } from "next/navigation";
import { FeedbackLink } from "@/components/feedback/feedback-link";
import { NavigationLink } from "./navigation-link";

const linkClassName =
  "inline-flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const inactiveClassName =
  "border-transparent text-stone-600 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-950";

export function PrimaryNavigation() {
  const pathname = usePathname();
  const isFeedback = pathname === "/feedback";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <NavigationLink
        href="/"
        className={linkClassName}
        inactiveClassName={inactiveClassName}
      >
        Home
      </NavigationLink>
      <NavigationLink
        href="/search"
        relatedPath="/providers"
        className={linkClassName}
        inactiveClassName={inactiveClassName}
      >
        Search
      </NavigationLink>
      <FeedbackLink
        ariaCurrent={isFeedback ? "page" : undefined}
        className={`${linkClassName} ${isFeedback ? "border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200" : "border-transparent text-stone-600 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-950"}`}
      />
    </div>
  );
}
