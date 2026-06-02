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

function isPlaceholderSupabaseValue(value: string) {
  return /your-project-ref|your-supabase|placeholder/i.test(value);
}

export function getMissingSupabaseEnvVars(): SupabaseEnvVar[] {
  const missing: SupabaseEnvVar[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || isPlaceholderSupabaseValue(supabaseUrl)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey || isPlaceholderSupabaseValue(supabaseAnonKey)) {
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
      `Missing or placeholder Supabase environment variables: ${getMissingSupabaseEnvVars().join(", ")}`,
    );
  }

  supabaseClient = createBrowserClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
  );

  return supabaseClient;
}
