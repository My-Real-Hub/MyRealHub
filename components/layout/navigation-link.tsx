"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const navigationButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function NavigationLink({
  children,
  href,
  className = navigationButtonClassName,
  inactiveClassName = "border-stone-200 text-stone-600 hover:border-stone-400 hover:bg-stone-50 hover:text-stone-950",
  relatedPath,
}: {
  children: ReactNode;
  href: string;
  className?: string;
  inactiveClassName?: string;
  relatedPath?: string;
}) {
  const pathname = usePathname();
  const targetPath = href.split("?")[0];
  const isActive =
    pathname === targetPath ||
    (targetPath !== "/" && pathname.startsWith(`${targetPath}/`)) ||
    (relatedPath &&
      (pathname === relatedPath || pathname.startsWith(`${relatedPath}/`)));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`${className} ${isActive ? "border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200" : inactiveClassName}`}
    >
      {children}
    </Link>
  );
}
