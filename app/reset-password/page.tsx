import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/forgot-password?auth=recovery-required");

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Account security
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Choose a new password
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Enter and confirm your new password. After saving it, you can log in
          with the new password.
        </p>
      </div>
      <ResetPasswordForm />
    </section>
  );
}
