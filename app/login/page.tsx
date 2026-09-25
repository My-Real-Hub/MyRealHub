import { LoginForm } from "@/components/auth/auth-forms";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    reason?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim() ?? "";
}

function getSafeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export default async function LogInPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const redirectTo = getSafeRedirectPath(getSearchParam(query.next));
  const reason = getSearchParam(query.reason);
  const showSavePrompt = reason === "save-provider";
  const showContactPrompt = reason === "contact-provider";

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Log In
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Access your MyRealHub account
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Log in with the email and password you used to create your MyRealHub
          account.
        </p>
        {showSavePrompt ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            Log in to save this provider to your dashboard.
          </p>
        ) : null}
        {showContactPrompt ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            Log in to send this provider a contact request. We&apos;ll
            bring you back to their profile after you sign in.
          </p>
        ) : null}
      </div>

      <LoginForm reason={reason} redirectTo={redirectTo} />
    </section>
  );
}
