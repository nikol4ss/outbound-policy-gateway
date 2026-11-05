import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { CallInput, Provider } from "../domain/types.ts";
import type { DispatchResult, NormalizedWebhook, ProviderConfig } from "./types.ts";

export type { DispatchResult, NormalizedWebhook, ProviderConfig } from "./types.ts";

const PHONE = /^\+1[2-9]\d{2}[2-9]\d{6}$/;

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Transport only. The gateway owns policy checks, evidence persistence and attempt state. */
export async function dispatch(provider: Provider, config: ProviderConfig, input: CallInput, idempotencyKey: string, transport: typeof fetch = fetch): Promise<DispatchResult> {
  const result = (status: DispatchResult["status"], reason: string, http_status?: number): DispatchResult => ({ status, provider, reason, ...(http_status ? { http_status } : {}) });
  if (!["vapi", "retell"].includes(provider) || !input || input.provider !== provider || !PHONE.test(input.phone) || !/^[A-Za-z0-9_-]{5,255}$/.test(idempotencyKey)) {
    return result("rejected", "PROVIDER_INPUT_INVALID");
  }
  if (!config || !text(config.apiKey) ||
      (provider === "vapi" && (!text(config.assistantId) || !text(config.phoneNumberId))) ||
      (provider === "retell" && !PHONE.test(config.fromNumber ?? ""))) return result("rejected", "PROVIDER_CONFIGURATION_INVALID");
  const metadata = { gateway_call_id: idempotencyKey };
  const body = provider === "vapi"
    ? { assistantId: config.assistantId, phoneNumberId: config.phoneNumberId, customer: { number: input.phone }, metadata }
    : { from_number: config.fromNumber, to_number: input.phone, idempotency_key: idempotencyKey, metadata,
        ...(text(config.assistantId) ? { override_agent_id: config.assistantId } : {}) };
  try {
    const response = await transport(provider === "vapi" ? "https://api.vapi.ai/call" : "https://api.retellai.com/v2/create-phone-call", {
      method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000), redirect: "error",
    });
    // A timeout response or server failure may follow a successfully created call.
    if (response.status >= 500 || response.status === 408 || response.status === 425 || (response.status >= 300 && response.status < 400)) {
      return result("unknown", "PROVIDER_RESPONSE_UNCERTAIN", response.status);
    }
    if (!response.ok) return result("rejected", "PROVIDER_REJECTED", response.status);
    const payload = record(await response.json());
    const providerCallId = provider === "vapi" ? payload.id : payload.call_id;
    if (!text(providerCallId) || !/^[A-Za-z0-9_-]{1,200}$/.test(providerCallId)) return result("unknown", "PROVIDER_RESPONSE_UNCERTAIN", response.status);
    return { ...result("accepted", "PROVIDER_ACCEPTED", response.status), provider_call_id: providerCallId };
  } catch {
    // Never retry here: the remote side may have accepted a request before the connection failed.
    return result("unknown", "PROVIDER_NETWORK_UNCERTAIN");
  }
}

export function sandboxDispatch(provider: Provider, idempotencyKey: string): DispatchResult {
  if (!["vapi", "retell"].includes(provider) || !/^[A-Za-z0-9_-]{5,255}$/.test(idempotencyKey)) {
    return { status: "rejected", provider, reason: "PROVIDER_INPUT_INVALID", sandbox: true };
  }
  return { status: "accepted", provider, reason: "SANDBOX_ACCEPTED", sandbox: true,
    provider_call_id: `sandbox_${provider}_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}` };
}

function sameSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vapi bearer credentials provide authentication, not signed timestamp/replay protection. */
export function verifyWebhook(provider: Provider, rawBody: string, headers: Headers, secret: string, nowMs = Date.now()): boolean {
  if (!text(secret) || typeof rawBody !== "string" || !Number.isFinite(nowMs)) return false;
  if (provider === "vapi") return sameSecret(headers.get("authorization") ?? "", `Bearer ${secret}`);
  if (provider !== "retell") return false;
  const match = /^v=(\d{13}),d=([a-fA-F0-9]{64})$/.exec(headers.get("x-retell-signature") ?? "");
  if (!match || Math.abs(nowMs - Number(match[1])) > 300_000) return false;
  const expected = createHmac("sha256", secret).update(rawBody + match[1]).digest();
  return timingSafeEqual(expected, Buffer.from(match[2], "hex"));
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function timestamp(value: unknown): string | undefined {
  const milliseconds = typeof value === "number" ? value : (typeof value === "string" ? Date.parse(value) : NaN);
  if (!Number.isFinite(milliseconds)) return undefined;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function reason(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
}

/** Only persist this allowlisted projection; raw webhook bodies may contain audio and transcripts. */
export function normalizeWebhook(provider: Provider, payload: unknown): NormalizedWebhook | null {
  const outer = record(payload), message = provider === "vapi" ? record(outer.message) : outer;
  const call = record(message.call);
  const callId = provider === "vapi" ? call.id : call.call_id;
  const eventType = provider === "vapi" ? message.type : message.event;
  if (!["vapi", "retell"].includes(provider) || !text(callId) || !/^[A-Za-z0-9_-]{1,200}$/.test(callId) ||
      !text(eventType) || !/^[a-zA-Z0-9_-]{1,100}$/.test(eventType)) return null;
  const status: NormalizedWebhook["status"] = provider === "retell"
    ? ({ call_started: "started", call_ended: "ended", call_analyzed: "analyzed" } as const)[eventType as "call_started"] ?? "other"
    : eventType === "end-of-call-report" ? "ended" : (eventType === "status-update" && message.status === "in-progress" ? "started" : "other");
  const structured = provider === "retell" ? record(record(call.call_analysis).custom_analysis_data) : record(record(message.analysis).structuredData);
  const occurredAt = provider === "retell"
    ? timestamp(status === "started" ? call.start_timestamp : call.end_timestamp)
    : timestamp(message.timestamp ?? (status === "started" ? call.startedAt : call.endedAt));
  const duration = provider === "retell" ? call.duration_ms : (typeof message.durationSeconds === "number" ? message.durationSeconds * 1000 : undefined);
  const endedReason = reason(provider === "retell" ? call.disconnection_reason : message.endedReason);
  const event = {
    provider, provider_call_id: callId, event_type: eventType, status, opt_out: structured.opt_out === true,
    ...(occurredAt ? { occurred_at: occurredAt } : {}),
    ...(typeof duration === "number" && Number.isFinite(duration) && duration >= 0 ? { duration_ms: Math.round(duration) } : {}),
    ...(endedReason ? { ended_reason: endedReason } : {}),
  };
  return { ...event, event_id: createHash("sha256").update(JSON.stringify(event)).digest("hex") };
}
