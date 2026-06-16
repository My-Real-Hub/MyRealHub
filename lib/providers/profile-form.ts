import { normalizeEmail, validateEmail } from "@/lib/auth/validation";

export type ProviderProfileStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "inactive"
  | "rejected";

export type ProviderProfileFormIntent = "draft" | "submit" | "reactivate";

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

export function validateProviderProfileFormValues(
  values: ProviderProfileFormValues,
  intent: ProviderProfileFormIntent = "submit",
) {
  const errors: ProviderProfileFieldErrors = {};
  const requiresCompleteProfile = intent !== "draft";

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
      errors.province = "Province is required.";
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
