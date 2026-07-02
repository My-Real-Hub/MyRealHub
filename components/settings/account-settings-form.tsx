"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { saveAccountSettings } from "@/app/settings/actions";
import {
  isProviderProfileImageType,
  PROVIDER_PROFILE_IMAGE_MAX_SIZE,
  PROVIDER_PROFILE_IMAGES_BUCKET,
} from "@/lib/providers/profile-image";
import { PROFILE_BIO_MAX_LENGTH } from "@/lib/settings/profile";
import { getSupabaseClient } from "@/lib/supabase/client";

type AccountSettingsFormProps = {
  accountId: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  bio: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  roleLabel: string;
};

type UploadStatus = {
  type: "idle" | "uploading" | "success" | "error";
  message: string;
};

const initialState = {
  status: "idle" as const,
  message: "",
  fieldErrors: {},
};

const inputClassName =
  "h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "MR";
}

function getUploadPath(accountId: string, file: File) {
  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${accountId}/${randomPart}.${extension}`;
}

function getPublicImageUrl(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);

    return url.hostname === "example.com" ||
      url.hostname.endsWith(".example.com")
      ? ""
      : value;
  } catch {
    return value.startsWith("/") ? value : "";
  }
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

export function AccountSettingsForm({
  accountId,
  avatarPath,
  avatarUrl,
  bio,
  displayName,
  email,
  phone,
  roleLabel,
}: AccountSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    saveAccountSettings,
    initialState,
  );
  const [biography, setBiography] = useState(bio ?? "");
  const [imagePath, setImagePath] = useState(avatarPath ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(
    getPublicImageUrl(avatarUrl),
  );
  const [objectPreviewUrl, setObjectPreviewUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    type: "idle",
    message: "",
  });
  const biographyLength = biography.length;
  const biographyIsOverLimit = biographyLength > PROFILE_BIO_MAX_LENGTH;
  const isUploading = uploadStatus.type === "uploading";
  const isBusy = pending || isUploading;
  const fieldErrors = state.fieldErrors;
  const fallbackName = displayName ?? email ?? "MyRealHub";

  useEffect(() => {
    return () => {
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
      }
    };
  }, [objectPreviewUrl]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isProviderProfileImageType(file.type)) {
      setUploadStatus({
        type: "error",
        message: "Choose a JPG, PNG, or WebP image.",
      });
      event.target.value = "";
      return;
    }

    if (file.size > PROVIDER_PROFILE_IMAGE_MAX_SIZE) {
      setUploadStatus({
        type: "error",
        message: "Image must be 5 MB or smaller.",
      });
      event.target.value = "";
      return;
    }

    if (objectPreviewUrl) {
      URL.revokeObjectURL(objectPreviewUrl);
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setObjectPreviewUrl(localPreviewUrl);
    setImagePreviewUrl(localPreviewUrl);
    setUploadStatus({
      type: "uploading",
      message: "Uploading image...",
    });

    const supabase = getSupabaseClient();
    const storagePath = getUploadPath(accountId, file);
    const { error } = await supabase.storage
      .from(PROVIDER_PROFILE_IMAGES_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      setImagePreviewUrl(getPublicImageUrl(avatarUrl));
      setImagePath(avatarPath ?? "");
      setUploadStatus({
        type: "error",
        message: error.message,
      });
      event.target.value = "";
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(PROVIDER_PROFILE_IMAGES_BUCKET)
      .getPublicUrl(storagePath);

    setImagePath(storagePath);
    setImagePreviewUrl(publicUrl);
    setUploadStatus({
      type: "success",
      message: "Image uploaded. Save settings to apply it.",
    });
  }

  return (
    <form action={formAction} className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <input type="hidden" name="profileImagePath" value={imagePath} />

      {state.status !== "idle" ? (
        <p
          className={`m-6 rounded-md border px-4 py-3 text-sm leading-6 ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <section id="account" className="scroll-mt-28 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Account
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">
              Account identity
            </h2>
          </div>
          <span className="w-fit rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            {roleLabel}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-stone-900">
            Display name
            <input
              name="displayName"
              type="text"
              defaultValue={displayName ?? ""}
              autoComplete="name"
              maxLength={120}
              required
              className={inputClassName}
              aria-invalid={Boolean(fieldErrors.displayName)}
            />
            <FieldError message={fieldErrors.displayName} />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-stone-900">
            Email
            <input
              name="email"
              type="email"
              defaultValue={email ?? ""}
              autoComplete="email"
              required
              className={inputClassName}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            <FieldError message={fieldErrors.email} />
          </label>
        </div>
      </section>

      <section
        id="profile"
        className="scroll-mt-28 border-t border-stone-200 p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Profile
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">
          Photo and biography
        </h2>

        <div className="mt-6 grid gap-6 lg:grid-cols-[12rem_1fr] lg:items-start">
          <div className="grid gap-3">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt={`${fallbackName} profile`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold text-stone-500">
                  {getInitials(fallbackName)}
                </span>
              )}
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800 transition hover:border-stone-950">
              {isUploading ? "Uploading..." : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={isBusy}
                onChange={handleImageChange}
              />
            </label>
            <p className="text-xs leading-5 text-stone-500">
              JPG, PNG, or WebP. Max 5 MB.
            </p>
            {uploadStatus.type !== "idle" ? (
              <p
                className={`text-sm font-medium ${
                  uploadStatus.type === "error"
                    ? "text-red-700"
                    : uploadStatus.type === "success"
                      ? "text-emerald-700"
                      : "text-stone-600"
                }`}
              >
                {uploadStatus.message}
              </p>
            ) : null}
            <FieldError message={fieldErrors.profileImagePath} />
          </div>

          <label className="grid gap-2 text-sm font-semibold text-stone-900">
            Biography
            <textarea
              name="bio"
              value={biography}
              onChange={(event) => setBiography(event.target.value)}
              maxLength={
                bio && bio.length > PROFILE_BIO_MAX_LENGTH
                  ? undefined
                  : PROFILE_BIO_MAX_LENGTH
              }
              className={`min-h-40 w-full resize-y rounded-md border bg-white px-3 py-3 text-sm font-normal leading-7 text-stone-950 outline-none transition focus:ring-4 ${
                biographyIsOverLimit
                  ? "border-red-400 focus:border-red-600 focus:ring-red-100"
                  : "border-stone-300 focus:border-emerald-700 focus:ring-emerald-100"
              }`}
              aria-invalid={biographyIsOverLimit || Boolean(fieldErrors.bio)}
            />
            <span
              className={`text-right text-xs font-semibold ${
                biographyIsOverLimit ? "text-red-700" : "text-stone-500"
              }`}
              aria-live="polite"
            >
              {biographyLength}/{PROFILE_BIO_MAX_LENGTH} characters
            </span>
            <FieldError message={fieldErrors.bio} />
          </label>
        </div>
      </section>

      <section
        id="communication"
        className="scroll-mt-28 border-t border-stone-200 p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Communication
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-950">
          Contact details
        </h2>

        <label className="mt-6 grid max-w-xl gap-2 text-sm font-semibold text-stone-900">
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            autoComplete="tel"
            maxLength={40}
            className={inputClassName}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          <FieldError message={fieldErrors.phone} />
        </label>
      </section>

      <div className="flex justify-end border-t border-stone-200 p-6">
        <button
          type="submit"
          disabled={isBusy || biographyIsOverLimit}
          className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {pending ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
