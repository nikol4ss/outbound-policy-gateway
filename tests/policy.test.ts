import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "../src/domain/policy.ts";
import type { CallInput, EvaluationContext } from "../src/domain/types.ts";

const now = new Date("2026-11-05T17:00:00.000Z");
const input: CallInput = {
  phone: "+14155550123", seller_id: "seller-a", campaign: "lead-followup",
  consent_id: "consent-a", provider: "vapi", state: "CA",
  timezone: "America/Los_Angeles", location_source: "customer_attestation",
};

function context(): EvaluationContext {
  return {
    workspace_id: "workspace-a", seller_id: "seller-a", mode: "sandbox",
    paused: false, opted_out: false, subscription_active: true, quota_remaining: 100,
    policy: { id: "policy-a", version: "sandbox-v1", approved: true, allowed_states: ["CA"],
      effective_from: "2026-01-01T00:00:00Z", effective_until: "2027-01-01T00:00:00Z",
      window_start: "09:00", window_end: "20:00", requires_dnc: true, disclosure: "This is an AI assistant." },
    consent: { id: "consent-a", seller_id: "seller-a", phone: input.phone, scope: "marketing",
      captured_at: "2026-10-01T00:00:00Z", source: "first-party-form", disclosure: "I agree to AI marketing calls from Seller A.", evidence_ref: "evidence/consent-a" },
    dnc: { seller_id: "seller-a", downloaded_at: "2026-11-01T00:00:00Z", authorized: true,
      area_codes: ["415"], blocked_phones: [], version: "snapshot-a" },
  };
}

test("allows complete eligible evidence and returns the pinned disclosure", () => {
  assert.deepEqual(evaluate(input, context(), now), {
    decision: "ALLOW", reason: "ELIGIBLE", policy_version: "sandbox-v1", required_disclosure: "This is an AI assistant.",
  });
});

test("blocks an opt-out identically across Vapi and Retell", () => {
  const ctx = context(); ctx.opted_out = true;
  for (const provider of ["vapi", "retell"] as const) {
    assert.equal(evaluate({ ...input, provider }, ctx, now).reason, "OPTED_OUT");
  }
});

test("missing or mismatched consent cannot authorize a call", () => {
  const ctx = context(); ctx.consent = null;
  assert.equal(evaluate(input, ctx, now).reason, "CONSENT_NOT_FOUND");
  ctx.consent = { ...context().consent!, seller_id: "another-seller" };
  assert.equal(evaluate(input, ctx, now).reason, "CONSENT_MISMATCH");
  ctx.consent = { ...context().consent!, id: "another-consent" };
  assert.equal(evaluate(input, ctx, now).reason, "CONSENT_MISMATCH");
});

test("revoked, future, expired and incomplete evidence are blocked", () => {
  const cases = [
    [{ revoked_at: "2026-11-01T00:00:00Z" }, "CONSENT_REVOKED"],
    [{ captured_at: "2027-01-01T00:00:00Z" }, "CONSENT_INVALID"],
    [{ expires_at: now.toISOString() }, "CONSENT_EXPIRED"],
    [{ evidence_ref: "" }, "CONSENT_INVALID"],
  ] as const;
  for (const [change, expected] of cases) {
    const ctx = context(); ctx.consent = { ...ctx.consent!, ...change };
    assert.equal(evaluate(input, ctx, now).reason, expected);
  }
});

test("missing DNC and seller authorization fail closed", () => {
  const ctx = context(); ctx.dnc = null;
  assert.equal(evaluate(input, ctx, now).reason, "DNC_UNAVAILABLE");
  ctx.dnc = { ...context().dnc!, authorized: false };
  assert.equal(evaluate(input, ctx, now).reason, "DNC_UNAVAILABLE");
  ctx.dnc = { ...context().dnc!, seller_id: "another-seller" };
  assert.equal(evaluate(input, ctx, now).reason, "DNC_UNAVAILABLE");
});

test("DNC age accepts exactly 31 days and blocks even one millisecond older", () => {
  const ctx = context();
  ctx.dnc!.downloaded_at = new Date(now.getTime() - 31 * 86400000).toISOString();
  assert.equal(evaluate(input, ctx, now).decision, "ALLOW");
  ctx.dnc!.downloaded_at = new Date(now.getTime() - 31 * 86400000 - 1).toISOString();
  assert.equal(evaluate(input, ctx, now).reason, "DNC_STALE");
  ctx.dnc!.downloaded_at = new Date(now.getTime() + 1).toISOString();
  assert.equal(evaluate(input, ctx, now).reason, "DNC_STALE");
});

