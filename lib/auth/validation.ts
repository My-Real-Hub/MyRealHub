export const PASSWORD_MIN_LENGTH = 8;

export type AuthFieldErrors = Partial<
  Record<"fullName" | "email" | "password" | "confirmPassword", string>
>;

type SignUpFields = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type LoginFields = {
  email: string;
  password: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  if (!email) {
    return "Email is required.";
  }

  if (!emailPattern.test(email)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validateSignUpFields(fields: SignUpFields) {
  const errors: AuthFieldErrors = {};
  const email = normalizeEmail(fields.email);

  if (!fields.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }

  const emailError = validateEmail(email);
  if (emailError) {
    errors.email = emailError;
  }

  if (!fields.password) {
    errors.password = "Password is required.";
  } else if (fields.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!fields.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords must match.";
  }

  return errors;
}

export function validateLoginFields(fields: LoginFields) {
  const errors: AuthFieldErrors = {};
  const email = normalizeEmail(fields.email);
  const emailError = validateEmail(email);

  if (emailError) {
    errors.email = emailError;
  }

  if (!fields.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

export function hasAuthFieldErrors(errors: AuthFieldErrors) {
  return Object.values(errors).some(Boolean);
}
