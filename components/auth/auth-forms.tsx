"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  DEFAULT_PROFILE_ROLE,
  getDashboardPathForRole,
  type SignUpRole,
} from "@/lib/auth/roles";
import {
  hasAuthFieldErrors,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateLoginFields,
  validateSignUpFields,
  validatePasswordFields,
  type AuthFieldErrors,
} from "@/lib/auth/validation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureAccountRole } from "@/lib/auth/account";
import { getAuthCallbackUrl } from "@/lib/auth/redirects";

type FormStatus = {
  type: "error" | "success";
  message: string;
} | null;

type SignUpFormProps = {
  initialRole?: SignUpRole;
  reason?: string | null;
  redirectTo?: string | null;
};

type LoginFormProps = {
  allowResendConfirmation?: boolean;
  reason?: string | null;
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

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-sm font-medium text-red-700" role="alert">
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

function AuthTextField({
  id,
  name,
  label,
  type,
  autoComplete,
  errorMessage,
}: {
  id: string;
  name: string;
  label: string;
  type: "text" | "email";
  autoComplete: string;
  errorMessage?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        className={inputClassName(Boolean(errorMessage))}
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage ? `${id}-error` : undefined}
        required
      />
      <FieldError id={`${id}-error`} message={errorMessage} />
    </div>
  );
}

function EyeIcon({ isVisible }: { isVisible: boolean }) {
  if (isVisible) {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5 0 9 4.5 10 8a12.7 12.7 0 0 1-2.3 4.1" />
        <path d="M6.6 6.6A12 12 0 0 0 2 12c1 3.5 5 8 10 8a10.8 10.8 0 0 0 4.2-.9" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordField({
  autoComplete,
  errorMessage,
  hasError,
  id,
  label,
  minLength,
  name,
}: {
  autoComplete: string;
  errorMessage?: string;
  hasError: boolean;
  id: string;
  label: string;
  minLength?: number;
  name: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          className={`${inputClassName(hasError)} w-full pr-12`}
          aria-invalid={hasError}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          required
        />
        <button
          type="button"
          className="absolute inset-y-1 right-1 inline-flex w-10 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          aria-label={toggleLabel}
          aria-pressed={isVisible}
          title={toggleLabel}
          onClick={() => setIsVisible((currentValue) => !currentValue)}
        >
          <EyeIcon isVisible={isVisible} />
        </button>
      </div>
      <FieldError id={`${id}-error`} message={errorMessage} />
    </div>
  );
}

function getAuthHref(
  pathname: "/login" | "/signup",
  {
    reason,
    redirectTo,
  }: {
    reason?: string | null;
    redirectTo?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (redirectTo) {
    params.set("next", redirectTo);
  }

  if (reason) {
    params.set("reason", reason);
  }

  const queryString = params.toString();

  return `${pathname}${queryString ? `?${queryString}` : ""}`;
}

export function SignUpForm({
  initialRole = DEFAULT_PROFILE_ROLE,
  reason = null,
  redirectTo = null,
}: SignUpFormProps) {
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
          emailRedirectTo: getAuthCallbackUrl(
            window.location.origin,
            redirectTo ?? getDashboardPathForRole(initialRole),
          ),
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
        const role = await ensureAccountRole(supabase, data.session.user.id);
        window.location.assign(redirectTo ?? getDashboardPathForRole(role));
        return;
      }

      form.reset();
      setStatus({
        type: "success",
        message:
          "Check your email to confirm your account before logging in. If you already have an account, log in or reset your password.",
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

        <AuthTextField
          id="signup-full-name"
          name="fullName"
          label="Full name"
          type="text"
          autoComplete="name"
          errorMessage={fieldErrors.fullName}
        />

        <AuthTextField
          id="signup-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          errorMessage={fieldErrors.email}
        />

        <PasswordField
          id="signup-password"
          name="password"
          label="Password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          hasError={Boolean(fieldErrors.password)}
          errorMessage={fieldErrors.password}
        />

        <PasswordField
          id="signup-confirm-password"
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          hasError={Boolean(fieldErrors.confirmPassword)}
          errorMessage={fieldErrors.confirmPassword}
        />

        <button
          type="submit"
          className={buttonClassName}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-sm text-stone-600">
        Already have an account?{" "}
        <Link
          href={getAuthHref("/login", { reason, redirectTo })}
          className="font-semibold text-emerald-800"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

export function LoginForm({
  reason = null,
  redirectTo = null,
  allowResendConfirmation = false,
}: LoginFormProps) {
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState<FormStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(
    allowResendConfirmation,
  );
  const [isResending, setIsResending] = useState(false);

  async function resendConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = normalizeEmail(
      String(new FormData(event.currentTarget).get("email") ?? ""),
    );
    const emailError = validateEmail(email);
    setStatus(null);
    if (emailError) {
      setStatus({ type: "error", message: emailError });
      return;
    }
    setIsResending(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getAuthCallbackUrl(
            window.location.origin,
            redirectTo,
          ),
        },
      });
      if (error) throw error;
      setStatus({
        type: "success",
        message:
          "If this account is awaiting confirmation, a new confirmation email will arrive shortly.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: getErrorMessage(
          error,
          "Confirmation email could not be sent. Please try again.",
        ),
      });
    } finally {
      setIsResending(false);
    }
  }

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(fields.email),
        password: fields.password,
      });

      if (error) {
        setShowResendConfirmation(error.code === "email_not_confirmed");
        setStatus({ type: "error", message: error.message });
        return;
      }

      if (!data.user || !data.session) {
        throw new Error("Login could not be completed. Please try again.");
      }
      const role = await ensureAccountRole(supabase, data.user.id);
      window.location.assign(redirectTo ?? getDashboardPathForRole(role));
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

        <AuthTextField
          id="login-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          errorMessage={fieldErrors.email}
        />

        <PasswordField
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          hasError={Boolean(fieldErrors.password)}
          errorMessage={fieldErrors.password}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-emerald-800"
          >
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

      {showResendConfirmation ? (
        <form
          className="mt-5 grid gap-3 border-t border-stone-200 pt-5"
          onSubmit={resendConfirmation}
          noValidate
        >
          <p className="text-sm leading-6 text-stone-600">
            Confirm your email before logging in.
          </p>
          <AuthTextField
            id="resend-confirmation-email"
            name="email"
            label="Confirmation email"
            type="email"
            autoComplete="email"
          />
          <button
            type="submit"
            className={buttonClassName}
            disabled={isResending}
          >
            {isResending ? "Sending..." : "Resend confirmation email"}
          </button>
        </form>
      ) : null}

      <p className="mt-5 text-sm text-stone-600">
        New here?{" "}
        <Link
          href={getAuthHref("/signup", { reason, redirectTo })}
          className="font-semibold text-emerald-800"
        >
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
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: getAuthCallbackUrl(
            window.location.origin,
            "/reset-password",
          ),
        },
      );

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

        <AuthTextField
          id="forgot-password-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          errorMessage={fieldErrors.email}
        />

        <button
          type="submit"
          className={buttonClassName}
          disabled={isSubmitting}
        >
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

