"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContactRequest } from "@/app/providers/contact-actions";

type ContactProviderFormProps = {
  defaultEmail?: string;
  defaultName?: string;
  defaultSubject?: string;
  providerId: string;
  returnPath: string;
};

const inputBaseClassName =
  "h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const textAreaClassName =
  "min-h-32 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";
const errorFieldClassName = "border-red-400 focus:border-red-600 focus:ring-red-100";
const initialContactProviderFormState = {
  status: "idle" as const,
  message: "",
  fieldErrors: {},
};

function inputClassName(hasError: boolean, className = inputBaseClassName) {
  return `${className} ${hasError ? errorFieldClassName : ""}`;
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

function StatusMessage({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string;
}) {
  if (status === "idle" || !message) {
    return null;
  }

  const className =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      className={`rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
    </p>
  );
}

export function ContactProviderForm({
  defaultEmail = "",
  defaultName = "",
  defaultSubject = "",
  providerId,
  returnPath,
}: ContactProviderFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    submitContactRequest,
    initialContactProviderFormState,
  );
  const fieldErrors = state.fieldErrors;

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="returnPath" value={returnPath} />

      <StatusMessage status={state.status} message={state.message} />

      <div className="grid gap-2">
        <label
          htmlFor="contact-name"
          className="text-sm font-semibold text-stone-900"
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          defaultValue={defaultName}
          autoComplete="name"
          required
          maxLength={120}
          className={inputClassName(Boolean(fieldErrors.name))}
          aria-invalid={Boolean(fieldErrors.name)}
        />
        <FieldError message={fieldErrors.name} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-email"
          className="text-sm font-semibold text-stone-900"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          autoComplete="email"
          required
          className={inputClassName(Boolean(fieldErrors.email))}
          aria-invalid={Boolean(fieldErrors.email)}
        />
        <FieldError message={fieldErrors.email} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-phone"
          className="text-sm font-semibold text-stone-900"
        >
          Phone
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className={inputClassName(Boolean(fieldErrors.phone))}
          aria-invalid={Boolean(fieldErrors.phone)}
        />
        <FieldError message={fieldErrors.phone} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-subject"
          className="text-sm font-semibold text-stone-900"
        >
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          defaultValue={defaultSubject}
          required
          maxLength={160}
          className={inputClassName(Boolean(fieldErrors.subject))}
          aria-invalid={Boolean(fieldErrors.subject)}
        />
        <FieldError message={fieldErrors.subject} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-message"
          className="text-sm font-semibold text-stone-900"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          maxLength={2000}
          className={inputClassName(
            Boolean(fieldErrors.message),
            textAreaClassName,
          )}
        />
        <FieldError message={fieldErrors.message} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {pending ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
