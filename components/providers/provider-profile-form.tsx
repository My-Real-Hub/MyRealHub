"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { saveProviderProfile } from "@/app/provider/dashboard/actions";
import {
  getProviderProfileFormFingerprint,
  getProviderProfileFormValues,
  getProviderProfileListingState,
  getProviderProfileSnapshotFingerprint,
  initialProviderProfileFormState,
  type ProviderProfileFormState,
  type ProviderProfileStatus,
  type ProviderListingReviewStatus,
} from "@/lib/providers/profile-form";
import {
  isProviderProfileImageType,
  PROVIDER_PROFILE_IMAGE_MAX_SIZE,
  PROVIDER_PROFILE_IMAGES_BUCKET,
} from "@/lib/providers/profile-image";
import { getSupabaseClient } from "@/lib/supabase/client";

export type ProviderProfileFormData = {
  id: string;
  revision: string;
  details_revision: string;
  serviceRegionIds: string[];
  category_id: string | null;
  business_name: string | null;
  display_name: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  profile_image_path: string | null;
  profile_image_url: string | null;
  status: ProviderProfileStatus;
  review_status: ProviderListingReviewStatus | null;
  languageIds: string[];
  specialtyIds: string[];
};

export type ProviderProfileCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type ProviderProfileLanguageOption = {
  id: string;
  name: string;
  slug: string;
};

export type ProviderProfileSpecialtyOption = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
};

type ProviderProfileFormProps = {
  profile: ProviderProfileFormData | null;
  categories: ProviderProfileCategoryOption[];
  languages: ProviderProfileLanguageOption[];
  specialties: ProviderProfileSpecialtyOption[];
  accountId: string;
  accountBio?: string | null;
  accountEmail: string | null;
  accountFullName: string | null;
  accountPhone?: string | null;
  accountProfileImagePath?: string | null;
  accountProfileImageUrl?: string | null;
};

type UploadStatus = {
  type: "idle" | "uploading" | "success" | "error";
  message: string;
};

const inputBaseClassName = "settings-input";

const textAreaClassName =
  "min-h-36 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-normal leading-7 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const errorFieldClassName =
  "border-red-300 focus:border-red-600 focus:ring-red-100";

const labelClassName = "flex flex-col gap-2 text-sm font-medium text-stone-800";

