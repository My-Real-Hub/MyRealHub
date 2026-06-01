import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseEnvVar =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

type SupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

let supabaseClient: SupabaseClient | null = null;

function normalizeSupabaseUrl(value: string) {
  return value.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function getMissingSupabaseEnvVars(): SupabaseEnvVar[] {
  const missing: SupabaseEnvVar[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  if (getMissingSupabaseEnvVars().length > 0) {
    return null;
  }

  return {
    supabaseUrl: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  };
}

export function getSupabaseAuthHealthUrl(config = getSupabaseConfig()) {
  return config ? `${config.supabaseUrl}/auth/v1/health` : null;
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = getSupabaseConfig();

  if (!config) {
    throw new Error(
      `Missing Supabase environment variables: ${getMissingSupabaseEnvVars().join(", ")}`,
    );
  }

  supabaseClient = createBrowserClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
  );

  return supabaseClient;
}
