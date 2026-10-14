"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProviderDashboardIcon } from "./provider-dashboard-icon";

const sections = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "sent-messages", label: "Messages", icon: "inquiries" },
  { id: "saved-providers", label: "Saved providers", icon: "bookmark" },
] as const;

export function ConsumerDashboardNavigation({
  displayName,
  email,
  isProvider,
  page,
}: {
  displayName: string;
  email: string | null;
  isProvider: boolean;
  page: "dashboard" | "saved";
}) {
  const [activeSection, setActiveSection] = useState<string>(
    page === "saved" ? "saved-providers" : "overview",
  );
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const workspace = asideRef.current?.closest<HTMLElement>(
      ".consumer-dashboard",
    );
    const header = document.querySelector<HTMLElement>("body > div > header");
    let frame = 0;

    function update() {
      frame = 0;
      if (page === "saved") return;
      const offset = (header?.getBoundingClientRect().height ?? 88) + 32;
      let active: string = "overview";
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= offset)
          active = section.id;
      }
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
      ) {
        active = sections[sections.length - 1].id;
      }
      setActiveSection(active);
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function measureHeader() {
      workspace?.style.setProperty(
        "--consumer-header-height",
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
  }, [page]);

  return (
    <aside
      ref={asideRef}
      className="min-w-0 self-start lg:sticky lg:top-[calc(var(--consumer-header-height)+1.5rem)]"
    >
      <div className="hidden px-3 pb-6 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {isProvider ? "Consumer tools" : "Customer workspace"}
        </p>
        <p className="mt-2 break-words text-base font-semibold text-stone-950">
          {displayName}
        </p>
      </div>
      <nav
        aria-label={
          isProvider
            ? "Consumer tools navigation"
            : "Customer dashboard navigation"
        }
        className="grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0"
      >
        {sections.map((section) => {
          const isLocal =
            page === "dashboard" || section.id === "saved-providers";
          const href = `${isLocal ? "" : "/dashboard"}#${section.id}`;
          const className = `flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:text-sm lg:justify-start lg:gap-2.5 lg:px-3 ${activeSection === section.id ? "bg-emerald-700 text-white shadow-sm" : "text-stone-600 hover:bg-white hover:text-stone-950"}`;
          const content = (
            <>
              <ProviderDashboardIcon
                name={section.icon}
                className="hidden size-[18px] shrink-0 sm:block"
              />
              <span className="text-center lg:text-left">{section.label}</span>
            </>
          );
          return isLocal ? (
            <a
              key={section.id}
              href={href}
              onClick={() => setActiveSection(section.id)}
              aria-current={
                activeSection === section.id ? "location" : undefined
              }
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link key={section.id} href={href} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>
      <div className="mt-5 hidden border-t border-stone-200 pt-4 lg:block">
        <Link
          href="/settings"
          className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <ProviderDashboardIcon
            name="settings"
            className="size-[18px] shrink-0"
          />
          Account settings
        </Link>
        {isProvider ? (
          <Link
            href="/provider/dashboard"
            className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <ProviderDashboardIcon
              name="listing"
              className="size-[18px] shrink-0"
            />
            Provider dashboard
          </Link>
        ) : null}
        <div className="mt-6 hidden px-3 lg:block">
          <p className="text-xs text-stone-500">Signed in as</p>
          <p className="mt-1 break-all text-xs leading-5 text-stone-600">
            {email ?? displayName}
          </p>
        </div>
      </div>
    </aside>
  );
}
