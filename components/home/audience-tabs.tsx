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
  highlights: string[];
}> = [
  {
    id: "consumer",
    eyebrow: "I need a provider",
    title: "Find the right real estate support for your property.",
    description:
      "Search by service, area, or property location, then compare public profiles, ratings, service areas, and contact options.",
    primaryHref: "/search#provider-search-address",
    primaryLabel: "Start searching",
    highlights: [
      "Map-based discovery",
      "Saved providers",
      "Ratings and reviews",
    ],
  },
  {
    id: "provider",
    eyebrow: "I am a provider",
    title: "Claim your place in a focused services directory.",
    description:
      "Create a provider profile, choose the areas you serve, manage inquiries, and show consumers what makes your business easy to trust.",
    primaryHref: "/signup?role=provider",
    primaryLabel: "Join as provider",
    highlights: [
      "Service-area controls",
      "Inbox and email preferences",
      "Public ratings",
    ],
  },
];

export function AudienceTabs() {
  const [selectedTab, setSelectedTab] = useState<AudienceTab>("consumer");

  return (
    <section className="rounded-lg border border-stone-300 bg-white p-3 shadow-sm">
      <div
        className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1"
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
              className={`rounded-md px-3 py-2 text-sm font-semibold motion-safe:transition ${
                isSelected
                  ? "bg-stone-950 text-white shadow-sm"
                  : "text-stone-700 hover:text-stone-950"
              }`}
            >
              {tab.eyebrow}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-[23rem]">
        {tabs.map((tab) => {
          const isSelected = selectedTab === tab.id;

          return (
            <div
              key={tab.id}
              id={`homepage-${tab.id}-panel`}
              role="tabpanel"
              aria-labelledby={`homepage-${tab.id}-tab`}
              aria-hidden={!isSelected}
              className={`col-start-1 row-start-1 flex flex-col p-5 motion-safe:transition-opacity ${
                isSelected
                  ? "visible opacity-100"
                  : "invisible pointer-events-none opacity-0"
              }`}
            >
              <p className="text-sm font-semibold uppercase text-teal-700">
                {tab.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-stone-950">
                {tab.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {tab.description}
              </p>

              <ul className="mt-5 grid gap-2">
                {tab.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-center gap-2 text-sm font-medium text-stone-700"
                  >
                    <span
                      className="h-px w-4 bg-teal-700"
                      aria-hidden="true"
                    />
                    {highlight}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <Link
                  href={tab.primaryHref}
                  className="inline-flex h-11 w-full items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white motion-safe:transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100 sm:w-auto"
                >
                  {tab.primaryLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
