import type { CallInput, DecisionReason, EvaluationContext, EvaluationResult } from "./types.ts";

const DAY_MS = 86_400_000;
const LOCATION_SOURCES = new Set(["customer_attestation", "verified_address", "crm_verified"]);
// Split-zone states still require a verified recipient timezone; this is not geolocation.
const STATE_ZONES: Record<string, string[]> = {
  AL: ["America/Chicago"], AK: ["America/Anchorage", "America/Juneau", "America/Sitka", "America/Metlakatla", "America/Yakutat", "America/Nome", "America/Adak"],
  AZ: ["America/Phoenix", "America/Denver"], AR: ["America/Chicago"], CA: ["America/Los_Angeles"], CO: ["America/Denver"],
  CT: ["America/New_York"], DE: ["America/New_York"], DC: ["America/New_York"], FL: ["America/New_York", "America/Chicago"],
  GA: ["America/New_York"], HI: ["Pacific/Honolulu"], ID: ["America/Boise", "America/Los_Angeles"], IL: ["America/Chicago"],
  IN: ["America/Indiana/Indianapolis", "America/Indianapolis", "America/Indiana/Vincennes", "America/Indiana/Winamac", "America/Indiana/Marengo", "America/Indiana/Petersburg", "America/Indiana/Vevay", "America/Indiana/Knox", "America/Indiana/Tell_City", "America/Chicago"],
  IA: ["America/Chicago"], KS: ["America/Chicago", "America/Denver"], KY: ["America/New_York", "America/Kentucky/Louisville", "America/Louisville", "America/Kentucky/Monticello", "America/Chicago"],
  LA: ["America/Chicago"], ME: ["America/New_York"], MD: ["America/New_York"], MA: ["America/New_York"], MI: ["America/Detroit", "America/Menominee"],
  MN: ["America/Chicago"], MS: ["America/Chicago"], MO: ["America/Chicago"], MT: ["America/Denver"], NE: ["America/Chicago", "America/Denver"],
  NV: ["America/Los_Angeles", "America/Denver"], NH: ["America/New_York"], NJ: ["America/New_York"], NM: ["America/Denver"], NY: ["America/New_York"],
  NC: ["America/New_York"], ND: ["America/Chicago", "America/Denver", "America/North_Dakota/Center", "America/North_Dakota/New_Salem", "America/North_Dakota/Beulah"],
  OH: ["America/New_York"], OK: ["America/Chicago"], OR: ["America/Los_Angeles", "America/Boise"], PA: ["America/New_York"], RI: ["America/New_York"],
  SC: ["America/New_York"], SD: ["America/Chicago", "America/Denver"], TN: ["America/New_York", "America/Chicago"], TX: ["America/Chicago", "America/Denver"],
  UT: ["America/Denver"], VT: ["America/New_York"], VA: ["America/New_York"], WA: ["America/Los_Angeles"], WV: ["America/New_York"], WI: ["America/Chicago"], WY: ["America/Denver"],
};

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  return Date.parse(value);
}

