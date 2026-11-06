import "server-only";

import { getServerSupabaseClient } from "@/lib/supabase/server";
import type { ServiceRegionMatchRow } from "./region-match";
export { matchServiceRegion, type GeocodedLocation, type ServiceRegionMatchRow } from "./region-match";

export async function getServiceRegionMatchRows() {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("service_regions")
    .select(
      [
        "id",
        "name",
        "slug",
        "province_code",
        "center_latitude",
        "center_longitude",
        "location_match_terms",
      ].join(","),
    )
    .eq("is_active", true);

  if (error) {
    throw new Error("Service-region matching data could not be loaded.");
  }

  return (data ?? []) as unknown as ServiceRegionMatchRow[];
}
