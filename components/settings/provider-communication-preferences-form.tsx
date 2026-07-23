"use client";

import { useActionState, useState } from "react";
import { saveProviderCommunicationPreferences } from "@/app/settings/actions";
import {
  contactDeliveryMethodLabels,
  type ContactDeliveryMethod,
} from "@/lib/contact-requests";

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

const inputClassName =
  "h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

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
      className={`mt-5 rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
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
      className={`flex cursor-pointer items-start gap-3 rounded-md border border-stone-200 bg-white p-4 transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-100"
      />
      <span>
        <span className="block text-sm font-semibold text-stone-950">
          {label}
        </span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">
          {description}
        </span>
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
  const [acceptsInquiries, setAcceptsInquiries] =
    useState(acceptNewInquiries);
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
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Inquiry preferences
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            How clients can reach you
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            Decide whether your public contact form is open, where new
            inquiries should be delivered, and whether in-app messages should
            trigger email alerts.
          </p>
        </div>
        <span
          className={`w-fit rounded-md px-3 py-1 text-xs font-semibold ${
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
          description="When this is off, public Contact buttons show that you are not accepting new inquiries."
          disabled={disabled}
          label="Accept new inquiries"
          name="acceptNewInquiries"
          onChange={setAcceptsInquiries}
        />

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-stone-900">
            Contact delivery
          </legend>
          <div className="grid gap-3 md:grid-cols-2">
            {(["in_app", "email"] as const).map((method) => {
              const isSelected = deliveryMethod === method;

              return (
                <label
                  key={method}
                  className={`grid cursor-pointer gap-2 rounded-md border p-4 transition ${
                    isSelected
                      ? "border-emerald-200 bg-emerald-50"
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
                      className="size-4 border-stone-300 text-emerald-700 focus:ring-emerald-100"
                    />
                    <span className="text-sm font-semibold text-stone-950">
                      {contactDeliveryMethodLabels[method]}
                    </span>
                  </span>
                  <span className="text-sm leading-6 text-stone-600">
                    {method === "in_app"
                      ? "Create a MyRealHub conversation in your provider inbox."
                      : "Securely relay inquiries to your notification email without showing that address publicly."}
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError message={fieldErrors.contactDeliveryMethod} />
        </fieldset>

        <ToggleRow
          checked={emailAlertsEnabled}
          description="Send an email alert when a new in-app inquiry is created. Turning this off does not disable in-app messaging."
          disabled={disabled}
          label="Email me about new in-app messages"
          name="newMessageEmailEnabled"
          onChange={setEmailAlertsEnabled}
        />

        <label className="grid gap-2 text-sm font-semibold text-stone-900 md:max-w-xl">
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
            This address is used for email alerts and direct-to-email relay. It
            is stored privately and is not shown on public provider profiles.
          </span>
          <FieldError message={fieldErrors.notificationEmail} />
        </label>
      </div>

      <div className="mt-6 flex justify-end border-t border-stone-200 pt-5">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {pending ? "Saving preferences..." : "Save inquiry preferences"}
        </button>
      </div>
    </form>
  );
}
