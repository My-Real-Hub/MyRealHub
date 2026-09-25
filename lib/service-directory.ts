import type { FeaturedProvider, ServiceCategory } from "@/types/provider";

export const serviceCategories: ServiceCategory[] = [
  "Real estate agent",
  "Mortgage broker",
  "Home inspector",
  "Real estate lawyer",
  "Appraiser",
  "Contractor",
  "Photographer",
  "Home stager",
  "Property manager",
];

export const featuredProviders: FeaturedProvider[] = [
  {
    name: "Northline Realty Group",
    category: "Real estate agent",
    location: "Metro area",
    summary: "Residential buying and selling support for first-time movers.",
  },
  {
    name: "ClearPath Mortgage",
    category: "Mortgage broker",
    location: "Suburban market",
    summary: "Rate comparison and pre-approval guidance for home buyers.",
  },
  {
    name: "Keystone Home Inspections",
    category: "Home inspector",
    location: "Regional market",
    summary: "Detailed inspections for houses, condos, and investment properties.",
  },
];
