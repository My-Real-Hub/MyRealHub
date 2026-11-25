import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getListingRevision, getListingSaveMessage, LISTING_CONFLICT_MESSAGE, runListingOperation } from "../lib/providers/listing-save";
import { getListingEditorSnapshot, LISTING_EDITOR_RPC } from "../lib/providers/listing-query";

const id = "11111111-2222-4333-8444-555555555555";
const saved = { id, slug: "existing-listing", revision: "9007199254740993", status: "pending_approval" } as const;
function rpcClient(data: unknown = saved, error: unknown = null) {
  const calls: unknown[][] = [];
  return {
    calls,
    client: { async rpc(...args: unknown[]) { calls.push(args); return { data, error }; } } as unknown as SupabaseClient,
  };
}

test("listing revision tokens preserve bigint precision and reject malformed or rounded values", () => {
  for (const revision of ["0", "1", "9007199254740993", "9223372036854775807"]) {
    assert.equal(getListingRevision(revision), revision);
  }
  assert.equal(getListingRevision(12), "12");
  for (const revision of [null, undefined, "", "01", "-1", "1.0", "1e3", " 1", "9223372036854775808", 9007199254740992, {}, new Blob()]) {
    assert.equal(getListingRevision(revision), null);
  }
});

test("each versioned operation sends the displayed revision once without retrying or reading a newer revision", async () => {
  for (const operation of ["save_provider_listing", "replace_provider_service_regions", "review_provider_listing"] as const) {
    const { client, calls } = rpcClient();
    const args = { expected_revision: "9007199254740992", fields: { display_name: "Public name" } };
    assert.deepEqual(await runListingOperation(client, operation, args), { data: saved, error: null, conflict: false });
    assert.deepEqual(calls, [[operation, args]]);
  }
});

test("stale listing saves and reviews return explicit reload guidance without retrying", async () => {
  const { client, calls } = rpcClient(null, { code: "PT409", message: "internal listing_conflict details" });
  assert.deepEqual(await runListingOperation(client, "save_provider_listing", { expected_revision: "7" }), {
    data: null, error: LISTING_CONFLICT_MESSAGE, conflict: true,
  });
  assert.equal(calls.length, 1);
});

test("independent editors return their own exact revision tokens without substituting the overall review version", async () => {
  const result = { ...saved, details_revision: "11", regions_revision: "7", already_pending: false };
  for (const [operation, args] of [
    ["save_provider_listing_details", { expected_details_revision: "10", fields: { bio: "Details edit" } }],
    ["save_provider_service_regions", { expected_regions_revision: "6", selected_service_region_ids: [id] }],
  ] as const) {
    const { client, calls } = rpcClient(result);
    assert.deepEqual(await runListingOperation(client, operation, args), { data: result, error: null, conflict: false });
    assert.deepEqual(calls, [[operation, args]]);
  }
});

test("pending acknowledgements retain exact versions and produce an already-awaiting message", async () => {
  const result = { ...saved, details_revision: "11", regions_revision: "7", already_pending: true };
  const { client, calls } = rpcClient(result);
  const outcome = await runListingOperation(client, "save_provider_listing_details", { expected_details_revision: "10" });
  assert.equal(outcome.error, null);
  assert.deepEqual(outcome.data, result);
  assert.equal(calls.length, 1);
  assert.equal(getListingSaveMessage("submit", result), "Already awaiting approval. Your existing submission is unchanged.");
  assert.equal(getListingSaveMessage("reactivate", result), "Already awaiting approval. Your existing submission is unchanged.");
  assert.match(getListingSaveMessage("submit", { status: "pending_approval", already_pending: false }), /^Profile submitted/);
  assert.match(getListingSaveMessage("draft", { status: "draft", already_pending: false }), /^Draft saved/);
});

test("missing or inconsistent already-pending flags cannot claim an unchanged submission", async () => {
  for (const result of [
    { ...saved, details_revision: "11", regions_revision: "7" },
    { ...saved, details_revision: "11", regions_revision: "7", already_pending: "true" },
    { ...saved, details_revision: "11", regions_revision: "7", already_pending: null },
    { ...saved, details_revision: "11", regions_revision: "7", already_pending: true, status: "active" },
  ]) {
    const { client } = rpcClient(result);
    const outcome = await runListingOperation(client, "save_provider_listing_details", {});
    assert.equal(outcome.data, null);
    assert.match(outcome.error ?? "", /could not be confirmed.*reload/i);
  }
});

test("pending edits retain active publication and the database acknowledgement flags", async () => {
  const edited = { ...saved, status: "active" as const, review_status: "pending_edit" as const,
    details_revision: "12", regions_revision: "8", already_pending: true, no_changes: false };
  const { client } = rpcClient(edited);
  assert.deepEqual((await runListingOperation(client, "save_provider_listing_details", {})).data, edited);
  assert.match(getListingSaveMessage("submit", edited), /Already awaiting edit approval.*remains active/);
  assert.match(getListingSaveMessage("submit", { ...edited, already_pending: false }), /Edits submitted.*remains active/);
});

