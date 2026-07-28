"use client";

import Link from "next/link";
import { useState } from "react";

type AudienceTab = "consumer" | "provider";

const tabs: Array<{
  id: AudienceTab;
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  highlights: string[];
}> = [
  {
    id: "consumer",
    eyebrow: "I need a provider",
    title: "Find the right real estate support for this project.",
    description:
      "Search by service, region, or exact project location, then compare public profiles, ratings, service areas, and contact options.",
    primaryHref: "/search#provider-search-address",
    primaryLabel: "Start searching",
    secondaryHref: "/feedback",
    secondaryLabel: "Suggest an improvement",
    highlights: [
      "Map-based discovery",
      "Saved providers",
      "Ratings and reviews",
    ],
  },
  {
    id: "provider",
    eyebrow: "I am a provider",
    title: "Claim your place in a focused Canadian services directory.",
    description:
      "Create a provider profile, choose the regions you serve, manage inquiries, and show consumers what makes your business easy to trust.",
    primaryHref: "/signup?role=provider",
    primaryLabel: "Join as provider",
    secondaryHref: "/login?next=/provider/dashboard",
    secondaryLabel: "Provider login",
    highlights: [
      "Service-region controls",
      "Inbox and email preferences",
      "Public ratings",
    ],
  },
];

export function AudienceTabs() {
  const [selectedTab, setSelectedTab] = useState<AudienceTab>("consumer");
  const activeTab = tabs.find((tab) => tab.id === selectedTab) ?? tabs[0];

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <div
        className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1"
        role="tablist"
        aria-label="Choose your MyRealHub path"
      >
        {tabs.map((tab) => {
          const isSelected = selectedTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`homepage-${tab.id}-panel`}
              id={`homepage-${tab.id}-tab`}
              onClick={() => setSelectedTab(tab.id)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold motion-safe:transition ${
                isSelected
                  ? "bg-white text-stone-950 shadow-sm"
                  : "text-stone-600 hover:text-stone-950"
              }`}
            >
              {tab.eyebrow}
            </button>
          );
        })}
      </div>

      <div
        id={`homepage-${activeTab.id}-panel`}
        role="tabpanel"
        aria-labelledby={`homepage-${activeTab.id}-tab`}
        className="p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {activeTab.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-stone-950">
          {activeTab.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {activeTab.description}
        </p>

        <ul className="mt-5 grid gap-2">
          {activeTab.highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-center gap-2 text-sm font-medium text-stone-700"
            >
              <span
                className="size-2 rounded-full bg-emerald-600"
                aria-hidden="true"
              />
              {highlight}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={activeTab.primaryHref}
            className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white motion-safe:transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            {activeTab.primaryLabel}
          </Link>
          <Link
            href={activeTab.secondaryHref}
            className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 motion-safe:transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
          >
            {activeTab.secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
