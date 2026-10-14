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

const inputBaseClassName = "public-profile-input";
const textAreaClassName = "public-profile-textarea";
const errorFieldClassName =
  "border-red-400 focus:border-red-600 focus:ring-red-100";
const initialContactProviderFormState = {
  status: "idle" as const,
  message: "",
  fieldErrors: {},
};

function inputClassName(hasError: boolean, className = inputBaseClassName) {
  return `${className} ${hasError ? errorFieldClassName : ""}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-xs leading-5 text-red-700" role="alert">
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
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${className}`}
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
    <form ref={formRef} action={formAction} className="grid min-w-0 gap-4">
      <h3 className="text-sm font-semibold text-stone-950">Send an inquiry</h3>
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="returnPath" value={returnPath} />

      <StatusMessage status={state.status} message={state.message} />

      <div className="grid gap-2">
        <label
          htmlFor="contact-name"
          className="text-sm font-medium text-stone-700"
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          defaultValue={defaultName}
          autoComplete="name"
          placeholder="Your name"
          required
          maxLength={120}
          className={inputClassName(Boolean(fieldErrors.name))}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
        />
        <FieldError id="contact-name-error" message={fieldErrors.name} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-email"
          className="text-sm font-medium text-stone-700"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={inputClassName(Boolean(fieldErrors.email))}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={
            fieldErrors.email ? "contact-email-error" : undefined
          }
        />
        <FieldError id="contact-email-error" message={fieldErrors.email} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-phone"
          className="flex items-center justify-between text-sm font-medium text-stone-700"
        >
          Phone{" "}
          <span className="text-xs font-normal text-stone-400">Optional</span>
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="Your phone number"
          maxLength={40}
          className={inputClassName(Boolean(fieldErrors.phone))}
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={
            fieldErrors.phone ? "contact-phone-error" : undefined
          }
        />
        <FieldError id="contact-phone-error" message={fieldErrors.phone} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-subject"
          className="text-sm font-medium text-stone-700"
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
          aria-describedby={
            fieldErrors.subject ? "contact-subject-error" : undefined
          }
        />
        <FieldError id="contact-subject-error" message={fieldErrors.subject} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="contact-message"
          className="text-sm font-medium text-stone-700"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          maxLength={2000}
          placeholder="Tell the provider what you need, where your property is, and your preferred timing."
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={
            fieldErrors.message ? "contact-message-error" : undefined
          }
          className={inputClassName(
            Boolean(fieldErrors.message),
            textAreaClassName,
          )}
        />
        <FieldError id="contact-message-error" message={fieldErrors.message} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="public-profile-primary-button w-full"
      >
        {pending ? "Sending..." : "Send message"}
      </button>
      <p className="text-xs leading-5 text-stone-500">
        Your name and contact details are shared with this provider.
      </p>
    </form>
  );
}
