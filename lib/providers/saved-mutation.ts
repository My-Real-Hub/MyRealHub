import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { getDashboardPathForRole, hasProfileCapability, type ProfileRole } from "@/lib/auth/roles";
import { isProviderProfileId } from "@/lib/providers/slug";

export type SaveProviderFormState = {
  status: "idle" | "error";
  message: string;
};

type SavedProviderMutationDependencies = {
  getProfile: () => Promise<{ id: string; role: ProfileRole } | null>;
  getActiveProvider: (providerId: string) => Promise<{ slug: string } | null>;
  save: (userId: string, providerId: string) => Promise<{ error: unknown }>;
  unsave: (userId: string, providerId: string) => Promise<{ error: unknown }>;
  revalidate: (paths: string[]) => void;
};

type SavedProviderMutationResult =
  | { status: "redirect"; path: string }
  | { status: "error"; message: string };

export async function executeSavedProviderMutation(
  formData: FormData,
  operation: "save" | "unsave",
  dependencies: SavedProviderMutationDependencies,
): Promise<SavedProviderMutationResult> {
  const returnPath = getSafeRedirectPath(formData.get("returnPath")) ?? "/search";
  const rawProviderId = formData.get("providerId");
  const providerId = typeof rawProviderId === "string" ? rawProviderId.trim() : "";
  const profile = await dependencies.getProfile();

  if (!profile) {
    return {
      status: "redirect",
      path: `/login?next=${encodeURIComponent(returnPath)}&reason=save-provider`,
    };
  }

  if (!hasProfileCapability(profile.role, "consume_services")) {
    return { status: "redirect", path: getDashboardPathForRole(profile.role) };
  }

  if (!isProviderProfileId(providerId)) {
    return { status: "error", message: "This provider profile could not be found." };
  }

  const provider = await dependencies.getActiveProvider(providerId);
  if (!provider && operation === "save") {
    return { status: "error", message: "This provider is no longer available to save." };
  }

  const result = await dependencies[operation](profile.id, providerId);
  if (result.error) {
    return {
      status: "error",
      message: operation === "save"
        ? "We could not save this provider. Please try again."
        : "We could not remove this saved provider. Please try again.",
    };
  }

  const pathname = new URL(returnPath, "https://myrealhub.invalid").pathname;
  dependencies.revalidate([
    pathname,
    "/dashboard",
    "/dashboard/saved",
    "/search",
    `/providers/${provider?.slug ?? providerId}`,
  ]);

  return { status: "redirect", path: returnPath };
}
