import Link from "next/link";
import { MyRealHubLogo } from "@/components/brand/my-real-hub-logo";
import { FeedbackLink } from "@/components/feedback/feedback-link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/signup", label: "Sign Up" },
  { href: "/login", label: "Log In" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <MyRealHubLogo
            markClassName="size-12"
            wordmarkClassName="relative h-7 w-32"
          />
          <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
            A focused directory for real estate services, built step by step for
            buyers, sellers, providers, and admins.
          </p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-stone-600"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-stone-950"
            >
              {link.label}
            </Link>
          ))}
          <FeedbackLink className="transition hover:text-stone-950" />
        </nav>
      </div>
    </footer>
  );
}
