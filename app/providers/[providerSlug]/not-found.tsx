import Link from "next/link";

export default function ProviderProfileNotFound() {
  return (
    <section className="mx-auto grid min-h-[55vh] w-full max-w-3xl place-items-center px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Provider profile
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Provider not found
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          This profile may be unavailable, inactive, or no longer listed.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Back to search
        </Link>
      </div>
    </section>
  );
}
