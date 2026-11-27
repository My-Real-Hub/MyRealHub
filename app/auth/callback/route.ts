import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthCallback } from "@/lib/auth/callback";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const path = await resolveAuthCallback(
    request.nextUrl.searchParams,
    getServerSupabaseClient,
  );
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
