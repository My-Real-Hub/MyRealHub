import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getProviderProfileFormFingerprint,
  getProviderProfileFormValues,
  getProviderProfileListingStatus,
  getProviderProfileListingState,
  type ProviderProfileFormValues,
} from "../lib/providers/profile-form";

const details: ProviderProfileFormValues = {
  fullName: "Sam Provider",
  businessName: "Sam's inspections",
  categoryId: "category-1",
  bio: "Residential inspections.",
  email: "sam@example.test",
  phone: "555-123-4567",
  websiteUrl: "https://example.test",
  city: "Ottawa",
  province: "Ontario",
  country: "Canada",
  profileImagePath: "account/photo.webp",
  languageIds: ["language-1", "language-2"],
  specialtyIds: ["specialty-1", "specialty-2"],
};

test("every public text field and profession changes the pending submission comparison", () => {
  const saved = getProviderProfileFormFingerprint(details);
  for (const field of ["fullName", "businessName", "categoryId", "bio", "email", "phone",
    "websiteUrl", "city", "province", "country"] as const) {
    assert.notEqual(getProviderProfileFormFingerprint({ ...details, [field]: details[field] + " changed" }), saved, field);
  }
  assert.equal(getProviderProfileFormFingerprint({ ...details }), saved);
});

test("whitespace and email capitalization use the same comparison as parsed form values", () => {
  const current = { ...details, bio: "  Residential inspections.  ", email: " SAM@EXAMPLE.TEST " };
  const formData = new FormData();
  for (const [field, value] of Object.entries(current)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(field, item);
  }
  const saved = getProviderProfileFormFingerprint(details);
  assert.equal(getProviderProfileFormFingerprint(current), saved);
  assert.equal(getProviderProfileFormFingerprint(getProviderProfileFormValues(formData)), saved);
});

test("changing languages or specialties counts until the original selection is restored", () => {
  const saved = getProviderProfileFormFingerprint(details);
  for (const field of ["languageIds", "specialtyIds"] as const) {
    assert.notEqual(getProviderProfileFormFingerprint({ ...details, [field]: details[field].slice(1) }), saved);
    assert.notEqual(getProviderProfileFormFingerprint({ ...details, [field]: [...details[field], "another"] }), saved);
    assert.equal(getProviderProfileFormFingerprint({ ...details, [field]: [...details[field]].reverse() }), saved);
    assert.equal(getProviderProfileFormFingerprint({ ...details, [field]: [...details[field], details[field][0]] }), saved);
  }
});

test("uploaded photo replacement and removal count without depending on the preview URL", () => {
  const saved = getProviderProfileFormFingerprint(details, "https://example.test/old.webp");
  assert.equal(getProviderProfileFormFingerprint(details, "blob:preview"), saved);
  assert.notEqual(getProviderProfileFormFingerprint({ ...details, profileImagePath: "account/new.webp" }), saved);
  assert.notEqual(getProviderProfileFormFingerprint({ ...details, profileImagePath: "" }, null, true), saved);
  assert.equal(getProviderProfileFormFingerprint(details), saved);
});

test("removing a legacy URL photo counts even when it has no storage path", () => {
  const legacy = { ...details, profileImagePath: "" };
  const imageUrl = "https://example.test/legacy.webp";
  const saved = getProviderProfileFormFingerprint(legacy, imageUrl);
  assert.notEqual(getProviderProfileFormFingerprint(legacy, imageUrl, true), saved);
  assert.equal(getProviderProfileFormFingerprint(legacy, imageUrl), saved);
  assert.equal(getProviderProfileFormFingerprint(legacy, imageUrl, true), getProviderProfileFormFingerprint(legacy));
});

test("a newer service-area save or moderation decision supplies the current listing status", () => {
  const pending = { listingRevision: "9007199254740992", listingStatus: "pending_approval" as const };
  assert.equal(getProviderProfileListingStatus(pending, { revision: "9007199254740993", status: "draft" }), "draft");
  assert.equal(getProviderProfileListingStatus(pending, { revision: "9007199254740993", status: "active" }), "active");
  assert.equal(getProviderProfileListingStatus(pending, { revision: "9007199254740993", status: "inactive" }), "inactive");
});

test("a fresh successful submission is not replaced by an older refreshed draft status", () => {
  const submitted = { listingRevision: "9007199254740993", listingStatus: "pending_approval" as const };
  assert.equal(getProviderProfileListingStatus(submitted, { revision: "9007199254740992", status: "draft" }), "pending_approval");
  assert.equal(getProviderProfileListingStatus(submitted, { revision: "9007199254740993", status: "pending_approval" }), "pending_approval");
  assert.equal(getProviderProfileListingStatus(submitted, null), "pending_approval");
  assert.equal(getProviderProfileListingStatus({}, { revision: "1", status: "pending_approval" }), "pending_approval");
});

test("textarea line endings do not create a false unsaved edit after form submission", () => {
  assert.equal(
    getProviderProfileFormFingerprint({ ...details, bio: "First line\nSecond line" }),
    getProviderProfileFormFingerprint({ ...details, bio: "First line\r\nSecond line" }),
  );
});

test("pending edit status stays coherent with the successful result until newer metadata arrives", () => {
  const submitted = { listingRevision: "9007199254740993", listingStatus: "active" as const, reviewStatus: "pending_edit" as const };
  assert.deepEqual(getProviderProfileListingState(submitted, { revision: "9007199254740992", status: "active", review_status: null }), { status: "active", reviewStatus: "pending_edit" });
  assert.deepEqual(getProviderProfileListingState(submitted, { revision: "9007199254740994", status: "active", review_status: null }), { status: "active", reviewStatus: null });
  assert.deepEqual(getProviderProfileListingState(submitted, { revision: "9007199254740994", status: "inactive", review_status: "draft" }), { status: "inactive", reviewStatus: "draft" });
});
