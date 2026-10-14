"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ProviderDashboardIcon,
  type ProviderDashboardIconName,
} from "./provider-dashboard-icon";

export type DashboardNavItem = {
  active?: boolean;
  href: string;
  label: string;
};

const icons: Record<string, ProviderDashboardIconName> = {
  Overview: "overview",
  Providers: "listing",
  Feedback: "inquiries",
  Categories: "listing",
  Languages: "mail",
  Specialties: "bookmark",
  "Profile details": "listing",
  "Status controls": "check",
  Ratings: "inquiries",
};

export function AdminDashboardNavigation({
  navItems,
  navLabel,
  signedInValue,
}: {
  navItems: DashboardNavItem[];
  navLabel: string;
  signedInValue: string;
}) {
  const initialItem =
    navItems.find((item) => item.active) ??
    navItems.find((item) => item.href.startsWith("#"));
  const [activeHref, setActiveHref] = useState(initialItem?.href);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const workspace =
      asideRef.current?.closest<HTMLElement>(".admin-dashboard");
    const header = document.querySelector<HTMLElement>("body > div > header");
    const localItems = navItems.filter((item) => item.href.startsWith("#"));
    let frame = 0;
    function update() {
      frame = 0;
      const offset = (header?.getBoundingClientRect().height ?? 88) + 32;
      let active = initialItem?.href;
      for (const item of localItems) {
        const element = document.getElementById(item.href.slice(1));
        if (element && element.getBoundingClientRect().top <= offset)
          active = item.href;
      }
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
      )
        active = localItems.at(-1)?.href ?? active;
      setActiveHref(active);
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    function measureHeader() {
      workspace?.style.setProperty(
        "--admin-header-height",
        `${header?.getBoundingClientRect().height ?? 88}px`,
      );
      schedule();
    }
    const observer = new ResizeObserver(measureHeader);
    if (header) observer.observe(header);
    measureHeader();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [navItems, initialItem?.href]);

  return (
    <aside
      ref={asideRef}
      className="min-w-0 self-start lg:sticky lg:top-[calc(var(--admin-header-height)+1.5rem)]"
    >
      <div className="hidden px-3 pb-6 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {navLabel} workspace
        </p>
        <p className="mt-2 text-base font-semibold text-stone-950">
          Manage MyRealHub
        </p>
      </div>
      <nav
        aria-label={`${navLabel} dashboard navigation`}
        className="grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0"
      >
        {navItems.map((item) => {
          const className = `flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:text-sm lg:justify-start lg:gap-2.5 lg:px-3 ${activeHref === item.href ? "bg-emerald-700 text-white shadow-sm" : "text-stone-600 hover:bg-white hover:text-stone-950"}`;
          const content = (
            <>
              <ProviderDashboardIcon
                name={icons[item.label] ?? "listing"}
                className="hidden size-[18px] shrink-0 sm:block"
              />
              <span className="text-center lg:text-left">{item.label}</span>
            </>
          );
          return item.href.startsWith("#") ? (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setActiveHref(item.href)}
              aria-current={activeHref === item.href ? "location" : undefined}
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 hidden border-t border-stone-200 px-3 pt-5 lg:block">
        <p className="text-xs text-stone-500">Signed in as</p>
        <p className="mt-1 break-all text-xs leading-5 text-stone-600">
          {signedInValue}
        </p>
      </div>
    </aside>
  );
}
