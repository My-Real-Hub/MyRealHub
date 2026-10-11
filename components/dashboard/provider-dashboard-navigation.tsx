"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProviderDashboardIcon } from "./provider-dashboard-icon";

const sections = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "inquiries", label: "Inquiries", icon: "inquiries" },
  { id: "listing", label: "Your listing", icon: "listing" },
  { id: "customer-tools", label: "Customer tools", icon: "search" },
] as const;

export function ProviderDashboardNavigation({
  displayName,
  email,
}: {
  displayName: string;
  email: string | null;
}) {
  const [activeSection, setActiveSection] = useState<string>("overview");
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dashboard = asideRef.current?.closest<HTMLElement>(
      ".provider-dashboard",
    );
    const siteHeader = document.querySelector<HTMLElement>(
      "body > div > header",
    );
    let animationFrame = 0;

    function updateActiveSection() {
      animationFrame = 0;
      const offset = (siteHeader?.getBoundingClientRect().height ?? 88) + 32;
      let active: string = "overview";

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= offset) {
          active = section.id;
        }
      }

      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
      ) {
        active = sections[sections.length - 1].id;
      }

      setActiveSection(active);
    }

    function scheduleUpdate() {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updateActiveSection);
      }
    }

    function updateHeaderHeight() {
      const height = siteHeader?.getBoundingClientRect().height ?? 88;
      dashboard?.style.setProperty("--provider-header-height", `${height}px`);
      scheduleUpdate();
    }

    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    if (siteHeader) resizeObserver.observe(siteHeader);
    updateHeaderHeight();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, []);

  return (
    <aside
      ref={asideRef}
      className="min-w-0 self-start lg:sticky lg:top-[calc(var(--provider-header-height)+1.5rem)]"
    >
      <div className="hidden px-3 pb-6 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Provider workspace
        </p>
        <p className="mt-2 break-words text-base font-semibold text-stone-950">
          {displayName}
        </p>
      </div>
      <nav aria-label="Provider dashboard navigation">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-stone-200 bg-white p-2 sm:grid-cols-4 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={
                activeSection === section.id ? "location" : undefined
              }
              className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                activeSection === section.id
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-stone-600 hover:bg-white hover:text-stone-950"
              }`}
            >
              <ProviderDashboardIcon
                name={section.icon}
                className="size-[18px] shrink-0"
              />
              {section.label}
            </a>
          ))}
        </div>
      </nav>
      <div className="mt-5 hidden border-t border-stone-200 pt-5 lg:block">
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
        <div className="mt-7 px-3">
          <p className="text-xs font-medium text-stone-500">Signed in as</p>
          <p className="mt-1 break-all text-xs leading-5 text-stone-600">
            {email ?? displayName}
          </p>
        </div>
      </div>
    </aside>
  );
}
