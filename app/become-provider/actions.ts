"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PROVIDER_CONVERSION_ERROR,
  requestProviderAccess,
  type ProviderOnboardingState,
} from "@/lib/auth/provider-onboarding";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export async function becomeProvider(
  _previousState: ProviderOnboardingState,
  formData: FormData,
): Promise<ProviderOnboardingState> {
  let state: ProviderOnboardingState;
  try {
    const supabase = await getServerSupabaseClient();
    state = await requestProviderAccess(supabase, formData.get("confirmProvider"));
  } catch {
    return { error: PROVIDER_CONVERSION_ERROR };
  }
  if (state.error) return state;

  revalidatePath("/", "layout");
  redirect("/provider/dashboard");
}
