import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfileRoleForUser } from "./roles";

export type ProviderOnboardingState = { error: string | null };

export const initialProviderOnboardingState: ProviderOnboardingState = {
  error: null,
};

export const PROVIDER_CONVERSION_ERROR =
  "Provider access could not be added right now. Please try again later.";

// Called only by the authenticated Server Action. The database independently
// checks the caller and permits only the self-scoped customer-to-provider change.
export async function requestProviderAccess(
  supabase: SupabaseClient,
  confirmation: unknown,
): Promise<ProviderOnboardingState> {
  if (confirmation !== "yes") {
    return { error: "Confirm that you want to add provider tools to this account." };
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { error: "Your session could not be verified. Please log in again." };
    }
    if (!data.user.email_confirmed_at || data.user.is_anonymous) {
      return { error: "Confirm your email and log in before adding provider tools." };
    }

    const role = await getProfileRoleForUser(supabase, data.user.id);
    if (role !== "user" && role !== "provider") {
      return { error: "This account cannot add provider tools here." };
    }

    const converted = await supabase.rpc("become_provider");
    if (converted.error || converted.data !== "provider") {
      return { error: PROVIDER_CONVERSION_ERROR };
    }
    return { error: null };
  } catch {
    return { error: PROVIDER_CONVERSION_ERROR };
  }
}
