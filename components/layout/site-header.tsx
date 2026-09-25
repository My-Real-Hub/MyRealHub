import Link from "next/link";
import { AuthMenu } from "@/components/auth/auth-menu";
import { MyRealHubLogo } from "@/components/brand/my-real-hub-logo";
import { FeedbackLink } from "@/components/feedback/feedback-link";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/"
          className="inline-flex rounded-md focus:outline-none focus:ring-4 focus:ring-teal-100"
          aria-label="MyRealHub home"
        >
          <MyRealHubLogo markClassName="size-14" />
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
            <FeedbackLink className="transition hover:text-stone-950" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AuthMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