const sectionClassName = "grid min-w-0 gap-5 border-t border-stone-100 pt-6";

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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
  state,
  pending,
}: {
  state: ProviderProfileFormState;
  pending: boolean;
}) {
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (pending || (state.status !== "error" && !state.alreadyPending) || !state.message) {
      return;
    }

    // Reveal errors and unchanged-submission acknowledgements, including repeats,
    // without moving focus during typing or while a save is pending.
    messageRef.current?.focus({ preventScroll: true });
    messageRef.current?.scrollIntoView({ behavior: "instant", block: "center" });
  }, [state, pending]);

  const { status, message } = state;
  if (status === "idle" || !message) {
    return null;
  }

  const className =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 focus:ring-emerald-600"
      : "border-red-200 bg-red-50 text-red-800 focus:ring-red-600";

  return (
    <p
      ref={messageRef}
      tabIndex={status === "error" || state.alreadyPending ? -1 : undefined}
      className={`rounded-md border px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
    </p>
  );
}

function UploadMessage({ status }: { status: UploadStatus }) {
  if (status.type === "idle") {
    return null;
  }

  const className =
    status.type === "error"
      ? "text-red-700"
      : status.type === "success"
        ? "text-emerald-700"
        : "text-stone-600";

  return (
    <p className={`text-sm font-medium ${className}`} aria-live="polite">
      {status.message}
    </p>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-stone-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

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
  const extension = extensionByMimeType[file.type] ?? "jpg";
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${accountId}/${randomPart}.${extension}`;
}

function getReadableFileSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function isSpecialtyAvailable(
  specialty: ProviderProfileSpecialtyOption,
  categoryId: string,
) {
  return (
    !categoryId ||
    specialty.category_id === null ||
    specialty.category_id === categoryId
  );
}

export function ProviderProfileForm({
  profile: initialProfile,
  categories,
  languages,
  specialties,
  accountId,
  accountBio = null,
  accountEmail,
  accountFullName,
  accountPhone = null,
  accountProfileImagePath = null,
  accountProfileImageUrl = null,
}: ProviderProfileFormProps) {
  // Keep the displayed content and its revision together across other forms' revalidation.
  const [profile] = useState(initialProfile);
  const [textValues, setTextValues] = useState(() => ({
    fullName: profile ? profile.display_name ?? "" : accountFullName ?? "",
    businessName: profile?.business_name ?? "",
    bio: profile ? profile.bio ?? "" : accountBio ?? "",
    email: profile ? profile.email ?? "" : accountEmail ?? "",
    phone: profile ? profile.phone ?? "" : accountPhone ?? "",
    websiteUrl: profile?.website_url ?? "",
    city: profile?.city ?? "",
    province: profile?.province_state ?? "",
    country: profile ? profile.country ?? "" : "Canada",
  }));
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    profile?.category_id ?? "",
  );
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState(
    profile?.specialtyIds ?? [],
  );
  const [selectedLanguageIds, setSelectedLanguageIds] = useState(
    profile?.languageIds ?? [],
  );
  const [pendingIntent, setPendingIntent] = useState<
    "draft" | "submit" | "reactivate" | null
  >(null);
  const [languageSearch, setLanguageSearch] = useState("");
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const [imagePath, setImagePath] = useState(profile ? profile.profile_image_path ?? "" : accountProfileImagePath ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(profile ? profile.profile_image_url ?? "" : accountProfileImageUrl ?? "");
  const [removeImage, setRemoveImage] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    type: "idle",
    message: "",
  });
  const detailsFingerprint = getProviderProfileFormFingerprint({
    ...textValues,
    categoryId: selectedCategoryId,
    languageIds: selectedLanguageIds,
    specialtyIds: selectedSpecialtyIds,
    profileImagePath: imagePath,
  }, imagePreviewUrl, removeImage);
  const [state, formAction, pending] = useActionState(
    async (previousState: ProviderProfileFormState, formData: FormData) => {
      // Capture the submitted values before awaiting; later typing stays unsaved.
      const submittedFingerprint = getProviderProfileFormFingerprint(
        getProviderProfileFormValues(formData),
        imagePreviewUrl,
        formData.get("removeProfileImage") === "yes",
      );
      const result = await saveProviderProfile(previousState, formData);
      return {
        ...result,
        savedDetailsFingerprint: result.status === "success"
          ? submittedFingerprint
          : previousState.savedDetailsFingerprint,
      };
    },
    {
      ...initialProviderProfileFormState,
      revision: profile?.details_revision ?? "0",
      listingRevision: profile?.revision ?? "0",
      listingStatus: profile?.status,
      reviewStatus: profile?.review_status ?? null,
      savedDetailsFingerprint: detailsFingerprint,
    },
  );

  useEffect(() => {
    return () => {
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
      }
    };
  }, [objectPreviewUrl]);

  const fieldErrors = state.fieldErrors;
  const isUploading = uploadStatus.type === "uploading";
  const isBusy = pending || isUploading;
  const isSavingDraft = pending && pendingIntent === "draft";
  const isSubmitting = pending && pendingIntent === "submit";
  const isRequestingReactivation = pending && pendingIntent === "reactivate";
  // Accept newer status metadata without replacing this editor's pinned inputs/token.
  const { status: listingStatus, reviewStatus } = getProviderProfileListingState(state, initialProfile);
  const isInactiveProfile = listingStatus === "inactive";
  const isUnchangedPending = (listingStatus === "pending_approval" || reviewStatus === "pending_edit") &&
    detailsFingerprint === state.savedDetailsFingerprint;
  const isUnchangedPublished = listingStatus === "active" && reviewStatus !== "draft" &&
    detailsFingerprint === state.savedDetailsFingerprint;
  const expectedDetailsRevision = initialProfile &&
    getProviderProfileSnapshotFingerprint(initialProfile) === state.savedDetailsFingerprint &&
    BigInt(initialProfile.details_revision) > BigInt(state.revision ?? "0")
    ? initialProfile.details_revision
    : state.revision ?? profile?.details_revision ?? "0";
  const approvalIntent = isInactiveProfile ? "reactivate" : "submit";
  const fallbackName =
    profile?.display_name ??
    profile?.business_name ??
    accountFullName ??
    "MyRealHub";
  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  );
  const availableSpecialties = useMemo(
    () =>
      specialties.filter((specialty) =>
        isSpecialtyAvailable(specialty, selectedCategoryId),
      ),
    [selectedCategoryId, specialties],
  );
  const unavailableSpecialtyIds = selectedSpecialtyIds.filter(id => !availableSpecialties.some(specialty => specialty.id === id));
  const selectedLanguages = languages.filter((language) =>
    selectedLanguageIds.includes(language.id),
  );
  const filteredLanguages = useMemo(() => {
    const normalizedSearch = languageSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return languages;
    }

    return languages.filter(
      (language) =>
        language.name.toLowerCase().includes(normalizedSearch) ||
        language.slug.toLowerCase().includes(normalizedSearch),
    );
  }, [languageSearch, languages]);
  const hasLookupOptions =
    categories.length > 0 && languages.length > 0 && specialties.length > 0;

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadStatus({ type: "idle", message: "" });

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

    const previousImagePath = imagePath;
    const previousImageUrl = imagePreviewUrl;
    const localPreviewUrl = URL.createObjectURL(file);
    setObjectPreviewUrl(localPreviewUrl);
    setImagePreviewUrl(localPreviewUrl);
    setUploadStatus({
      type: "uploading",
      message: `Uploading ${getReadableFileSize(file.size)} image...`,
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
      setImagePreviewUrl(previousImageUrl);
      setImagePath(previousImagePath);
      setUploadStatus({
        type: "error",
        message: "The image could not be uploaded. Your previous selection is unchanged. Please try again.",
      });
      event.target.value = "";
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(PROVIDER_PROFILE_IMAGES_BUCKET)
      .getPublicUrl(storagePath);

    setRemoveImage(false);
    setImagePath(storagePath);
    setImagePreviewUrl(publicUrl);
    setUploadStatus({
      type: "success",
      message: "Image uploaded. Save the profile to use it.",
    });
  }

  function handleCategoryChange(value: string) {
    setSelectedCategoryId(value);
    setSelectedSpecialtyIds((currentIds) =>
      currentIds.filter((specialtyId) => {
        const specialty = specialties.find((item) => item.id === specialtyId);

        return specialty ? isSpecialtyAvailable(specialty, value) : false;
      }),
    );
  }

  function handleSpecialtyToggle(specialtyId: string, checked: boolean) {
    setSelectedSpecialtyIds((currentIds) => {
      if (checked) {
        return currentIds.includes(specialtyId)
          ? currentIds
          : [...currentIds, specialtyId];
      }

      return currentIds.filter((id) => id !== specialtyId);
    });
  }

  function handleLanguageToggle(languageId: string, checked: boolean) {
    setSelectedLanguageIds((currentIds) => {
      if (checked) {
        return currentIds.includes(languageId)
          ? currentIds
          : [...currentIds, languageId];
      }

      return currentIds.filter((id) => id !== languageId);
    });
  }

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      <input name="profileImagePath" type="hidden" value={imagePath} />
      <input name="expectedDetailsRevision" type="hidden" value={expectedDetailsRevision} />
      <input name="removeProfileImage" type="hidden" value={removeImage ? "yes" : "no"} />
      {selectedLanguageIds.map((languageId) => (
        <input
          key={languageId}
          name="languageIds"
          type="hidden"
          value={languageId}
        />
      ))}
      {selectedSpecialtyIds.map(specialtyId => <input key={specialtyId} name="specialtyIds" type="hidden" value={specialtyId} />)}
      <StatusMessage state={state} pending={pending} />
      <p className="text-sm leading-6 text-stone-600">Your public listing name, bio, and photo are separate from your personal profile. Saving listing details or service areas requires approval before publication.</p>
      <button type="button" disabled={isBusy} className="settings-secondary-button w-fit" onClick={() => window.location.reload()}>Reload listing (discards unsaved edits)</button>

      {!hasLookupOptions ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Service options could not be loaded. Reload the page or try again later.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-start">
        <div className="grid gap-4">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
            <div className="grid aspect-square place-items-center">
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt={`${fallbackName} profile`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-4xl font-semibold text-stone-500">
                  {getInitials(fallbackName)}
                </span>
              )}
            </div>
          </div>

          <label
            htmlFor="provider-profile-image"
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950 focus-within:ring-4 focus-within:ring-stone-100"
          >
            {isUploading ? "Uploading..." : "Upload image"}
            <input
              id="provider-profile-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleImageChange}
              disabled={isBusy}
            />
          </label>
          <p className="text-xs leading-5 text-stone-500">
            JPG, PNG, or WebP. Max 5 MB.
          </p>
          <UploadMessage status={uploadStatus} />
          {imagePreviewUrl ? <button type="button" disabled={isBusy} className="settings-secondary-button" onClick={() => { setImagePath(""); setImagePreviewUrl(""); setRemoveImage(true); setUploadStatus({ type: "idle", message: "" }); }}>Remove listing photo</button> : null}
        </div>

        <div className="grid gap-4">
          <SectionHeading
            title="Listing identity"
            description="This is the name and public introduction people will see in search results and on your profile."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="provider-full-name" className={labelClassName}>
              Public listing name
              <input
                id="provider-full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                value={textValues.fullName}
                onChange={event => setTextValues(current => ({ ...current, fullName: event.target.value }))}
                className={inputClassName(Boolean(fieldErrors.fullName))}
                aria-invalid={Boolean(fieldErrors.fullName)}
                required
              />
              <FieldError message={fieldErrors.fullName} />
            </label>

            <label
              htmlFor="provider-business-name"
              className={labelClassName}
            >
              Business name
              <input
                id="provider-business-name"
                name="businessName"
                type="text"
                autoComplete="organization"
                value={textValues.businessName}
                onChange={event => setTextValues(current => ({ ...current, businessName: event.target.value }))}
                className={inputClassName(Boolean(fieldErrors.businessName))}
                aria-invalid={Boolean(fieldErrors.businessName)}
                required
              />
              <FieldError message={fieldErrors.businessName} />
            </label>
          </div>

          <label htmlFor="provider-bio" className={labelClassName}>
            Bio
            <textarea
              id="provider-bio"
              name="bio"
              value={textValues.bio}
              onChange={event => setTextValues(current => ({ ...current, bio: event.target.value }))}
              placeholder="Briefly describe your services, ideal clients, and coverage."
              className={inputClassName(
                Boolean(fieldErrors.bio),
                textAreaClassName,
              )}
              aria-invalid={Boolean(fieldErrors.bio)}
              required
            />
            <FieldError message={fieldErrors.bio} />
          </label>
        </div>
      </div>

      <section className={sectionClassName}>
        <SectionHeading
          title="Service details"
          description="Choose the main profession first, then select the specialties that match the service."
        />

        <div className="grid gap-5">
          <label
            htmlFor="provider-category"
            className={`${labelClassName} max-w-xl`}
          >
            Profession/category
            <select
              id="provider-category"
              name="categoryId"
              value={selectedCategoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className={inputClassName(Boolean(fieldErrors.categoryId))}
              aria-invalid={Boolean(fieldErrors.categoryId)}
              required
            >
              <option value="">Select a profession</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.categoryId} />
          </label>

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium text-stone-800">
              Specialties
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {availableSpecialties.length > 0 ? (
                availableSpecialties.map((specialty) => (
                  <label
                    key={specialty.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition ${selectedSpecialtyIds.includes(specialty.id) ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-stone-200 text-stone-700 hover:border-emerald-200 hover:bg-emerald-50"}`}
                  >
                    <input
                      type="checkbox"
                      value={specialty.id}
                      checked={selectedSpecialtyIds.includes(specialty.id)}
                      onChange={(event) =>
                        handleSpecialtyToggle(
                          specialty.id,
                          event.target.checked,
                        )
                      }
                      className="size-4 shrink-0 rounded border-stone-300 accent-emerald-700 focus:ring-emerald-100"
                    />
                    {specialty.name}
                  </label>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">
                  No specialties found
                  {selectedCategory ? ` for ${selectedCategory.name}` : ""}.
                </p>
              )}
            </div>
            {unavailableSpecialtyIds.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>Some saved specialties are unavailable for this profession. Remove them before submitting.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unavailableSpecialtyIds.map(id => {
                    const name = specialties.find(specialty => specialty.id === id)?.name ?? "unavailable specialty";
                    return <button key={id} type="button" className="rounded-lg border border-amber-300 px-3 py-2" aria-label={`Remove ${name}`} onClick={() => handleSpecialtyToggle(id, false)}>{name} ×</button>;
                  })}
                </div>
              </div>
            ) : null}
            <FieldError message={fieldErrors.specialtyIds} />
          </fieldset>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionHeading
          title="Public contact details"
          description="These details appear on your listing. Changes to your account phone or confirmed email are saved as listing edits. Submit those edits here when ready for review."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label htmlFor="provider-email" className={labelClassName}>
            Email
            <input
              id="provider-email"
              name="email"
              type="email"
              autoComplete="email"
              value={textValues.email}
              onChange={event => setTextValues(current => ({ ...current, email: event.target.value }))}
              className={inputClassName(Boolean(fieldErrors.email))}
              aria-invalid={Boolean(fieldErrors.email)}
              required
            />
            <FieldError message={fieldErrors.email} />
          </label>

          <label htmlFor="provider-phone" className={labelClassName}>
            Phone
            <input
              id="provider-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={textValues.phone}
              onChange={event => setTextValues(current => ({ ...current, phone: event.target.value }))}
              className={inputClassName(Boolean(fieldErrors.phone))}
              aria-invalid={Boolean(fieldErrors.phone)}
              required
            />
            <FieldError message={fieldErrors.phone} />
          </label>

          <label htmlFor="provider-website" className={labelClassName}>
            Website
            <input
              id="provider-website"
              name="websiteUrl"
              type="url"
              autoComplete="url"
              placeholder="https://example.com"
              value={textValues.websiteUrl}
              onChange={event => setTextValues(current => ({ ...current, websiteUrl: event.target.value }))}
              className={inputClassName(Boolean(fieldErrors.websiteUrl))}
              aria-invalid={Boolean(fieldErrors.websiteUrl)}
            />
            <FieldError message={fieldErrors.websiteUrl} />
          </label>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionHeading
          title="Location and languages"
          description="Add your home market and the languages clients can use when contacting you."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <label htmlFor="provider-city" className={labelClassName}>
            City
            <input
              id="provider-city"
              name="city"
              type="text"
              autoComplete="address-level2"
              value={textValues.city}
              onChange={event => setTextValues(current => ({ ...current, city: event.target.value }))}
              className={inputClassName(Boolean(fieldErrors.city))}
              aria-invalid={Boolean(fieldErrors.city)}
              required
            />
            <FieldError message={fieldErrors.city} />
          </label>

          <label htmlFor="provider-province" className={labelClassName}>
            State or region
            <input
              id="provider-province"
              name="province"
              type="text"
              autoComplete="address-level1"
              value={textValues.province}
              onChange={event => setTextValues(current => ({ ...current, province: event.target.value }))}
              className={inputClassName(Boolean(fieldErrors.province))}
              aria-invalid={Boolean(fieldErrors.province)}
              required
            />
            <FieldError message={fieldErrors.province} />
          </label>

          <label htmlFor="provider-country" className={labelClassName}>
            Country
            <input
              id="provider-country"
              name="country"
              type="text"
              autoComplete="country-name"
              value={textValues.country}
              onChange={event => setTextValues(current => ({ ...current, country: event.target.value }))}
              className={inputClassName(Boolean(fieldErrors.country))}
              aria-invalid={Boolean(fieldErrors.country)}
              required
            />
            <FieldError message={fieldErrors.country} />
          </label>
        </div>

        <fieldset className="grid min-w-0 max-w-xl gap-3">
          <legend className="text-sm font-medium text-stone-800">
            Languages
          </legend>
          <div className="relative">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 text-left text-sm text-stone-900 transition hover:border-stone-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
              aria-expanded={isLanguagePickerOpen}
              onClick={() => setIsLanguagePickerOpen((isOpen) => !isOpen)}
            >
              <span className="truncate">
                {selectedLanguages.length > 0
                  ? `${selectedLanguages.length} selected`
                  : "Select languages"}
              </span>
              <span className="text-stone-500" aria-hidden="true">
                {isLanguagePickerOpen ? "Close" : "Search"}
              </span>
            </button>

            {isLanguagePickerOpen ? (
              <div className="absolute z-10 mt-2 w-full rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
                <label htmlFor="provider-language-search" className="sr-only">
                  Search languages
                </label>
                <input
                  id="provider-language-search"
                  type="search"
                  value={languageSearch}
                  onChange={(event) => setLanguageSearch(event.target.value)}
                  placeholder="Search languages"
                  className={inputBaseClassName}
                />

                <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                  {filteredLanguages.length > 0 ? (
                    filteredLanguages.map((language) => (
                      <label
                        key={language.id}
                        className="flex min-h-10 items-center gap-3 rounded-md px-2 text-sm font-medium text-stone-700 transition hover:bg-emerald-50"
                      >
                        <input
                          type="checkbox"
                          value={language.id}
                          checked={selectedLanguageIds.includes(language.id)}
                          onChange={(event) =>
                            handleLanguageToggle(
                              language.id,
                              event.target.checked,
                            )
                          }
                          className="size-4 shrink-0 rounded border-stone-300 accent-emerald-700 focus:ring-emerald-100"
                        />
                        {language.name}
                      </label>
                    ))
                  ) : (
                    <p className="px-2 py-6 text-center text-sm text-stone-600">
                      No languages found.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedLanguages.length > 0 ? (
              selectedLanguages.map((language) => (
                <span
                  key={language.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-900 ring-1 ring-inset ring-emerald-100"
                >
                  {language.name}
                  <button
                    type="button"
                    className="rounded text-emerald-700 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    aria-label={`Remove ${language.name}`}
                    onClick={() => handleLanguageToggle(language.id, false)}
                  >
                    x
                  </button>
                </span>
              ))
            ) : (
              <p className="text-sm text-stone-500">No languages selected.</p>
            )}
          </div>
          <FieldError message={fieldErrors.languageIds} />
        </fieldset>
      </section>

      <div className="flex flex-col gap-4 border-t border-stone-100 pt-6 xl:flex-row xl:items-center xl:justify-between">
        <p id="provider-approval-help" className="text-xs leading-5 text-stone-500">
          {isUnchangedPending
            ? "Your listing is already awaiting approval. Edit it to submit an update."
            : isUnchangedPublished
              ? "Edit your listing to submit an update for review. Your approved listing remains public."
              : listingStatus === "active"
                ? "Your approved listing stays public while your edits are reviewed."
                : "Save your changes as a draft or send your listing for review."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            name="intent"
            value="draft"
            className="settings-secondary-button"
            disabled={isBusy}
            onClick={() => setPendingIntent("draft")}
          >
            {isUploading
              ? "Uploading..."
              : isSavingDraft
                ? "Saving..."
                : "Save draft"}
          </button>
          <button
            type="submit"
            name="intent"
            value={approvalIntent}
            className="settings-primary-button"
            disabled={isBusy || isUnchangedPending || isUnchangedPublished}
            aria-describedby="provider-approval-help"
            onClick={() => setPendingIntent(approvalIntent)}
          >
            {isUploading
              ? "Uploading..."
              : isRequestingReactivation
                ? "Requesting..."
                : isSubmitting
                  ? "Submitting..."
                  : isInactiveProfile
                    ? "Request reactivation"
                    : "Submit for approval"}
          </button>
        </div>
      </div>
    </form>
  );
}
