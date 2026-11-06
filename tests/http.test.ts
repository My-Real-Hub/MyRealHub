import assert from "node:assert/strict";
import { test } from "node:test";
import { readLimitedJson, RequestBodyTooLargeError } from "../lib/http/json";

function request(body?: string, headers?: Record<string, string>) {
  return new Request("http://localhost/api/test", { method: "POST", body, headers });
}

test("JSON reader accepts body exactly at the byte limit", async () => {
  assert.deepEqual(await readLimitedJson(request('{"a":1}'), 7), { a: 1 });
});
test("JSON reader rejects oversize data with no content length", async () => {
  await assert.rejects(readLimitedJson(request('{"a":1}'), 6), RequestBodyTooLargeError);
});
test("JSON reader does not trust a falsely small content length", async () => {
  await assert.rejects(readLimitedJson(request('{"a":1}', { "content-length": "1" }), 6), RequestBodyTooLargeError);
});
test("JSON reader limits UTF-8 bytes rather than characters", async () => {
  await assert.rejects(readLimitedJson(request('"éé"'), 5), RequestBodyTooLargeError);
  assert.equal(await readLimitedJson(request('"éé"'), 6), "éé");
});
test("JSON reader rejects malformed and missing bodies", async () => {
  await assert.rejects(readLimitedJson(request("{"), 10), SyntaxError);
  await assert.rejects(readLimitedJson(request(), 10), SyntaxError);
});
test("JSON reader rejects an advertised excessive size before consuming", async () => {
  await assert.rejects(readLimitedJson(request("{}", { "content-length": "100" }), 10), RequestBodyTooLargeError);
});

test("JSON reader decodes UTF-8 characters split across streamed chunks", async () => {
  const bytes = new TextEncoder().encode('"é"');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 2));
      controller.enqueue(bytes.slice(2));
      controller.close();
    },
  });
  const streamed = new Request("http://localhost/api/test", { method: "POST", body, duplex: "half" } as RequestInit);
  assert.equal(await readLimitedJson(streamed, 4), "é");
});

test("JSON reader cancels an oversized chunked body instead of consuming the remainder", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(11)); },
    cancel() { cancelled = true; },
  });
  const streamed = new Request("http://localhost/api/test", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readLimitedJson(streamed, 10), RequestBodyTooLargeError);
  assert.equal(cancelled, true);
});
