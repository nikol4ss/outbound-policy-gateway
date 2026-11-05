import type { Provider } from "../domain/types.ts";

export interface ProviderConfig {
  apiKey: string;
  assistantId?: string;
  fromNumber?: string;
  phoneNumberId?: string;
}

export interface DispatchResult {
  status: "accepted" | "rejected" | "unknown";
  provider: Provider;
  provider_call_id?: string;
  reason: string;
  http_status?: number;
  sandbox?: boolean;
}

export interface NormalizedWebhook {
  provider: Provider;
  event_id: string;
  provider_call_id: string;
  event_type: string;
  status: "started" | "ended" | "analyzed" | "other";
  occurred_at?: string;
  opt_out: boolean;
  duration_ms?: number;
  ended_reason?: string;
}
