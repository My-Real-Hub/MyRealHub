"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DEFAULT_PROFILE_ROLE,
  canJoinAsProvider,
  getDashboardPathForRole,
  getProfileRoleForUser,
  type ProfileRole,
} from "@/lib/auth/roles";
import { getSupabaseClient } from "@/lib/supabase/client";
import { NavigationLink } from "@/components/layout/navigation-link";

export function AuthMenu({
  initialRole,
  initialUserId,
}: {
  initialRole: ProfileRole | null;
  initialUserId: string | null;
}) {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(Boolean(initialRole));
  const [dashboardPath, setDashboardPath] = useState(
    getDashboardPathForRole(initialRole ?? DEFAULT_PROFILE_ROLE),
  );
  const [profileRole, setProfileRole] = useState<ProfileRole | null>(
    initialRole,
  );
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let currentUserId = initialUserId;
    let roleRequest = 0;

    try {
      const supabase = getSupabaseClient();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) {
          return;
        }

        const request = ++roleRequest;
        const nextUserId = session?.user.id ?? null;
        setIsSignedIn(Boolean(session));

        if (!nextUserId || nextUserId !== currentUserId) {
          setProfileRole(null);
          setDashboardPath(getDashboardPathForRole(DEFAULT_PROFILE_ROLE));
        }
        currentUserId = nextUserId;

        if (!nextUserId) {
          return;
        }

        getProfileRoleForUser(supabase, nextUserId)
          .then((role) => {
            if (isMounted && request === roleRequest) {
              setProfileRole(role);
              setDashboardPath(
                getDashboardPathForRole(role ?? DEFAULT_PROFILE_ROLE),
              );
            }
          })
          .catch(() => {
            if (isMounted && request === roleRequest) {
              setProfileRole(null);
              setDashboardPath(getDashboardPathForRole(DEFAULT_PROFILE_ROLE));
            }
          });
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
  }, [initialUserId]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });

      if (error) {
        throw error;
      }

      setIsSignedIn(false);
      setProfileRole(null);
      setDashboardPath(getDashboardPathForRole(DEFAULT_PROFILE_ROLE));
      router.push("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isSignedIn) {
    return (
      <>
        {profileRole && canJoinAsProvider(profileRole) ? (
          <NavigationLink href="/signup?role=provider">
            Join as Provider
          </NavigationLink>
        ) : null}
        {profileRole === "provider" ? (
          <NavigationLink href="/dashboard">Consumer tools</NavigationLink>
        ) : null}
        {profileRole === "user" || profileRole === "provider" ? (
          <NavigationLink href="/settings">Settings</NavigationLink>
        ) : null}
        <NavigationLink href={dashboardPath}>Dashboard</NavigationLink>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 px-3 py-2 text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:text-stone-400"
        >
          {isSigningOut ? "Logging out..." : "Log Out"}
        </button>
      </>
    );
  }

  return (
    <>
      <NavigationLink href="/login" relatedPath="/forgot-password">
        Log In
      </NavigationLink>
      <NavigationLink href="/signup">Sign Up</NavigationLink>
      <Link
        href="/signup?role=provider"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-3 py-2 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        Join as Provider
      </Link>
    </>
  );
}
