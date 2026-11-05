export type Provider = "vapi" | "retell";

export interface CallInput {
  phone: string;
  seller_id: string;
  campaign: string;
  consent_id: string;
  provider: Provider;
  state: string;
  timezone: string;
  location_source: string;
}

export interface Policy {
  id: string;
  version: string;
  approved: boolean;
  allowed_states: string[];
  effective_from: string;
  effective_until: string;
  window_start: string;
  window_end: string;
  requires_dnc: boolean;
  disclosure: string;
}

export interface Consent {
  id: string;
  seller_id: string;
  phone: string;
  scope: "marketing";
  captured_at: string;
  expires_at?: string;
  revoked_at?: string;
  disclosure: string;
  source: string;
  evidence_ref: string;
}

export interface DncSnapshot {
  seller_id: string;
  downloaded_at: string;
  area_codes: string[];
  blocked_phones: string[];
  authorized: boolean;
  version: string;
}

export interface EvaluationContext {
  workspace_id: string;
  seller_id: string;
  mode: "sandbox" | "live";
  paused: boolean;
  policy: Policy | null;
  consent: Consent | null;
  opted_out: boolean;
  dnc: DncSnapshot | null;
  subscription_active: boolean;
  quota_remaining: number;
}

export type DecisionReason =
  | "ELIGIBLE"
  | "INVALID_INPUT"
  | "INVALID_CONTEXT"
  | "SELLER_MISMATCH"
  | "PAUSED"
  | "POLICY_NOT_APPROVED"
  | "POLICY_NOT_EFFECTIVE"
  | "JURISDICTION_NOT_SUPPORTED"
  | "LOCATION_UNVERIFIED"
  | "INVALID_TIMEZONE"
  | "OPTED_OUT"
  | "CONSENT_NOT_FOUND"
  | "CONSENT_MISMATCH"
  | "CONSENT_INVALID"
  | "CONSENT_REVOKED"
  | "CONSENT_EXPIRED"
  | "DNC_UNAVAILABLE"
  | "DNC_STALE"
  | "DNC_COVERAGE_MISSING"
  | "DNC_LISTED"
  | "OUTSIDE_CALLING_WINDOW"
  | "SUBSCRIPTION_INACTIVE"
  | "QUOTA_EXCEEDED";

export interface EvaluationResult {
  decision: "ALLOW" | "BLOCK";
  reason: DecisionReason;
  policy_version: string | null;
  required_disclosure?: string;
}
