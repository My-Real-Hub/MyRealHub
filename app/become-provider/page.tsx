import Link from "next/link";
import { redirect } from "next/navigation";
import { ProviderOnboardingForm } from "@/components/auth/provider-onboarding-form";
import { requireProfileCapability } from "@/lib/auth/session";

export default async function BecomeProviderPage() {
  const profile = await requireProfileCapability("manage_account_settings");
  if (profile.role === "provider") redirect("/provider/dashboard");

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Join as Provider</p>
      <h1 className="mt-3 text-3xl font-semibold text-stone-950">Add provider tools to your account</h1>
      <p className="mt-4 leading-7 text-stone-600">
        Use your current login to create and manage a provider listing. You keep
        your saved providers, conversations, and customer tools.
      </p>
      <p className="mt-3 leading-7 text-stone-600">
        After continuing, you can set up your listing from the provider dashboard.
        Your listing stays private until you submit it and it is approved.
      </p>
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <ProviderOnboardingForm />
      </div>
      <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded text-sm font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
        Back to customer dashboard
      </Link>
    </section>
  );
}
