"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { saveProviderProfile } from "@/app/provider/dashboard/actions";
import {
  initialProviderProfileFormState,
  type ProviderProfileStatus,
} from "@/lib/providers/profile-form";
import {
  isProviderProfileImageType,
  PROVIDER_PROFILE_IMAGE_MAX_SIZE,
  PROVIDER_PROFILE_IMAGES_BUCKET,
} from "@/lib/providers/profile-image";
import { getSupabaseClient } from "@/lib/supabase/client";

export type ProviderProfileFormData = {
  id: string;
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
  accountEmail: string | null;
  accountFullName: string | null;
};

type UploadStatus = {
  type: "idle" | "uploading" | "success" | "error";
  message: string;
};

const inputBaseClassName =
  "h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const textAreaClassName =
  "min-h-36 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-7 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100";

const errorFieldClassName =
  "border-red-300 focus:border-red-600 focus:ring-red-100";

const labelClassName = "flex flex-col gap-2 text-sm font-medium text-stone-800";

const sectionClassName = "grid gap-5 border-t border-stone-200 pt-6";

const buttonClassName =
  "h-11 rounded-md px-4 text-sm font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-stone-400";

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
  profile,
  categories,
  languages,
  specialties,
  accountId,
  accountEmail,
  accountFullName,
}: ProviderProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    saveProviderProfile,
    initialProviderProfileFormState,
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    profile?.category_id ?? "",
  );
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState(
    profile?.specialtyIds ?? [],
  );
  const [selectedLanguageIds, setSelectedLanguageIds] = useState(
    profile?.languageIds ?? [],
  );
  const [languageSearch, setLanguageSearch] = useState("");
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const [imagePath, setImagePath] = useState(profile?.profile_image_path ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(
    profile?.profile_image_url ?? "",
  );
  const [objectPreviewUrl, setObjectPreviewUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    type: "idle",
    message: "",
  });

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
      setImagePreviewUrl(profile?.profile_image_url ?? "");
      setImagePath(profile?.profile_image_path ?? "");
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
      {selectedLanguageIds.map((languageId) => (
        <input key={languageId} name="languageIds" type="hidden" value={languageId} />
      ))}
      <StatusMessage status={state.status} message={state.message} />

      {!hasLookupOptions ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Service options are missing. Apply the database migrations and seed
          data before saving provider profiles.
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
        </div>

        <div className="grid gap-4">
          <SectionHeading
            title="Listing identity"
            description="This is the name and public introduction people will see in search results and on your profile."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="provider-full-name" className={labelClassName}>
              Full name
              <input
                id="provider-full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                defaultValue={profile?.display_name ?? accountFullName ?? ""}
                className={inputClassName(Boolean(fieldErrors.fullName))}
                aria-invalid={Boolean(fieldErrors.fullName)}
                required
              />
              <FieldError message={fieldErrors.fullName} />
            </label>

            <label htmlFor="provider-business-name" className={labelClassName}>
              Business name
              <input
                id="provider-business-name"
                name="businessName"
                type="text"
                autoComplete="organization"
                defaultValue={profile?.business_name ?? ""}
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
              defaultValue={profile?.bio ?? ""}
              placeholder="Briefly describe your services, ideal clients, and coverage."
              className={inputClassName(Boolean(fieldErrors.bio), textAreaClassName)}
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <label htmlFor="provider-category" className={labelClassName}>
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
            <legend className="text-sm font-medium text-stone-800">
              Specialties
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableSpecialties.length > 0 ? (
                availableSpecialties.map((specialty) => (
                  <label
                    key={specialty.id}
                    className="flex min-h-11 items-center gap-3 rounded-md border border-stone-200 px-3 text-sm font-medium text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <input
                      name="specialtyIds"
                      type="checkbox"
                      value={specialty.id}
                      checked={selectedSpecialtyIds.includes(specialty.id)}
                      onChange={(event) =>
                        handleSpecialtyToggle(
                          specialty.id,
                          event.target.checked,
                        )
                      }
                      className="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-100"
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
            <FieldError message={fieldErrors.specialtyIds} />
          </fieldset>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionHeading
          title="Contact"
          description="These contact details are used for inquiries from potential clients."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label htmlFor="provider-email" className={labelClassName}>
            Email
            <input
              id="provider-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={profile?.email ?? accountEmail ?? ""}
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
              defaultValue={profile?.phone ?? ""}
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
              defaultValue={profile?.website_url ?? ""}
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
              defaultValue={profile?.city ?? ""}
              className={inputClassName(Boolean(fieldErrors.city))}
              aria-invalid={Boolean(fieldErrors.city)}
              required
            />
            <FieldError message={fieldErrors.city} />
          </label>

          <label htmlFor="provider-province" className={labelClassName}>
            Province
            <input
              id="provider-province"
              name="province"
              type="text"
              autoComplete="address-level1"
              defaultValue={profile?.province_state ?? ""}
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
              defaultValue={profile?.country ?? "Canada"}
              className={inputClassName(Boolean(fieldErrors.country))}
              aria-invalid={Boolean(fieldErrors.country)}
              required
            />
            <FieldError message={fieldErrors.country} />
          </label>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-stone-800">
            Languages
          </legend>
          <div className="relative">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md border border-stone-300 bg-white px-3 text-left text-sm text-stone-900 transition hover:border-stone-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
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
              <div className="absolute z-20 mt-2 w-full rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
                <label
                  htmlFor="provider-language-search"
                  className="sr-only"
                >
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
                          className="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-100"
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
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-900 ring-1 ring-inset ring-emerald-100"
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

      <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="submit"
          name="intent"
          value="draft"
          className={`${buttonClassName} border border-stone-300 text-stone-800 hover:border-stone-950 hover:text-stone-950 focus:ring-stone-100`}
          disabled={isBusy}
        >
          {isBusy ? "Saving..." : "Save draft"}
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          className={`${buttonClassName} bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-100`}
          disabled={isBusy}
        >
          {isBusy ? "Saving..." : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}
