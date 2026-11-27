"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="mx-auto max-w-xl px-6 py-20" role="alert">
      <h1 className="text-3xl font-semibold">This page could not be loaded</h1>
      <p className="mt-4 text-stone-600">Please try again. If the problem continues, return to the homepage.</p>
      <button onClick={() => retry()} className="mt-6 rounded bg-emerald-800 px-5 py-3 font-semibold text-white">Try again</button>
      <Link href="/" className="ml-5 underline">Go to homepage</Link>
    </section>
  );
}
