import Link from "next/link";

export default function LogInPage() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Log In
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Access your MyRealHub account
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Supabase authentication will be added in a later task. This route keeps
          the public navigation structure ready.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <form className="grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Email
            <input
              type="email"
              className="h-12 rounded-md border border-stone-200 px-3 text-base outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
            Password
            <input
              type="password"
              className="h-12 rounded-md border border-stone-200 px-3 text-base outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="h-12 rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            Log In
          </button>
        </form>

        <p className="mt-5 text-sm text-stone-600">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-emerald-800">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}
