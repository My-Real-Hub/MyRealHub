import { SignUpForm } from "@/components/auth/auth-forms";
import { getSignUpRole } from "@/lib/auth/roles";

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

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const initialRole = getSignUpRole(params.role);
  const isProviderSignup = initialRole === "provider";
  const redirectTo = getSafeRedirectPath(getSearchParam(params.next));
  const reason = getSearchParam(params.reason);
  const showContactPrompt = reason === "contact-provider";

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Sign Up
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          {isProviderSignup
            ? "Join the provider directory"
            : "Create your MyRealHub account"}
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          {isProviderSignup
            ? "Create a provider account to manage your listing and service profile."
            : "Create an account to save providers and manage your MyRealHub activity."}
        </p>
        {showContactPrompt ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            Create an account to send this provider an in-app contact request.
            We&apos;ll bring you back to their profile after sign-up when your
            session is active.
          </p>
        ) : null}
      </div>

      <SignUpForm
        initialRole={initialRole}
        reason={reason}
        redirectTo={redirectTo}
      />
    </section>
  );
}
