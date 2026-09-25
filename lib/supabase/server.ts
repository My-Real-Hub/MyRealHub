import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getMissingSupabaseEnvVars, getSupabaseConfig } from "@/lib/supabase/client";

export async function getServerSupabaseClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error(
      `Missing Supabase environment variables: ${getMissingSupabaseEnvVars().join(", ")}`,
    );
  }

  const cookieStore = await cookies();

  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies, but cookie writes are handled in proxy.
        }
      },
    },
  });
}
