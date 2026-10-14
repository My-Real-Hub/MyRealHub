"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ProviderDashboardIcon,
  type ProviderDashboardIconName,
} from "@/components/dashboard/provider-dashboard-icon";

export type SettingsNavigationItem = {
  id: string;
  label: string;
  icon: ProviderDashboardIconName;
  group: "account" | "business" | "security";
};

export function SettingsNavigation({
  dashboardPath,
  displayName,
  email,
  items,
}: {
  dashboardPath: string;
  displayName: string;
  email: string | null;
  items: SettingsNavigationItem[];
}) {
  const [activeSection, setActiveSection] = useState("account");
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const workspace = asideRef.current?.closest<HTMLElement>(
      ".settings-workspace",
    );
    const header = document.querySelector<HTMLElement>("body > div > header");
    let frame = 0;

    function update() {
      frame = 0;
      const offset = (header?.getBoundingClientRect().height ?? 88) + 32;
      let active = items[0]?.id ?? "account";
      for (const item of items) {
        const section = document.getElementById(item.id);
        if (section && section.getBoundingClientRect().top <= offset)
          active = item.id;
      }
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
      ) {
        active = items[items.length - 1]?.id ?? active;
      }
      setActiveSection(active);
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function measureHeader() {
      workspace?.style.setProperty(
        "--settings-header-height",
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
  }, [items]);

  return (
    <aside
      ref={asideRef}
      className="min-w-0 self-start lg:sticky lg:top-[calc(var(--settings-header-height)+1.5rem)]"
    >
      <div className="hidden px-3 pb-5 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Your settings
        </p>
        <p className="mt-2 break-words text-base font-semibold text-stone-950">
          {displayName}
        </p>
      </div>
      <nav
        aria-label="Settings navigation"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 sm:grid-cols-3 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0"
      >
        {items.map((item, index) => (
          <div key={item.id} className="min-w-0">
            {index > 0 && items[index - 1].group !== item.group ? (
              <div className="mb-3 mt-4 hidden border-t border-stone-200 lg:block" />
            ) : null}
            <a
              href={`#${item.id}`}
              aria-current={activeSection === item.id ? "location" : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${activeSection === item.id ? "bg-emerald-700 text-white shadow-sm" : "text-stone-600 hover:bg-white hover:text-stone-950"}`}
            >
              <ProviderDashboardIcon
                name={item.icon}
                className="size-[18px] shrink-0"
              />
              {item.label}
            </a>
          </div>
        ))}
      </nav>
      <div className="mt-5 hidden border-t border-stone-200 pt-5 lg:block">
        <Link
          href={dashboardPath}
          className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <ProviderDashboardIcon
            name="arrow"
            className="size-[18px] rotate-180"
          />
          Back to dashboard
        </Link>
        <div className="mt-6 px-3">
          <p className="text-xs text-stone-500">Signed in as</p>
          <p className="mt-1 break-all text-xs leading-5 text-stone-600">
            {email ?? displayName}
          </p>
        </div>
      </div>
    </aside>
  );
}