function minutes(value: unknown): number {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/** Pure evaluation only. Callers must persist evidence and re-evaluate before dispatch. */
export function evaluate(input: CallInput, context: EvaluationContext, now = new Date()): EvaluationResult {
  const policy = context?.policy;
  const policyVersion = present(policy?.version) ? policy.version : null;
  const block = (reason: DecisionReason): EvaluationResult => ({ decision: "BLOCK", reason, policy_version: policyVersion });
  if (!input || !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(input.phone) ||
      !["vapi", "retell"].includes(input.provider) ||
      ![input.seller_id, input.campaign, input.consent_id].every(present)) return block("INVALID_INPUT");
  const nowMs = now instanceof Date ? now.getTime() : NaN;
  if (!context || !present(context.workspace_id) || !present(context.seller_id) ||
      !["sandbox", "live"].includes(context.mode) || typeof context.paused !== "boolean" ||
      typeof context.opted_out !== "boolean" || typeof context.subscription_active !== "boolean" ||
      !Number.isFinite(context.quota_remaining) || !Number.isFinite(nowMs)) return block("INVALID_CONTEXT");
  if (input.seller_id !== context.seller_id) return block("SELLER_MISMATCH");
  if (context.paused) return block("PAUSED");
  if (!policy || policy.approved !== true || !present(policy.id) || !policyVersion ||
      !present(policy.disclosure) || !Array.isArray(policy.allowed_states) ||
      typeof policy.requires_dnc !== "boolean") return block("POLICY_NOT_APPROVED");
  const effectiveFrom = instant(policy.effective_from), effectiveUntil = instant(policy.effective_until);
  const start = minutes(policy.window_start), end = minutes(policy.window_end);
  if (!Number.isFinite(effectiveFrom) || !Number.isFinite(effectiveUntil) || effectiveFrom >= effectiveUntil ||
      nowMs < effectiveFrom || nowMs >= effectiveUntil || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return block("POLICY_NOT_EFFECTIVE");
  }
  if (!Object.hasOwn(STATE_ZONES, input.state) || !policy.allowed_states.includes(input.state)) return block("JURISDICTION_NOT_SUPPORTED");
  if (!LOCATION_SOURCES.has(input.location_source)) return block("LOCATION_UNVERIFIED");
  if (!STATE_ZONES[input.state].includes(input.timezone)) return block("INVALID_TIMEZONE");
  let localMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: input.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    localMinutes = Number(parts.find((part) => part.type === "hour")?.value) * 60 + Number(parts.find((part) => part.type === "minute")?.value);
  } catch { return block("INVALID_TIMEZONE"); }
  if (!Number.isFinite(localMinutes)) return block("INVALID_TIMEZONE");
  if (context.opted_out) return block("OPTED_OUT");
  const consent = context.consent;
  if (!consent) return block("CONSENT_NOT_FOUND");
  if (consent.id !== input.consent_id || consent.seller_id !== input.seller_id || consent.phone !== input.phone) return block("CONSENT_MISMATCH");
  if (consent.revoked_at !== undefined && consent.revoked_at !== null) return block("CONSENT_REVOKED");
  const capturedAt = instant(consent.captured_at);
  if (consent.scope !== "marketing" || ![consent.source, consent.disclosure, consent.evidence_ref].every(present) ||
      !Number.isFinite(capturedAt) || capturedAt > nowMs) return block("CONSENT_INVALID");
  if (consent.expires_at !== undefined) {
    const expiresAt = instant(consent.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= capturedAt || nowMs >= expiresAt) return block("CONSENT_EXPIRED");
  }
  if (policy.requires_dnc) {
    const dnc = context.dnc;
    if (!dnc || dnc.authorized !== true || dnc.seller_id !== input.seller_id || !present(dnc.version) ||
        !Array.isArray(dnc.area_codes) || !Array.isArray(dnc.blocked_phones)) return block("DNC_UNAVAILABLE");
    const downloadedAt = instant(dnc.downloaded_at);
    if (!Number.isFinite(downloadedAt) || downloadedAt > nowMs || nowMs - downloadedAt > 31 * DAY_MS) return block("DNC_STALE");
    if (!dnc.area_codes.includes(input.phone.slice(2, 5))) return block("DNC_COVERAGE_MISSING");
    if (dnc.blocked_phones.includes(input.phone)) return block("DNC_LISTED");
  }
  if (localMinutes < start || localMinutes >= end) return block("OUTSIDE_CALLING_WINDOW");
  if (!context.subscription_active) return block("SUBSCRIPTION_INACTIVE");
  if (context.quota_remaining <= 0) return block("QUOTA_EXCEEDED");
  return { decision: "ALLOW", reason: "ELIGIBLE", policy_version: policyVersion, required_disclosure: policy.disclosure };
}
