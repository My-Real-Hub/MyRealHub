import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getContactDeliveryMethod,
  getContactEmailDeliveryStatus,
  getContactRequestStatusFilter,
  getPaginationItems,
  getPositivePage,
  getQueryValue,
  isContactDeliveryMethod,
  validateContactRequest,
} from "../lib/contact-requests";
import {
  isFeedbackScreenshotMimeType,
  isPlatformFeedbackStatus,
  isPlatformFeedbackType,
  validateFeedbackPageUrl,
  validateFeedbackScreenshotPath,
  validateFeedbackValues,
} from "../lib/feedback";
import {
  getProviderProfileFormIntent,
  getProviderProfileFormValues,
  hasProviderProfileFieldErrors,
  validateProviderProfileFormValues,
  type ProviderProfileFormValues,
} from "../lib/providers/profile-form";
import {
  isOwnedProfileImagePath,
  isProviderProfileImageType,
} from "../lib/providers/profile-image";
import { parseProviderRating, validateProviderRating } from "../lib/providers/rating";
import {
  isConversationActionInput,
  isConversationStatusUpdate,
  validateConversationMessageBody,
} from "../lib/messages-validation";
import {
  getProviderProfileSlug,
  isProviderProfileId,
  isProviderProfileSlug,
  slugifyProviderValue,
} from "../lib/providers/slug";

const accountId = "11111111-2222-4333-8444-555555555555";
const validContact = {
  name: "A customer",
  email: "customer@example.test",
  phone: "",
  subject: "Home inspection",
  message: "I would like to book an inspection.",
};
const validProfile: ProviderProfileFormValues = {
  fullName: "Sam Provider",
  businessName: "Sam's inspections",
  categoryId: accountId,
  bio: "Residential inspection services.",
  email: "sam@example.test",
  phone: "555-123-4567",
  websiteUrl: "https://example.test",
  city: "Ottawa",
  province: "Ontario",
  country: "Canada",
  profileImagePath: "",
  languageIds: [accountId],
  specialtyIds: [accountId],
};
const validFeedback = {
  accountId,
  currentPageUrl: "/search?q=inspector",
  description: "The filter could be clearer.",
  screenshotPath: "",
  title: "Search filter suggestion",
  type: "suggestion",
};

test("contact request accepts valid content and an optional phone", () => {
  assert.deepEqual(validateContactRequest(validContact), {});
});

for (const field of ["name", "email", "subject", "message"] as const) {
  test(`contact request requires ${field}`, () => {
    assert.ok(validateContactRequest({ ...validContact, [field]: "" })[field]);
  });
}

for (const [field, limit] of [
  ["name", 120], ["phone", 40], ["subject", 160], ["message", 2000],
] as const) {
  test(`contact ${field} accepts its limit and rejects oversized input`, () => {
    assert.equal(validateContactRequest({ ...validContact, [field]: "x".repeat(limit) })[field], undefined);
    assert.ok(validateContactRequest({ ...validContact, [field]: "x".repeat(limit + 1) })[field]);
  });
}

test("contact request rejects malformed and header-injection email addresses", () => {
  for (const email of ["customer", "customer@", "a@test.example\r\nBcc:other@test.example"]) {
    assert.ok(validateContactRequest({ ...validContact, email }).email);
  }
});

test("delivery and status filters accept only supported values", () => {
  assert.equal(isContactDeliveryMethod("email"), true);
  assert.equal(isContactDeliveryMethod("in_app"), true);
  for (const invalid of [null, undefined, "smtp", 1, {}, "EMAIL"]) {
    assert.equal(isContactDeliveryMethod(invalid), false);
  }
  assert.equal(getContactDeliveryMethod("unknown"), "in_app");
  assert.equal(getContactEmailDeliveryStatus("sent"), "sent");
  assert.equal(getContactEmailDeliveryStatus("unknown"), "not_requested");
  assert.equal(getContactRequestStatusFilter("archived"), "archived");
  assert.equal(getContactRequestStatusFilter("invalid"), "all");
});

