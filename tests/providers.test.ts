import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { dispatch, normalizeWebhook, sandboxDispatch, verifyWebhook } from "../src/providers/index.ts";
import type { CallInput } from "../src/domain/types.ts";

const input: CallInput = { phone: "+14155550123", seller_id: "seller-a", campaign: "followup", consent_id: "consent-a", provider: "vapi", state: "CA", timezone: "America/Los_Angeles", location_source: "customer_attestation" };
const config = { apiKey: "test-provider-key", assistantId: "assistant-a", phoneNumberId: "phone-a", fromNumber: "+14155550124" };

test("Vapi outbound adapter sends only supported fields and correlation metadata", async () => {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  const result = await dispatch("vapi", config, input, "attempt-123", async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: "vapi-call-a" }), { status: 201 });
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.vapi.ai/call");
  assert.equal(new Headers(calls[0].options?.headers).get("authorization"), "Bearer test-provider-key");
  assert.deepEqual(JSON.parse(String(calls[0].options?.body)), {
    assistantId: "assistant-a", phoneNumberId: "phone-a", customer: { number: input.phone }, metadata: { gateway_call_id: "attempt-123" },
  });
  assert.equal(result.status, "accepted");
  assert.equal(result.provider_call_id, "vapi-call-a");
});

test("Retell adapter includes native idempotency key without assuming Vapi supports it", async () => {
  let body: Record<string, unknown> = {};
  const result = await dispatch("retell", config, { ...input, provider: "retell" }, "attempt-123", async (url, options) => {
    assert.equal(String(url), "https://api.retellai.com/v2/create-phone-call");
    body = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ call_id: "retell-call-a" }));
  });
  assert.equal(body.idempotency_key, "attempt-123");
  assert.equal(body.from_number, config.fromNumber);
  assert.equal(body.to_number, input.phone);
  assert.equal(body.override_agent_id, "assistant-a");
  assert.equal(result.provider_call_id, "retell-call-a");
});

test("network errors, 5xx and ambiguous successful responses are unknown and never retried", async () => {
  for (const response of [null, new Response("unavailable", { status: 503 }), new Response("{}")]) {
    let attempts = 0;
    const result = await dispatch("vapi", config, input, "attempt-123", async () => {
      attempts += 1;
      if (!response) throw new Error("request timed out");
      return response;
    });
    assert.equal(result.status, "unknown");
    assert.equal(attempts, 1);
  }
});

test("explicit HTTP rejection is rejected without logging the provider response body", async () => {
  const result = await dispatch("vapi", config, input, "attempt-123", async () => new Response("sensitive details", { status: 401 }));
  assert.equal(result.status, "rejected");
  assert.equal(result.http_status, 401);
  assert.equal(JSON.stringify(result).includes("sensitive details"), false);
});

test("invalid config and provider mismatch never reach the transport", async () => {
  let attempts = 0;
  const transport: typeof fetch = async () => { attempts += 1; throw new Error("must not call"); };
  assert.equal((await dispatch("vapi", { apiKey: "" }, input, "attempt-123", transport)).status, "rejected");
  assert.equal((await dispatch("vapi", config, input, "", transport)).status, "rejected");
  assert.equal((await dispatch("retell", config, input, "attempt-123", transport)).status, "rejected");
  assert.equal(attempts, 0);
});

test("sandbox dispatch is explicit and deterministic without provider credentials", () => {
  const result = sandboxDispatch("vapi", "attempt-123");
  assert.equal(result.sandbox, true);
  assert.equal(result.status, "accepted");
  assert.ok(result.provider_call_id?.startsWith("sandbox_vapi_"));
  assert.deepEqual(sandboxDispatch("vapi", "attempt-123"), result);
  assert.notEqual(sandboxDispatch("retell", "attempt-123").provider_call_id, result.provider_call_id);
});

test("Retell accepts authentic raw bytes but rejects tampering and timestamps outside five minutes", () => {
  const raw = '{ "event": "call_ended", "call": {"call_id":"call-a"} }';
  const now = 1_800_000_000_000;
  const secret = "retell-test-secret";
  const headersAt = (timestamp: number) => new Headers({ "x-retell-signature": `v=${timestamp},d=${createHmac("sha256", secret).update(raw + timestamp).digest("hex")}` });
  assert.equal(verifyWebhook("retell", raw, headersAt(now), secret, now), true);
  assert.equal(verifyWebhook("retell", raw.replace("call-a", "call-b"), headersAt(now), secret, now), false);
  assert.equal(verifyWebhook("retell", raw, headersAt(now - 300_001), secret, now), false);
  assert.equal(verifyWebhook("retell", raw, headersAt(now + 300_001), secret, now), false);
  assert.equal(verifyWebhook("retell", raw, new Headers({ "x-retell-signature": "v=1,d=bogus" }), secret, now), false);
  assert.equal(verifyWebhook("retell", raw, headersAt(now), "", now), false);
});

test("Vapi authenticates an explicitly configured bearer credential", () => {
  assert.equal(verifyWebhook("vapi", "{}", new Headers({ authorization: "Bearer server-secret" }), "server-secret"), true);
  assert.equal(verifyWebhook("vapi", "{}", new Headers({ authorization: "Bearer wrong" }), "server-secret"), false);
  assert.equal(verifyWebhook("vapi", "{}", new Headers(), "server-secret"), false);
  assert.equal(verifyWebhook("vapi", "{}", new Headers({ authorization: "Bearer " }), ""), false);
});

test("Retell normalization removes transcripts, recordings and arbitrary metadata", () => {
  const payload = { event: "call_analyzed", call: { call_id: "call-a", start_timestamp: 1_800_000_000_000,
    end_timestamp: 1_800_000_010_000, duration_ms: 10000, disconnection_reason: "user_hangup",
    transcript: "private speech", recording_url: "https://private.invalid", metadata: { token: "secret" },
    call_analysis: { custom_analysis_data: { opt_out: true } } } };
  const result = normalizeWebhook("retell", payload);
  assert.equal(result?.provider_call_id, "call-a");
  assert.equal(result?.status, "analyzed");
  assert.equal(result?.opt_out, true);
  assert.equal(result?.duration_ms, 10000);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(result?.event_id, normalizeWebhook("retell", structuredClone(payload))?.event_id);
});

test("Vapi normalization accepts end reports without persisting raw analysis", () => {
  const result = normalizeWebhook("vapi", { message: { type: "end-of-call-report", endedReason: "customer-ended-call",
    timestamp: 1_800_000_010_000, call: { id: "call-a" }, artifact: { transcript: "private speech" },
    analysis: { structuredData: { opt_out: true, private_field: "private" } } } });
  assert.equal(result?.status, "ended");
  assert.equal(result?.opt_out, true);
  assert.equal(result?.ended_reason, "customer-ended-call");
  assert.equal(JSON.stringify(result).includes("private"), false);
});

test("malformed webhook cannot manufacture a call or an opt-out", () => {
  for (const payload of [null, {}, { event: "call_ended" }, { event: "call_ended", call: { call_id: 42 } }]) {
    assert.equal(normalizeWebhook("retell", payload), null);
  }
  const result = normalizeWebhook("retell", { event: "call_ended", call: { call_id: "call-a", call_analysis: { custom_analysis_data: { opt_out: "true" } } } });
  assert.equal(result?.opt_out, false);
});
