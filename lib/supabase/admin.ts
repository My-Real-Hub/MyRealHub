import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getMissingSupabaseEnvVars,
  getSupabaseConfig,
} from "@/lib/supabase/client";

let adminClient: SupabaseClient | null = null;

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return serviceRoleKey && !serviceRoleKey.startsWith("your-")
    ? serviceRoleKey
    : "";
}

export function getMissingSupabaseAdminEnvVars() {
  return [
    ...getMissingSupabaseEnvVars(),
    ...(getServiceRoleKey() ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
  ];
}

export function getSupabaseAdminClient() {
  const config = getSupabaseConfig();
  const serviceRoleKey = getServiceRoleKey();

  if (!config || !serviceRoleKey) {
    return null;
  }

  adminClient ??= createClient(config.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