test("pagination accepts only positive safe integers", () => {
  assert.equal(getPositivePage("12"), 12);
  for (const value of [undefined, "", "0", "-1", "2.5", "3junk", "Infinity", "9007199254740993"]) {
    assert.equal(getPositivePage(value), 1);
  }
});

test("pagination preserves endpoints and the current page around ellipses", () => {
  assert.deepEqual(getPaginationItems(1, 0), []);
  assert.deepEqual(getPaginationItems(2, 3), [1, 2, 3]);
  assert.deepEqual(getPaginationItems(1, 10), [1, 2, "ellipsis-end", 10]);
  assert.deepEqual(getPaginationItems(5, 10), [1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
  assert.deepEqual(getPaginationItems(10, 10), [1, "ellipsis-start", 9, 10]);
});

test("repeated query parameters use the first supplied value", () => {
  assert.equal(getQueryValue(["new", "all"]), "new");
  assert.equal(getQueryValue("all"), "all");
  assert.equal(getQueryValue(undefined), undefined);
  assert.equal(getQueryValue([]), undefined);
});

test("complete provider profiles pass submission and reactivation", () => {
  assert.deepEqual(validateProviderProfileFormValues(validProfile), {});
  assert.deepEqual(validateProviderProfileFormValues(validProfile, "reactivate"), {});
});

test("provider draft can be incomplete while submitted listings require all fields", () => {
  const empty: ProviderProfileFormValues = {
    fullName: "", businessName: "", categoryId: "", bio: "", email: "", phone: "",
    websiteUrl: "", city: "", province: "", country: "", profileImagePath: "",
    languageIds: [], specialtyIds: [],
  };
  assert.deepEqual(validateProviderProfileFormValues(empty, "draft"), {});
  const errors = validateProviderProfileFormValues(empty, "submit");
  for (const field of ["fullName", "businessName", "categoryId", "bio", "email", "phone", "city", "province", "country", "languageIds", "specialtyIds"] as const) {
    assert.ok(errors[field], `${field} is required for approval`);
  }
});

test("provider draft still validates supplied email, biography, and website", () => {
  const errors = validateProviderProfileFormValues({ ...validProfile, email: "invalid", bio: "x".repeat(601), websiteUrl: "javascript:alert(1)" }, "draft");
  assert.ok(errors.email);
  assert.ok(errors.bio);
  assert.ok(errors.websiteUrl);
});

test("provider biography accepts 600 characters and rejects 601", () => {
  assert.equal(validateProviderProfileFormValues({ ...validProfile, bio: "x".repeat(600) }).bio, undefined);
  assert.ok(validateProviderProfileFormValues({ ...validProfile, bio: "x".repeat(601) }).bio);
});

test("provider website accepts web URLs and rejects executable or malformed URLs", () => {
  for (const websiteUrl of ["", "http://example.test", "https://example.test/path"]) {
    assert.equal(validateProviderProfileFormValues({ ...validProfile, websiteUrl }).websiteUrl, undefined);
  }
  for (const websiteUrl of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.test", "www.example.test"]) {
    assert.ok(validateProviderProfileFormValues({ ...validProfile, websiteUrl }).websiteUrl);
  }
});

test("provider forms trim strings, normalize email, and ignore uploaded file values", () => {
  const data = new FormData();
  data.set("fullName", "  Sam Provider  ");
  data.set("email", " SAM@EXAMPLE.TEST ");
  data.set("phone", new Blob(["not a phone"]), "phone.txt");
  data.append("languageIds", "  language-one  ");
  data.append("languageIds", " ");
  data.append("languageIds", new Blob(["not an id"]), "id.txt");
  const values = getProviderProfileFormValues(data);
  assert.equal(values.fullName, "Sam Provider");
  assert.equal(values.email, "sam@example.test");
  assert.equal(values.phone, "");
  assert.deepEqual(values.languageIds, ["language-one"]);
});

test("provider form intent cannot select privileged status values", () => {
  const data = new FormData();
  for (const intent of ["", "active", "approved", "pending_approval"]) {
    data.set("intent", intent);
    assert.equal(getProviderProfileFormIntent(data), "draft");
  }
  data.set("intent", "submit");
  assert.equal(getProviderProfileFormIntent(data), "submit");
  data.set("intent", "reactivate");
  assert.equal(getProviderProfileFormIntent(data), "reactivate");
  assert.equal(hasProviderProfileFieldErrors({}), false);
  assert.equal(hasProviderProfileFieldErrors({ fullName: "Required" }), true);
});

test("provider slugs clean punctuation and use a distinct account suffix", () => {
  assert.equal(slugifyProviderValue("  Sam & Partners, Inc.  "), "sam-and-partners-inc");
  const slug = getProviderProfileSlug({ businessName: "Sam & Partners", displayName: "Sam", userId: accountId });
  assert.equal(slug, "sam-and-partners-555555555555");
  assert.equal(isProviderProfileSlug(slug), true);
  assert.notEqual(slug, getProviderProfileSlug({ businessName: "Sam & Partners", displayName: "Sam", userId: "11111111-2222-4333-8444-666666666666" }));
});

test("long business names produce bounded, routable provider slugs", () => {
  const slug = getProviderProfileSlug({ businessName: "long business name ".repeat(100), displayName: "Sam", userId: accountId });
  assert.ok(slug.length <= 160);
  assert.ok(slug.endsWith("-555555555555"));
  assert.equal(isProviderProfileSlug(slug), true);
});

test("empty and non-Latin provider names still produce a valid slug", () => {
  for (const businessName of ["", "🏠🏠", "中文"]) {
    const slug = getProviderProfileSlug({ businessName, displayName: "", userId: accountId });
    assert.equal(isProviderProfileSlug(slug), true);
    assert.equal(slug, "provider-555555555555");
  }
});

test("provider route identifiers reject traversal and malformed values", () => {
  assert.equal(isProviderProfileId(accountId), true);
  for (const value of ["", "../settings", "a".repeat(161), "UpperCase", "https://example.test"]) {
    assert.equal(isProviderProfileSlug(value), false);
  }
  assert.equal(isProviderProfileId("not-a-uuid"), false);
});

for (const value of ["1", "2", "3", "4", "5"]) {
  test(`rating ${value} is accepted as an exact discrete choice`, () => {
    assert.deepEqual(validateProviderRating({ rating: parseProviderRating(value), review: "" }), {});
  });
}

test("ratings reject partial numbers, fractions, and unsupported choices", () => {
  for (const value of ["", "0", "6", "-1", "5.9", "5stars", "3e0", "03", "Infinity", "NaN"]) {
    assert.ok(validateProviderRating({ rating: parseProviderRating(value), review: "" }).rating, value);
  }
  assert.ok(validateProviderRating({ rating: 3.5, review: "" }).rating);
});

test("rating reviews are optional with a maximum of 1000 characters", () => {
  assert.equal(validateProviderRating({ rating: 4, review: "x".repeat(1000) }).review, undefined);
  assert.ok(validateProviderRating({ rating: 4, review: "x".repeat(1001) }).review);
});

test("feedback accepts a valid report without a screenshot", () => {
  assert.deepEqual(validateFeedbackValues(validFeedback), {});
});

test("feedback type and status reject unsupported values", () => {
  assert.equal(isPlatformFeedbackType("bug"), true);
  assert.equal(isPlatformFeedbackType("suggestion"), true);
  assert.equal(isPlatformFeedbackStatus("planned"), true);
  for (const value of [undefined, null, "admin", 0, {}]) {
    assert.equal(isPlatformFeedbackType(value), false);
    assert.equal(isPlatformFeedbackStatus(value), false);
  }
  assert.ok(validateFeedbackValues({ ...validFeedback, type: "invalid" }).type);
});

for (const [field, limit] of [["title", 160], ["description", 3000]] as const) {
  test(`feedback ${field} is required and bounded`, () => {
    assert.ok(validateFeedbackValues({ ...validFeedback, [field]: "" })[field]);
    assert.equal(validateFeedbackValues({ ...validFeedback, [field]: "x".repeat(limit) })[field], undefined);
    assert.ok(validateFeedbackValues({ ...validFeedback, [field]: "x".repeat(limit + 1) })[field]);
  });
}

test("feedback URLs permit web pages and reject executable or malformed schemes", () => {
  for (const value of ["/", "/search?q=home", "http://localhost:3000/search", "https://myrealhub.test/search"]) {
    assert.equal(validateFeedbackPageUrl(value), true, value);
  }
  for (const value of ["", "//outside.test", "/\\outside.test", "javascript:alert(1)", "data:text/html,hi", "ftp://outside.test", "not a URL", "/search\n", "/" + "x".repeat(2048)]) {
    assert.equal(validateFeedbackPageUrl(value), false, value);
  }
});

test("feedback screenshots require the current account path and reject traversal", () => {
  assert.equal(validateFeedbackScreenshotPath("", accountId), true);
  assert.equal(validateFeedbackScreenshotPath(`${accountId}/screenshot.png`, accountId), true);
  for (const path of [`other-user/file.png`, `${accountId}/../other/file.png`, `${accountId}/`, `${accountId}/a\\b.png`, `${accountId}/a\n.png`, `${accountId}/${"a".repeat(512)}.png`]) {
    assert.equal(validateFeedbackScreenshotPath(path, accountId), false, path);
    assert.ok(validateFeedbackValues({ ...validFeedback, screenshotPath: path }).screenshotPath);
  }
});

test("profile image paths require ownership and reject traversal", () => {
  assert.equal(isOwnedProfileImagePath(`${accountId}/avatar.webp`, accountId), true);
  for (const path of ["", "other-user/avatar.png", `${accountId}/`, `${accountId}/../other/avatar.png`, `${accountId}/a\\b.png`, `${accountId}/a\n.png`]) {
    assert.equal(isOwnedProfileImagePath(path, accountId), false, path);
  }
});

test("image upload types allow only JPEG, PNG, and WebP raster files", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(isProviderProfileImageType(type), true);
    assert.equal(isFeedbackScreenshotMimeType(type), true);
  }
  for (const type of ["image/svg+xml", "text/html", "application/javascript", "", "image/gif"]) {
    assert.equal(isProviderProfileImageType(type), false);
    assert.equal(isFeedbackScreenshotMimeType(type), false);
  }
});