test("DNC coverage and listed number are checked independently", () => {
  const ctx = context(); ctx.dnc!.area_codes = ["212"];
  assert.equal(evaluate(input, ctx, now).reason, "DNC_COVERAGE_MISSING");
  ctx.dnc!.area_codes = ["415"]; ctx.dnc!.blocked_phones = [input.phone];
  assert.equal(evaluate(input, ctx, now).reason, "DNC_LISTED");
});

test("DNC optionality comes only from an approved policy", () => {
  const ctx = context(); ctx.policy!.requires_dnc = false; ctx.dnc = null;
  assert.equal(evaluate(input, ctx, now).decision, "ALLOW");
  ctx.policy!.approved = false;
  assert.equal(evaluate(input, ctx, now).reason, "POLICY_NOT_APPROVED");
});

test("unknown state, timezone and location provenance are blocked", () => {
  assert.equal(evaluate({ ...input, state: "NY" }, context(), now).reason, "JURISDICTION_NOT_SUPPORTED");
  assert.equal(evaluate({ ...input, timezone: "America/Unknown" }, context(), now).reason, "INVALID_TIMEZONE");
  assert.equal(evaluate({ ...input, location_source: "area_code" }, context(), now).reason, "LOCATION_UNVERIFIED");
  assert.equal(evaluate({ ...input, location_source: "" }, context(), now).reason, "LOCATION_UNVERIFIED");
});

test("calling window includes opening and excludes closing", () => {
  assert.equal(evaluate(input, context(), new Date("2026-11-05T17:00:00Z")).decision, "ALLOW");
  assert.equal(evaluate(input, context(), new Date("2026-11-05T16:59:59Z")).reason, "OUTSIDE_CALLING_WINDOW");
  assert.equal(evaluate(input, context(), new Date("2026-11-06T04:00:00Z")).reason, "OUTSIDE_CALLING_WINDOW");
});

test("IANA timezone applies daylight saving offset rather than a fixed UTC offset", () => {
  const summer = context(); summer.dnc!.downloaded_at = "2026-06-30T00:00:00Z";
  summer.consent!.captured_at = "2026-06-01T00:00:00Z";
  assert.equal(evaluate(input, summer, new Date("2026-07-01T16:00:00Z")).decision, "ALLOW");
  assert.equal(evaluate(input, summer, new Date("2026-07-01T15:59:59Z")).reason, "OUTSIDE_CALLING_WINDOW");
});

test("unapproved, expired and malformed policies cannot authorize", () => {
  const ctx = context(); ctx.policy = null;
  assert.equal(evaluate(input, ctx, now).reason, "POLICY_NOT_APPROVED");
  ctx.policy = { ...context().policy!, effective_until: now.toISOString() };
  assert.equal(evaluate(input, ctx, now).reason, "POLICY_NOT_EFFECTIVE");
  ctx.policy = { ...context().policy!, window_start: "20:00", window_end: "09:00" };
  assert.equal(evaluate(input, ctx, now).decision, "BLOCK");
});

test("seller isolation, pause, quota and subscription are enforced", () => {
  assert.equal(evaluate({ ...input, seller_id: "another-seller" }, context(), now).reason, "SELLER_MISMATCH");
  const cases = [
    [{ paused: true }, "PAUSED"], [{ quota_remaining: 0 }, "QUOTA_EXCEEDED"],
    [{ subscription_active: false }, "SUBSCRIPTION_INACTIVE"],
  ] as const;
  for (const [change, reason] of cases) assert.equal(evaluate(input, { ...context(), ...change }, now).reason, reason);
});

test("invalid phone, unknown provider and malformed runtime input fail closed", () => {
  assert.equal(evaluate({ ...input, phone: "4155550123" }, context(), now).reason, "INVALID_INPUT");
  assert.equal(evaluate({ ...input, provider: "other" } as unknown as CallInput, context(), now).reason, "INVALID_INPUT");
  assert.equal(evaluate(null as unknown as CallInput, context(), now).decision, "BLOCK");
  assert.equal(evaluate(input, null as unknown as EvaluationContext, now).decision, "BLOCK");
  assert.equal(evaluate(input, context(), new Date("invalid")).decision, "BLOCK");
});

test("evaluation does not mutate caller-owned evidence", () => {
  const ctx = context(); const before = JSON.stringify(ctx);
  evaluate(input, ctx, now);
  assert.equal(JSON.stringify(ctx), before);
});
