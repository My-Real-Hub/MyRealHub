import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-4 text-stone-600">That page may have moved or is no longer available.</p>
      <Link href="/search" className="mt-6 inline-block rounded bg-emerald-800 px-5 py-3 font-semibold text-white">Find a provider</Link>
    </section>
  );
}