test("conversation actions reject malformed payloads before using database identifiers", () => {
  for (const input of [undefined, null, "hello", [], {}, { mode: "consumer" }, { mode: "admin", conversationId: accountId }, { mode: "provider", conversationId: "invalid" }]) {
    assert.equal(isConversationActionInput(input), false);
  }
  assert.equal(isConversationActionInput({ mode: "consumer", conversationId: accountId }), true);
  assert.equal(isConversationActionInput({ mode: "provider", conversationId: accountId }), true);
});

test("conversation messages reject empty, non-string, and oversized bodies", () => {
  for (const body of [undefined, null, {}, 42, "", "  \n "]) {
    assert.match(validateConversationMessageBody(body) ?? "", /Write a message/);
  }
  assert.equal(validateConversationMessageBody("x".repeat(2000)), null);
  assert.equal(validateConversationMessageBody("  hello  "), null);
  assert.match(validateConversationMessageBody("x".repeat(2001)) ?? "", /2,000/);
});

test("conversation status changes permit only supported provider actions and string notes", () => {
  const input = { conversationId: accountId, mode: "provider", status: "archived" };
  assert.equal(isConversationStatusUpdate(input), true);
  assert.equal(isConversationStatusUpdate({ ...input, status: "rejected", note: "Unable to help" }), true);
  assert.equal(isConversationStatusUpdate({ ...input, mode: "consumer" }), false);
  assert.equal(isConversationStatusUpdate({ ...input, status: "responded" }), false);
  assert.equal(isConversationStatusUpdate({ ...input, note: {} }), false);
  assert.equal(isConversationStatusUpdate(null), false);
});
