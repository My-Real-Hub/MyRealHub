export type ServiceCategory =
  | "Real estate agent"
  | "Mortgage broker"
  | "Home inspector"
  | "Real estate lawyer"
  | "Appraiser"
  | "Contractor"
  | "Photographer"
  | "Home stager"
  | "Property manager";

export type FeaturedProvider = {
  name: string;
  category: ServiceCategory;
  location: string;
  summary: string;
};
