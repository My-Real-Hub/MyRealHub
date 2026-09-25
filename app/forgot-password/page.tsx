import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export default function ForgotPasswordPage() {
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
          Enter the email on your account and Supabase will send password reset
          instructions.
        </p>
      </div>

      <ForgotPasswordForm />
    </section>
  );
}
