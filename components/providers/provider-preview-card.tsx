import type { FeaturedProvider } from "@/types/provider";

type ProviderPreviewCardProps = {
  provider: FeaturedProvider;
};

export function ProviderPreviewCard({ provider }: ProviderPreviewCardProps) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">{provider.category}</p>
          <h3 className="mt-2 text-lg font-semibold text-stone-950">{provider.name}</h3>
        </div>
        <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
          Verified
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-600">{provider.summary}</p>
      <p className="mt-4 text-sm font-medium text-stone-800">{provider.location}</p>
    </article>
  );
}
