import Link from "next/link";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="MyRealHub home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
            MRH
          </span>
          <span className="text-lg font-semibold text-stone-950">MyRealHub</span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex flex-col gap-3 text-sm font-medium text-stone-600 sm:flex-row sm:items-center sm:justify-between lg:gap-6"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-stone-950"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            >
              Sign Up
            </Link>
            <Link
              href="/signup?role=provider"
              className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 font-semibold text-white transition hover:bg-emerald-800"
            >
              Join as Provider
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
