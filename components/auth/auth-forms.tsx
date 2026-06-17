"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  DEFAULT_PROFILE_ROLE,
  getDashboardPathForRole,
  getProfileRoleForUser,
  type SignUpRole,
} from "@/lib/auth/roles";
import {
  hasAuthFieldErrors,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateLoginFields,
  validateSignUpFields,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { getSupabaseClient } from "@/lib/supabase/client";

type FormStatus = {
  type: "error" | "success";
  message: string;
} | null;

type SignUpFormProps = {
  initialRole?: SignUpRole;
};

type LoginFormProps = {
  redirectTo?: string | null;
};

const fieldClassName =
  "h-12 rounded-md border border-stone-200 bg-white px-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const errorFieldClassName =
  "border-red-300 focus:border-red-600 focus:ring-red-100";

const buttonClassName =
  "h-12 rounded-md bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-400";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {message}
    </p>
  );
}

function StatusMessage({ status }: { status: FormStatus }) {
  if (!status) {
    return null;
  }

  const className =
    status.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      className={`rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
      role={status.type === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {status.message}
    </p>
  );
}

function inputClassName(hasError: boolean) {
  return `${fieldClassName} ${hasError ? errorFieldClassName : ""}`;
}

export function SignUpForm({
  initialRole = DEFAULT_PROFILE_ROLE,
}: SignUpFormProps) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState<FormStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fields = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };
    const errors = validateSignUpFields(fields);

    setFieldErrors(errors);
    setStatus(null);

    if (hasAuthFieldErrors(errors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(fields.email),
        password: fields.password,
        options: {
          data: {
            full_name: fields.fullName.trim(),
            role: initialRole,
          },
        },
      });

      if (error) {
        setStatus({ type: "error", message: error.message });
        return;
      }

      if (data.session) {
        router.push(getDashboardPathForRole(initialRole));
        router.refresh();
        return;
      }

      form.reset();
      setStatus({
        type: "success",
        message:
          "Account created. Check your email to confirm your account before logging in.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: getErrorMessage(error, "Sign up failed. Please try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <StatusMessage status={status} />

        <label
          htmlFor="signup-full-name"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Full name
          <input
            id="signup-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            className={inputClassName(Boolean(fieldErrors.fullName))}
            aria-invalid={Boolean(fieldErrors.fullName)}
            required
          />
          <FieldError message={fieldErrors.fullName} />
        </label>

        <label
          htmlFor="signup-email"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Email
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            className={inputClassName(Boolean(fieldErrors.email))}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          <FieldError message={fieldErrors.email} />
        </label>

        <label
          htmlFor="signup-password"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Password
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            className={inputClassName(Boolean(fieldErrors.password))}
            aria-invalid={Boolean(fieldErrors.password)}
            required
          />
          <FieldError message={fieldErrors.password} />
        </label>

        <label
          htmlFor="signup-confirm-password"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Confirm password
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            className={inputClassName(Boolean(fieldErrors.confirmPassword))}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            required
          />
          <FieldError message={fieldErrors.confirmPassword} />
        </label>

        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-800">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState<FormStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const fields = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
    const errors = validateLoginFields(fields);

    setFieldErrors(errors);
    setStatus(null);

    if (hasAuthFieldErrors(errors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(fields.email),
        password: fields.password,
      });

      if (error) {
        setStatus({ type: "error", message: error.message });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const role = user
        ? await getProfileRoleForUser(supabase, user.id)
        : DEFAULT_PROFILE_ROLE;

      router.push(
        redirectTo ?? getDashboardPathForRole(role ?? DEFAULT_PROFILE_ROLE),
      );
      router.refresh();
    } catch (error) {
      setStatus({
        type: "error",
        message: getErrorMessage(error, "Login failed. Please try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <StatusMessage status={status} />

        <label
          htmlFor="login-email"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Email
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            className={inputClassName(Boolean(fieldErrors.email))}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          <FieldError message={fieldErrors.email} />
        </label>

        <label
          htmlFor="login-password"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Password
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={inputClassName(Boolean(fieldErrors.password))}
            aria-invalid={Boolean(fieldErrors.password)}
            required
          />
          <FieldError message={fieldErrors.password} />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/forgot-password" className="text-sm font-semibold text-emerald-800">
            Forgot password?
          </Link>
          <button
            type="submit"
            className={`${buttonClassName} sm:min-w-32`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </div>
      </form>

      <p className="mt-5 text-sm text-stone-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-emerald-800">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState<FormStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmail(normalizedEmail);
    const errors: AuthFieldErrors = emailError ? { email: emailError } : {};

    setFieldErrors(errors);
    setStatus(null);

    if (hasAuthFieldErrors(errors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

      if (error) {
        setStatus({ type: "error", message: error.message });
        return;
      }

      form.reset();
      setStatus({
        type: "success",
        message:
          "If an account exists for that email, password reset instructions will arrive shortly.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: getErrorMessage(
          error,
          "Password reset request failed. Please try again.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <StatusMessage status={status} />

        <label
          htmlFor="forgot-password-email"
          className="flex flex-col gap-2 text-sm font-medium text-stone-700"
        >
          Email
          <input
            id="forgot-password-email"
            name="email"
            type="email"
            autoComplete="email"
            className={inputClassName(Boolean(fieldErrors.email))}
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          <FieldError message={fieldErrors.email} />
        </label>

        <button type="submit" className={buttonClassName} disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reset email"}
        </button>
      </form>

      <p className="mt-5 text-sm text-stone-600">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-emerald-800">
          Back to login
        </Link>
      </p>
    </div>
  );
}
