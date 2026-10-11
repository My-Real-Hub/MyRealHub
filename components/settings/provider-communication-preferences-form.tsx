"use client";

import { useActionState, useState } from "react";
import { saveProviderCommunicationPreferences } from "@/app/settings/actions";
import type { ContactDeliveryMethod } from "@/lib/contact-requests";

type ProviderCommunicationPreferencesFormProps = {
  acceptNewInquiries: boolean;
  contactDeliveryMethod: ContactDeliveryMethod;
  newMessageEmailEnabled: boolean;
  notificationEmail: string;
  providerProfileId: string | null;
};

const initialState = {
  status: "idle" as const,
  message: "",
  fieldErrors: {},
};

const inputClassName = "settings-input";

function StatusMessage({
  message,
  status,
}: {
  message: string;
  status: "idle" | "success" | "error";
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
      className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${className}`}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-5 rounded-xl border border-stone-200 bg-white p-4 transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-950">
          {label}
        </span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">
          {description}
        </span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative h-6 w-10 rounded-full bg-stone-200 transition peer-checked:bg-emerald-700 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-100 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none"
        />
      </span>
    </label>
  );
}

export function ProviderCommunicationPreferencesForm({
  acceptNewInquiries,
  contactDeliveryMethod,
  newMessageEmailEnabled,
  notificationEmail,
  providerProfileId,
}: ProviderCommunicationPreferencesFormProps) {
  const [state, formAction, pending] = useActionState(
    saveProviderCommunicationPreferences,
    initialState,
  );
  const [acceptsInquiries, setAcceptsInquiries] = useState(acceptNewInquiries);
  const [deliveryMethod, setDeliveryMethod] = useState(contactDeliveryMethod);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(
    newMessageEmailEnabled,
  );
  const fieldErrors = state.fieldErrors;
  const notificationEmailIsRequired =
    (acceptsInquiries && deliveryMethod === "email") || emailAlertsEnabled;
  const disabled = !providerProfileId || pending;

  return (
    <form
      id="provider-communication"
      action={formAction}
      className="settings-section settings-card"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            Inquiry preferences
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
            Choose how customers reach you and where inquiry notifications go.
          </p>
        </div>
        <span
          className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            acceptsInquiries
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-100"
              : "bg-stone-100 text-stone-600"
          }`}
        >
          {acceptsInquiries ? "Accepting inquiries" : "Inquiries paused"}
        </span>
      </div>

      <StatusMessage status={state.status} message={state.message} />

      {!providerProfileId ? (
        <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Save your public provider listing before changing inquiry delivery.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4">
        <ToggleRow
          checked={acceptsInquiries}
          description="Let customers start a conversation from your public listing."
          disabled={disabled}
          label="Accept new inquiries"
          name="acceptNewInquiries"
          onChange={setAcceptsInquiries}
        />

        <fieldset className="grid gap-3">
          <legend className="mb-3 text-sm font-medium text-stone-800">
            Deliver new inquiries to
          </legend>
          <div className="grid gap-3 md:grid-cols-2">
            {(["in_app", "email"] as const).map((method) => {
              const isSelected = deliveryMethod === method;

              return (
                <label
                  key={method}
                  className={`grid cursor-pointer gap-2 rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-emerald-700 bg-emerald-50"
                      : "border-stone-200 bg-white hover:border-emerald-200"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="contactDeliveryMethod"
                      value={method}
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => setDeliveryMethod(method)}
                      className="size-4 shrink-0 border-stone-300 accent-emerald-700 focus:ring-emerald-100"
                    />
                    <span className="text-sm font-semibold text-stone-950">
                      {method === "in_app" ? "MyRealHub inbox" : "Email relay"}
                    </span>
                  </span>
                  <span className="text-sm leading-6 text-stone-600">
                    {method === "in_app"
                      ? "Read and reply to customer messages from your dashboard."
                      : "Receive inquiries at your private notification email."}
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError message={fieldErrors.contactDeliveryMethod} />
        </fieldset>

        <ToggleRow
          checked={emailAlertsEnabled}
          description="Get an email when a new inquiry arrives in your MyRealHub inbox."
          disabled={disabled}
          label="Email alerts for inbox inquiries"
          name="newMessageEmailEnabled"
          onChange={setEmailAlertsEnabled}
        />

        <label className="grid gap-2 text-sm font-medium text-stone-800 md:max-w-xl">
          Notification email address
          <input
            name="notificationEmail"
            type="email"
            defaultValue={notificationEmail}
            autoComplete="email"
            required={notificationEmailIsRequired}
            disabled={disabled}
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors.notificationEmail)}
          />
          <span className="text-sm font-normal leading-6 text-stone-600">
            Used for email delivery and alerts. This address stays private.
          </span>
          <FieldError message={fieldErrors.notificationEmail} />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-stone-500">
          Apply these changes to how your listing receives inquiries.
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="settings-primary-button shrink-0"
        >
          {pending ? "Saving preferences..." : "Save inquiry preferences"}
        </button>
      </div>
    </form>
  );
}
