export const MAX_PROVIDER_SERVICE_REGIONS = 2;

export type CanadianSubdivisionOption = {
  code: string;
  name: string;
  kind: "province" | "territory";
};

export type ServiceRegionOption = {
  id: string;
  name: string;
  province_code: string;
  slug: string;
};
