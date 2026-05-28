"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function AuthMenu() {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    try {
      const supabase = getSupabaseClient();

      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (isMounted) {
            setIsSignedIn(Boolean(data.session));
          }
        })
        .catch(() => {
          // Keep the public auth links visible if session lookup is unavailable.
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsSignedIn(Boolean(session));
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch {
      // Keep the public auth links visible if Supabase is not configured.
    }

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });

      if (error) {
        throw error;
      }

      setIsSignedIn(false);
      router.push("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isSignedIn) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:text-stone-400"
      >
        {isSigningOut ? "Logging out..." : "Log Out"}
      </button>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
      >
        Log In
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
      >
        Sign Up
      </Link>
      <Link
        href="/signup?role=provider"
        className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 font-semibold text-white transition hover:bg-emerald-800"
      >
        Join as Provider
      </Link>
    </>
  );
}
