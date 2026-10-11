import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import {
  FeedbackGuide,
  FeedbackIcon,
  feedbackPrimaryButton,
  feedbackSecondaryButton,
} from "@/components/feedback/feedback-ui";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";

type FeedbackPageProps = {
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getFeedbackSource(value: string | string[] | undefined) {
  const source = getSearchParam(value)?.trim() ?? "";

  if (!source || source.length > 2048) {
    return "";
  }

  if (source.startsWith("/") && !source.startsWith("//")) {
    return source;
  }

  try {
    const url = new URL(source);

    return url.protocol === "http:" || url.protocol === "https:" ? source : "";
  } catch {
    return "";
  }
}

function getAuthHref(pathname: "/login" | "/signup", source: string) {
  const params = new URLSearchParams({
    next: `/feedback${source ? `?from=${encodeURIComponent(source)}` : ""}`,
    reason: "feedback",
  });

  return `${pathname}?${params.toString()}`;
}

function SignInPrompt({ source }: { source: string }) {
  return (
    <section className="flex flex-col items-start rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <FeedbackIcon name="lock" className="size-6" />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-stone-950">
        Log in to send feedback
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-stone-600">
        Use your MyRealHub account to report a problem or share an idea. You can
        also attach a screenshot that only the admin team can view.
      </p>
      <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href={getAuthHref("/login", source)}
          className={feedbackPrimaryButton}
        >
          Log in
        </Link>
        <Link
          href={getAuthHref("/signup", source)}
          className={feedbackSecondaryButton}
        >
          Create account
        </Link>
      </div>
    </section>
  );
}

export default async function FeedbackPage({
  searchParams,
}: FeedbackPageProps) {
  const query = await searchParams;
  const profile = await getCurrentProfile();
  const source = getFeedbackSource(query.from);
  const reporterLabel =
    profile?.email ?? profile?.fullName ?? "Signed-in MyRealHub account";

  return (
    <div className="min-h-screen border-t border-stone-200 bg-[#f6f7f5]">
      <section className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Feedback
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
              Share your feedback
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
              Report a problem or share an idea to help improve MyRealHub.
            </p>
          </div>
          <Link
            href={profile ? getDashboardPathForRole(profile.role) : "/search"}
            className={`${feedbackSecondaryButton} shrink-0 self-start sm:self-auto`}
          >
            <ProviderDashboardIcon
              name={profile ? "arrow" : "search"}
              className={`size-[18px] ${profile ? "rotate-180" : ""}`}
            />
            {profile ? "Back to dashboard" : "Browse directory"}
          </Link>
        </header>
        {profile ? (
          <FeedbackForm
            accountId={profile.id}
            initialCurrentPageUrl={source}
            reporterLabel={reporterLabel}
          />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <SignInPrompt source={source} />
            <aside>
              <FeedbackGuide />
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
