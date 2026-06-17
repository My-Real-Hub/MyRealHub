import Link from "next/link";
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
  return dateFormatter.format(new Date(value));
}

function getProviderName(provider: SavedProvider["provider"]) {
  return provider.business_name ?? provider.display_name ?? "Provider profile";
}

function getProviderLocation(provider: SavedProvider["provider"]) {
  const parts = [
    provider.city,
    provider.province_state,
    provider.country,
  ].filter(Boolean);

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

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {savedProvider.categoryName ?? "Real estate service"}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-stone-950">
            {providerName}
          </h3>
          <p className="mt-2 text-sm font-medium text-stone-700">
            {getProviderLocation(savedProvider.provider)}
          </p>
        </div>
        <span className="w-fit rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
          Saved {formatDate(savedProvider.created_at)}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-600">
        {savedProvider.provider.bio ?? "No bio added yet."}
      </p>

      <div className="mt-5 grid gap-2 border-t border-stone-200 pt-4 sm:grid-cols-3">
        <Link
          href={providerHref}
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          View profile
        </Link>
        <Link
          href="/search"
          className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950 focus:outline-none focus:ring-4 focus:ring-stone-100"
        >
          Find more
        </Link>
        <SaveProviderButton
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
