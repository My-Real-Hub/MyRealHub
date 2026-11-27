import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import { PROFILE_BIO_MAX_LENGTH } from "@/lib/settings/profile";

export type ProviderProfileStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "inactive"
  | "rejected";

export type ProviderProfileFormIntent = "draft" | "submit" | "reactivate";
export type ProviderListingReviewStatus = "draft" | "pending_edit" | "rejected";

export type ProviderProfileFormValues = {
  fullName: string;
  businessName: string;
  categoryId: string;
  bio: string;
  email: string;
  phone: string;
  websiteUrl: string;
  city: string;
  province: string;
  country: string;
  profileImagePath: string;
  languageIds: string[];
  specialtyIds: string[];
};

export type ProviderProfileFieldErrors = Partial<
  Record<keyof ProviderProfileFormValues, string>
>;

export type ProviderProfileFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: ProviderProfileFieldErrors;
  revision?: string;
  listingRevision?: string;
  listingStatus?: ProviderProfileStatus;
  reviewStatus?: ProviderListingReviewStatus | null;
  reloadRequired?: boolean;
  alreadyPending?: boolean;
  savedDetailsFingerprint?: string;
};

export const initialProviderProfileFormState: ProviderProfileFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getFormStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getWebsiteUrlError(websiteUrl: string) {
  if (!websiteUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(websiteUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return "Website must start with http:// or https://.";
    }
  } catch {
    return "Enter a valid website URL.";
  }

  return null;
}

export function getProviderProfileFormIntent(
  formData: FormData,
): ProviderProfileFormIntent {
  const intent = formData.get("intent");

  if (intent === "submit" || intent === "reactivate") {
    return intent;
  }

  return "draft";
}

export function getProviderProfileFormValues(
  formData: FormData,
): ProviderProfileFormValues {
  return {
    fullName: getFormString(formData, "fullName"),
    businessName: getFormString(formData, "businessName"),
    categoryId: getFormString(formData, "categoryId"),
    bio: getFormString(formData, "bio"),
    email: normalizeEmail(getFormString(formData, "email")),
    phone: getFormString(formData, "phone"),
    websiteUrl: getFormString(formData, "websiteUrl"),
    city: getFormString(formData, "city"),
    province: getFormString(formData, "province"),
    country: getFormString(formData, "country"),
    profileImagePath: getFormString(formData, "profileImagePath"),
    languageIds: getFormStringList(formData, "languageIds"),
    specialtyIds: getFormStringList(formData, "specialtyIds"),
  };
}

export function getProviderProfileFormFingerprint(
  values: ProviderProfileFormValues,
  imageUrl: string | null = null,
  removeImage = false,
) {
  const imagePath = values.profileImagePath.trim();
  const normalizeIds = (ids: string[]) =>
    [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();

  return JSON.stringify([
    values.fullName.trim(),
    values.businessName.trim(),
    values.categoryId.trim(),
    values.bio.replace(/\r\n/g, "\n").trim(),
    normalizeEmail(values.email),
    values.phone.trim(),
    values.websiteUrl.trim(),
    values.city.trim(),
    values.province.trim(),
    values.country.trim(),
    imagePath || (removeImage ? "" : imageUrl ?? ""),
    normalizeIds(values.languageIds),
    normalizeIds(values.specialtyIds),
  ]);
}

export function getProviderProfileListingStatus(
  state: Pick<ProviderProfileFormState, "listingRevision" | "listingStatus">,
  refreshed: { revision: string; status: ProviderProfileStatus } | null,
) {
  return refreshed && BigInt(refreshed.revision) > BigInt(state.listingRevision ?? "0")
    ? refreshed.status
    : state.listingStatus;
}

export function getProviderProfileListingState(
  state: Pick<ProviderProfileFormState, "listingRevision" | "listingStatus" | "reviewStatus">,
  refreshed: { revision: string; status: ProviderProfileStatus; review_status: ProviderListingReviewStatus | null } | null,
) {
  return refreshed && BigInt(refreshed.revision) > BigInt(state.listingRevision ?? "0")
    ? { status: refreshed.status, reviewStatus: refreshed.review_status }
    : { status: state.listingStatus, reviewStatus: state.reviewStatus ?? null };
}

export function getProviderProfileSnapshotFingerprint(snapshot: {
  display_name: string | null; business_name: string | null; category_id: string | null;
  bio: string | null; email: string | null; phone: string | null; website_url: string | null;
  city: string | null; province_state: string | null; country: string | null;
  profile_image_path: string | null; profile_image_url: string | null;
  languageIds: string[]; specialtyIds: string[];
}) {
  return getProviderProfileFormFingerprint({
    fullName: snapshot.display_name ?? "", businessName: snapshot.business_name ?? "",
    categoryId: snapshot.category_id ?? "", bio: snapshot.bio ?? "", email: snapshot.email ?? "",
    phone: snapshot.phone ?? "", websiteUrl: snapshot.website_url ?? "", city: snapshot.city ?? "",
    province: snapshot.province_state ?? "", country: snapshot.country ?? "",
    profileImagePath: snapshot.profile_image_path ?? "", languageIds: snapshot.languageIds,
    specialtyIds: snapshot.specialtyIds,
  }, snapshot.profile_image_url);
}

export function validateProviderProfileFormValues(
  values: ProviderProfileFormValues,
  intent: ProviderProfileFormIntent = "submit",
) {
  const errors: ProviderProfileFieldErrors = {};
  const requiresCompleteProfile = intent !== "draft";

  for (const [key, limit] of Object.entries({ fullName: 120, businessName: 160, phone: 40, email: 254, websiteUrl: 2048, city: 120, province: 120, country: 120 })) {
    if (values[key as keyof typeof values].length > limit) {
      errors[key as keyof typeof values] = `Use ${limit} characters or fewer.`;
    }
  }

  if (requiresCompleteProfile) {
    if (!values.fullName) {
      errors.fullName = "Full name is required.";
    }

    if (!values.businessName) {
      errors.businessName = "Business name is required.";
    }

    if (!values.categoryId) {
      errors.categoryId = "Choose a profession.";
    }

    if (!values.bio) {
      errors.bio = "Bio is required.";
    }
  }

  if (values.bio.length > PROFILE_BIO_MAX_LENGTH) {
    errors.bio = `Bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`;
  }

  if (values.email || requiresCompleteProfile) {
    const emailError = validateEmail(values.email);
    if (emailError) {
      errors.email = emailError;
    }
  }

  if (requiresCompleteProfile) {
    if (!values.phone) {
      errors.phone = "Phone is required.";
    }
  }

  const websiteUrlError = getWebsiteUrlError(values.websiteUrl);
  if (websiteUrlError) {
    errors.websiteUrl = websiteUrlError;
  }

  if (requiresCompleteProfile) {
    if (!values.city) {
      errors.city = "City is required.";
    }

    if (!values.province) {
      errors.province = "State or region is required.";
    }

    if (!values.country) {
      errors.country = "Country is required.";
    }

    if (values.languageIds.length === 0) {
      errors.languageIds = "Choose at least one language.";
    }

    if (values.specialtyIds.length === 0) {
      errors.specialtyIds = "Choose at least one specialty.";
    }
  }

  return errors;
}

export function hasProviderProfileFieldErrors(
  errors: ProviderProfileFieldErrors,
) {
  return Object.values(errors).some(Boolean);
}
