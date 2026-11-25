"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ProviderReviewMessage({
  message,
  outcome,
}: {
  message: { tone: "success" | "error"; message: string } | null;
  outcome: string | undefined;
}) {
  const activeOutcome = useSearchParams().get("review");

  useEffect(() => {
    if (!message || !outcome || activeOutcome !== outcome) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get("review") !== outcome) {
      return;
    }

    // Keep this result visible, but do not replay it on the next page reload.
    url.searchParams.delete("review");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeOutcome, message, outcome]);

  if (!message) {
    return null;
  }

  const className =
    message.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${className}`}
      role={message.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message.message}
    </p>
  );
}
