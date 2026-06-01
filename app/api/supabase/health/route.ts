import {
  getSupabaseAuthHealthUrl,
  getMissingSupabaseEnvVars,
  getSupabaseConfig,
} from "@/lib/supabase/client";

export async function GET() {
  const config = getSupabaseConfig();
  const healthUrl = getSupabaseAuthHealthUrl(config);

  if (!config || !healthUrl) {
    return Response.json(
      {
        ok: false,
        configured: false,
        missing: getMissingSupabaseEnvVars(),
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(healthUrl, {
      cache: "no-store",
      headers: {
        apikey: config.supabaseAnonKey,
      },
    });
    const body = (await response.json().catch(() => null)) as {
      name?: string;
      version?: string;
    } | null;

    return Response.json(
      {
        ok: response.ok,
        configured: true,
        service: body?.name ?? "Supabase Auth",
        status: response.status,
        statusText: response.statusText,
        supabaseUrl: config.supabaseUrl,
        version: body?.version,
      },
      { status: response.ok ? 200 : 502 },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        configured: true,
        message:
          error instanceof Error
            ? error.message
            : "Supabase connection test failed.",
        supabaseUrl: config.supabaseUrl,
      },
      { status: 502 },
    );
  }
}