export function ResetPasswordForm() {
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState<FormStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fields = {
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };
    const errors = validatePasswordFields(fields);
    setFieldErrors(errors);
    setStatus(null);
    if (hasAuthFieldErrors(errors)) return;
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: fields.password,
      });
      if (error) {
        setStatus({ type: "error", message: error.message });
        return;
      }
      form.reset();
      setIsComplete(true);
      const signOut = await supabase.auth.signOut({ scope: "local" });
      if (signOut.error) {
        setStatus({
          type: "success",
          message:
            "Your password was changed. Log out, then log in with your new password.",
        });
        return;
      }
      // Reload to discard pages prefetched before the recovery session ended.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?auth=password-updated");
    } catch (error) {
      setStatus({
        type: "error",
        message: getErrorMessage(
          error,
          "Your password could not be changed. Please try again.",
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
        {!isComplete ? (
          <>
            <PasswordField
              id="reset-password"
              name="password"
              label="New password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              hasError={Boolean(fieldErrors.password)}
              errorMessage={fieldErrors.password}
            />
            <PasswordField
              id="reset-confirm-password"
              name="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              hasError={Boolean(fieldErrors.confirmPassword)}
              errorMessage={fieldErrors.confirmPassword}
            />
            <p className="text-sm text-stone-500">
              Use at least {PASSWORD_MIN_LENGTH} characters.
            </p>
            <button
              type="submit"
              className={buttonClassName}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving password..." : "Save new password"}
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-800"
          >
            Back to login
          </Link>
        )}
      </form>
      <p className="mt-5 text-sm text-stone-600">
        <Link
          href="/forgot-password"
          className="font-semibold text-emerald-800"
        >
          Request another reset email
        </Link>
      </p>
    </div>
  );
}
