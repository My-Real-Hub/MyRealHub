import Link from "next/link";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import { SaveProviderButton } from "@/components/providers/save-provider-button";
import type { SavedProvider } from "@/lib/saved-providers";

type SavedProviderCardProps = {
  returnPath: string;
  savedProvider: SavedProvider;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

function getProviderName(provider: SavedProvider["provider"]) {
  return provider.business_name ?? provider.display_name ?? "Provider profile";
}

function getProviderLocation(provider: SavedProvider["provider"]) {
  const parts = [provider.city, provider.province_state].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

export function SavedProviderCard({
  returnPath,
  savedProvider,
}: SavedProviderCardProps) {
  const providerName = getProviderName(savedProvider.provider);
  const providerHref = `/providers/${
    savedProvider.provider.slug || savedProvider.provider.id
  }`;
  const savedDate = formatDate(savedProvider.created_at);

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <ProviderDashboardIcon name="bookmark" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-emerald-700">
            {savedProvider.categoryName ?? "Real estate service"}
          </p>
          <h3 className="mt-1 break-words text-lg font-semibold leading-6 tracking-tight text-stone-950">
            <Link
              href={providerHref}
              className="rounded-sm transition hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {providerName}
            </Link>
          </h3>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-stone-500">
            <ProviderDashboardIcon
              name="location"
              className="mt-0.5 size-4 shrink-0"
            />
            {getProviderLocation(savedProvider.provider)}
          </p>
        </div>
      </div>

      <p className="mt-4 min-h-12 line-clamp-2 text-sm leading-6 text-stone-600">
        {savedProvider.provider.bio ?? "No bio added yet."}
      </p>

      <div className="flex-1" />
      {savedDate ? (
        <p className="mt-4 text-xs leading-5 text-stone-400">
          Saved {savedDate}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 border-t border-stone-100 pt-4">
        <Link
          href={providerHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          View profile
          <ProviderDashboardIcon
            name="arrow"
            className="hidden size-4 sm:block"
          />
        </Link>
        <SaveProviderButton
          appearance="workspace"
          ariaLabel={`Remove ${providerName} from saved providers`}
          isSaved
          isSignedIn
          providerId={savedProvider.provider.id}
          returnPath={returnPath}
          savedLabel="Remove saved"
          size="compact"
        />
      </div>
    </article>
  );
}
