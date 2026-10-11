import Link from "next/link";
import type { ReactNode } from "react";
import { ConsumerDashboardNavigation } from "./consumer-dashboard-navigation";
import {
  ProviderDashboardIcon,
  type ProviderDashboardIconName,
} from "./provider-dashboard-icon";
import type { SavedProviderData } from "@/lib/saved-providers";

export const consumerPrimaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
export const consumerSecondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function ConsumerWorkspace({
  children,
  displayName,
  email,
  isProvider,
  page = "dashboard",
}: {
  children: ReactNode;
  displayName: string;
  email: string | null;
  isProvider: boolean;
  page?: "dashboard" | "saved";
}) {
  return (
    <div className="consumer-dashboard min-h-screen border-t border-stone-200 bg-[#f6f7f5]">
      <div className="mx-auto grid w-full max-w-[1440px] gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        <ConsumerDashboardNavigation
          displayName={displayName}
          email={email}
          isProvider={isProvider}
          page={page}
        />
        <div className="min-w-0 space-y-8">{children}</div>
      </div>
    </div>
  );
}

export function ConsumerWorkspaceHeader({
  actions,
  description,
  title,
}: {
  actions: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Your workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          {description}
        </p>
      </div>
      <div className="grid shrink-0 gap-2 sm:flex sm:flex-wrap">{actions}</div>
    </header>
  );
}

export function ConsumerMetric({
  description,
  href,
  icon,
  label,
  value,
  accent = false,
}: {
  description: string;
  href: string;
  icon: ProviderDashboardIconName;
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${accent ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-stone-600">{label}</span>
        <ProviderDashboardIcon
          name={icon}
          className={`size-[18px] shrink-0 ${accent ? "text-emerald-700" : "text-stone-400"}`}
        />
      </div>
      <p className="mt-4 text-3xl font-semibold leading-9 tracking-tight text-stone-950">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
    </Link>
  );
}

export function SavedProviderNotice({ data }: { data: SavedProviderData }) {
  if (data.errorMessage) {
    return (
      <p
        role="status"
        className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
      >
        {data.errorMessage}
      </p>
    );
  }
  if (!data.unavailableCount) return null;
  return (
    <p className="mt-4 text-sm leading-6 text-stone-500">
      {data.unavailableCount} saved{" "}
      {data.unavailableCount === 1 ? "provider is" : "providers are"} currently
      unavailable. Available profiles are shown below.
    </p>
  );
}

export function EmptySavedProviders({
  hasUnavailable = false,
}: {
  hasUnavailable?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-12 text-center sm:px-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <ProviderDashboardIcon name="bookmark" className="size-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-stone-950">
        {hasUnavailable
          ? "No available saved providers"
          : "Start your provider shortlist"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
        {hasUnavailable
          ? "Your saved profiles are currently unavailable. Browse the directory to find more providers for your shortlist."
          : "Save providers while you browse the directory, then come back here when you are ready to connect."}
      </p>
      <Link href="/search" className={`mt-5 ${consumerPrimaryButton}`}>
        <ProviderDashboardIcon name="search" className="size-[18px]" />
        Find providers
      </Link>
    </div>
  );
}
