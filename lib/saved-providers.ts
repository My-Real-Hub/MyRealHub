import { getServerSupabaseClient } from "@/lib/supabase/server";

export type SavedProviderRow = {
  id: string;
  provider_profile_id: string;
  created_at: string;
};

export type SavedProviderProfileRow = {
  id: string;
  slug: string;
  category_id: string | null;
  business_name: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  service_area: string | null;
};

export type SavedProviderCategoryRow = {
  id: string;
  name: string;
};

export type SavedProvider = SavedProviderRow & {
  provider: SavedProviderProfileRow;
  categoryName: string | null;
};

export type SavedProviderData = {
  errorMessage: string | null;
  savedProviders: SavedProvider[];
  totalSaved: number;
  unavailableCount: number;
};

const savedProviderSelectColumns = [
  "id",
  "slug",
  "category_id",
  "business_name",
  "display_name",
  "bio",
  "city",
  "province_state",
  "country",
  "service_area",
].join(",");

function getCategoryName(
  categories: SavedProviderCategoryRow[],
  categoryId: string | null,
) {
  return categories.find((category) => category.id === categoryId)?.name ?? null;
}

export async function getSavedProviderIds(userId: string, providerIds: string[]) {
  if (providerIds.length === 0) {
    return new Set<string>();
  }

  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("saved_providers")
    .select("provider_profile_id")
    .eq("user_id", userId)
    .in("provider_profile_id", providerIds);

  return new Set(
    ((data ?? []) as Pick<SavedProviderRow, "provider_profile_id">[]).map(
      (row) => row.provider_profile_id,
    ),
  );
}

export async function getIsProviderSaved(userId: string, providerId: string) {
  const savedProviderIds = await getSavedProviderIds(userId, [providerId]);

  return savedProviderIds.has(providerId);
}

export async function getSavedProviderData(
  userId: string,
): Promise<SavedProviderData> {
  const supabase = await getServerSupabaseClient();
  const { data: savedRows, error: savedError } = await supabase
    .from("saved_providers")
    .select("id,provider_profile_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (savedError) {
    return {
      errorMessage: "Saved providers could not be loaded.",
      savedProviders: [],
      totalSaved: 0,
      unavailableCount: 0,
    };
  }

  const savedProviders = (savedRows ?? []) as SavedProviderRow[];
  const providerIds = savedProviders.map((row) => row.provider_profile_id);

  if (providerIds.length === 0) {
    return {
      errorMessage: null,
      savedProviders: [],
      totalSaved: 0,
      unavailableCount: 0,
    };
  }

  const { data: providerRows, error: providerError } = await supabase
    .from("provider_profiles")
    .select(savedProviderSelectColumns)
    .eq("status", "active")
    .in("id", providerIds);

  if (providerError) {
    return {
      errorMessage: "Saved provider details could not be loaded.",
      savedProviders: [],
      totalSaved: savedProviders.length,
      unavailableCount: savedProviders.length,
    };
  }

  const providers = (providerRows ?? []) as unknown as SavedProviderProfileRow[];
  const providerMap = new Map(
    providers.map((provider) => [provider.id, provider]),
  );
  const categoryIds = Array.from(
    new Set(providers.map((provider) => provider.category_id).filter(Boolean)),
  ) as string[];
  const { data: categoryRows } =
    categoryIds.length > 0
      ? await supabase
          .from("categories")
          .select("id,name")
          .in("id", categoryIds)
          .eq("is_active", true)
      : { data: [] };
  const categories = (categoryRows ?? []) as SavedProviderCategoryRow[];
  const visibleSavedProviders = savedProviders
    .map((savedProvider) => {
      const provider = providerMap.get(savedProvider.provider_profile_id);

      if (!provider) {
        return null;
      }

      return {
        ...savedProvider,
        categoryName: getCategoryName(categories, provider.category_id),
        provider,
      };
    })
    .filter((savedProvider): savedProvider is SavedProvider =>
      Boolean(savedProvider),
    );

  return {
    errorMessage: null,
    savedProviders: visibleSavedProviders,
    totalSaved: savedProviders.length,
    unavailableCount: savedProviders.length - visibleSavedProviders.length,
  };
}
