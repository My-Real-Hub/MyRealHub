import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";
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

    return url.protocol === "http:" || url.protocol === "https:"
      ? source
      : "";
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
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-emerald-950">
        Log in to send feedback
      </h2>
      <p className="mt-3 text-sm leading-6 text-emerald-900">
        Feedback is tied to your MyRealHub account so admins can understand
        context, follow up internally, and keep screenshot uploads private.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          href={getAuthHref("/login", source)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Log in
        </Link>
        <Link
          href={getAuthHref("/signup", source)}
          className="inline-flex h-11 items-center justify-center rounded-md border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const query = await searchParams;
  const profile = await getCurrentProfile();
  const source = getFeedbackSource(query.from);
  const reporterLabel =
    profile?.email ?? profile?.fullName ?? "Signed-in MyRealHub account";

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-8 px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Feedback
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Report a bug or suggest an improvement
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Send the MyRealHub team what you noticed. We automatically attach the
          page you came from and your account context.
        </p>
      </header>

      {profile ? (
        <FeedbackForm
          accountId={profile.id}
          initialCurrentPageUrl={source}
          reporterLabel={reporterLabel}
        />
      ) : (
        <SignInPrompt source={source} />
      )}
    </section>
  );
}
