import Link from "next/link";

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const isProvider = params.role === "provider";

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Sign Up
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          {isProvider ? "Join MyRealHub as a provider" : "Create your MyRealHub account"}
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Account creation will be connected to Supabase Auth in a later task.
          This page establishes the public route and provider CTA destination.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/signup"
            className={`rounded-md border px-4 py-3 text-sm font-semibold transition ${
              isProvider
                ? "border-stone-200 text-stone-600 hover:border-stone-950"
                : "border-emerald-700 bg-emerald-50 text-emerald-800"
            }`}
          >
            Regular user
          </Link>
          <Link
            href="/signup?role=provider"
            className={`rounded-md border px-4 py-3 text-sm font-semibold transition ${
              isProvider
                ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                : "border-stone-200 text-stone-600 hover:border-stone-950"
            }`}
          >
            Service provider
          </Link>
        </div>

        <form className="mt-6 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Name
            <input
              type="text"
              className="h-12 rounded-md border border-stone-200 px-3 text-base outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Email
            <input
              type="email"
              className="h-12 rounded-md border border-stone-200 px-3 text-base outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="h-12 rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            Continue
          </button>
        </form>
      </div>
    </section>
  );
}