test("malformed proposed-edit metadata cannot be reported as a successful save", async () => {
  for (const changed of [
    { review_status: "pending_edit", status: "inactive" }, { review_status: "unknown" },
    { review_status: null, no_changes: "true" }, { review_status: "pending_edit", no_changes: true },
  ]) {
    const { client } = rpcClient({ ...saved, details_revision: "12", regions_revision: "8", already_pending: false, ...changed });
    assert.equal((await runListingOperation(client, "save_provider_listing_details", {})).data, null);
  }
});

test("owner deactivation preserves its explicit acknowledgement and never substitutes a newer revision", async () => {
  const inactive = { ...saved, status: "inactive" as const, review_status: "draft" as const, already_inactive: true, no_changes: false };
  const { client, calls } = rpcClient(inactive);
  assert.deepEqual((await runListingOperation(client, "deactivate_provider_listing", { expected_revision: "1" })).data, inactive);
  assert.deepEqual(calls, [["deactivate_provider_listing", { expected_revision: "1" }]]);
});

test("missing or malformed editor versions cannot be mistaken for a successful scoped save", async () => {
  for (const result of [saved, { ...saved, details_revision: "0", regions_revision: "1" },
    { ...saved, details_revision: "1", regions_revision: 9007199254740992 }]) {
    const { client } = rpcClient(result);
    const outcome = await runListingOperation(client, "save_provider_listing_details", {});
    assert.equal(outcome.data, null);
    assert.match(outcome.error ?? "", /could not be confirmed.*reload/i);
  }
});

test("permission and validation errors return useful feedback without exposing database internals", async () => {
  for (const code of ["42501", "28000", "22023", "22P02", "23514", "PGRST202", "XX000"]) {
    const { client, calls } = rpcClient(null, { code, message: "SECRET database details" });
    const result = await runListingOperation(client, "review_provider_listing", {});
    assert.ok(result.error);
    assert.equal(result.conflict, false);
    assert.ok(!result.error.includes("SECRET"));
    assert.equal(calls.length, 1);
  }
});

test("unknown or interrupted save outcomes require a reload and never promise rollback", async () => {
  for (const data of [null, {}, { ...saved, revision: 9007199254740992 }, { ...saved, revision: "0" },
    { ...saved, status: "approved" }, { ...saved, slug: "../../settings" }, { ...saved, id: "invalid" }]) {
    const { client } = rpcClient(data);
    const result = await runListingOperation(client, "save_provider_listing", {});
    assert.match(result.error ?? "", /could not be confirmed.*reload/i);
    assert.equal(result.data, null);
  }
  const client = { async rpc() { throw new Error("SECRET network detail"); } } as unknown as SupabaseClient;
  const result = await runListingOperation(client, "save_provider_listing", {});
  assert.match(result.error ?? "", /could not be confirmed.*reload/i);
  assert.ok(!result.error?.includes("SECRET"));
});

function snapshotClient(data: unknown, error: unknown = null) {
  return rpcClient(data, error);
}
const row = {
  ...saved, details_revision: "5", regions_revision: "3", categoryName: "Inspection", review_status: null,
  languageIds: ["language"], languageNames: ["English"], specialtyIds: ["specialty"], specialtyNames: ["Residential"],
  serviceRegionIds: ["region"], serviceRegionNames: ["Ottawa"],
};

test("listing editors and administrator review load content, all assignments, and text revision in one request", async () => {
  for (const field of ["user_id", "id"] as const) {
    const { client, calls } = snapshotClient(row);
    const snapshot = await getListingEditorSnapshot(client, field, id);
    assert.equal(snapshot?.revision, saved.revision);
    assert.equal(snapshot?.details_revision, "5");
    assert.equal(snapshot?.regions_revision, "3");
    assert.deepEqual(snapshot?.serviceRegionIds, ["region"]);
    assert.deepEqual(snapshot?.languageIds, ["language"]);
    assert.deepEqual(snapshot?.specialtyIds, ["specialty"]);
    assert.deepEqual(snapshot?.serviceRegionNames, ["Ottawa"]);
    assert.deepEqual(calls, [[LISTING_EDITOR_RPC, { lookup_field: field, lookup_id: id }]]);
  }
});

test("unreadable or partial listing loads cannot become empty new-listing forms", async () => {
  const missing = snapshotClient(null);
  assert.equal(await getListingEditorSnapshot(missing.client, "user_id", id), null);
  for (const data of [null, { ...row, languageIds: undefined }, { ...row, serviceRegionIds: null }, { ...row, revision: null }, { ...row, details_revision: null }, { ...row, regions_revision: null }, { ...row, review_status: undefined }]) {
    const { client } = snapshotClient(data, data === null ? { code: "NETWORK" } : null);
    await assert.rejects(getListingEditorSnapshot(client, "user_id", id), /could not be loaded/);
  }
});
