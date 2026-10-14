import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string | string[] }>;
}) {
  const query = await searchParams;
  const showLinkError =
    query.auth === "recovery-expired" || query.auth === "recovery-required";
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Forgot Password
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Reset your MyRealHub password
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Enter the email on your account and we&apos;ll send you a secure link
          to choose a new password.
        </p>
      </div>

      <div className="space-y-4">
        {showLinkError ? (
          <p
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          >
            Open a fresh password reset link from your email. If the link has
            expired or was already used, request another one below.
          </p>
        ) : null}
        <ForgotPasswordForm />
      </div>
    </section>
  );
}
