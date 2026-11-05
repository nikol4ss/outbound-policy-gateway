"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiForm, type FormField } from "./api-form";
import { api, ApiError, dateLabel, display, phoneLabel, type RecordData } from "./api";
import { Brand, EmptyState, Icon } from "./ui";

type Tab = "overview" | "check" | "consents" | "optouts" | "policies" | "dnc" | "integrations" | "audit";
type Workspace = {
  id: string; name: string; seller_id: string; mode: "sandbox" | "live"; paused: boolean;
  subscription_active: boolean; quota_remaining: number; monthly_limit: number; period_usage: number;
  launch_gates?: { name: string; ready: boolean }[];
};
type Decision = RecordData & { id: string; created_at: string; decision: string; reason: string; policy_version: string; input?: { phone?: string; provider?: string; campaign?: string }; mode: string };
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "check", label: "Pre-call check" }, { id: "consents", label: "Consent" },
  { id: "optouts", label: "Opt-outs" }, { id: "policies", label: "Policies" }, { id: "dnc", label: "DNC lists" },
  { id: "integrations", label: "Integrations" }, { id: "audit", label: "Audit & usage" },
];
const providers = [{ value: "vapi", label: "Vapi" }, { value: "retell", label: "Retell" }];
const isoLocal = () => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); };

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [jobs, setJobs] = useState<RecordData[]>([]);
  const [integrations, setIntegrations] = useState<RecordData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [current, history, queue, connections] = await Promise.all([
        api<Workspace>("/v1/workspace"), api<{ data: Decision[] }>("/v1/decisions"),
        api<{ data: RecordData[] }>("/v1/jobs"), api<{ data: RecordData[] }>("/v1/integrations"),
      ]);
      setWorkspace(current);
      setDecisions(history.data);
      setJobs(queue.data);
      setIntegrations(connections.data);
      setError("");
      setRevision((value) => value + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { window.location.assign("/login"); return; }
      setError(err instanceof Error ? err.message : "Unable to load your workspace.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function togglePause() {
    if (!workspace) return;
    setMutating(true);
    try { await api("/v1/workspace", { method: "PATCH", body: JSON.stringify({ paused: !workspace.paused }) }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to change dispatch status."); }
    finally { setMutating(false); }
  }

  async function signOut() {
    try { await api("/api/logout", { method: "POST" }); window.location.assign("/login"); }
    catch { setError("Unable to sign out. Please try again."); }
  }

  return <div className="app-shell">
    <aside className="sidebar"><Brand/><nav aria-label="Workspace navigation">{tabs.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><Icon name={item.id}/>{item.label}</button>)}</nav><div className="sidebar-footer"><Link className="nav-item" href="/docs"><Icon name="docs"/>Documentation</Link><button className="nav-item" onClick={() => void signOut()}><Icon name="logout"/>Sign out</button></div></aside>
    <div className="workspace-shell"><header className="workspace-header"><strong>{workspace?.name ?? "Your workspace"}</strong><span className={`mode-label ${workspace?.mode === "live" ? "live" : ""}`}>{workspace?.mode === "live" ? "Live" : "Sandbox"}</span></header>
      <main id="main" className="workspace-main">
        {error && <div className="alert error" role="alert"><span>{error}</span><button className="button button-small button-secondary" onClick={() => void refresh()} disabled={refreshing}>Retry</button></div>}
        {loading ? <div className="loading-state" role="status">Loading your workspace…</div> : !workspace ? <EmptyState title="Workspace unavailable">Check your connection and try again.</EmptyState> : <>
          {tab === "overview" ? <div className="page-heading"><div><h1>Your calling policy, in one place.</h1><p>Review eligibility, record evidence, and keep every provider in sync.</p></div><button className="button" onClick={() => setTab("check")}>Run a pre-call check</button></div> : <div className="page-heading"><div><h1>{tabs.find((item) => item.id === tab)?.label}</h1><p>{descriptions[tab]}</p></div></div>}
          {workspace.mode === "sandbox" && <div className="sandbox-notice"><span aria-hidden="true">ⓘ</span><strong>Sandbox mode. Calls are simulated; no phone calls are placed.</strong></div>}
          {tab === "overview" && <>
            <div className="metrics-row"><div><strong>{(workspace.period_usage ?? 0).toLocaleString()}</strong><span>Decisions this month</span></div><div><strong>{jobs.filter((job) => job.status === "queued" || job.status === "pending").length}</strong><span>Calls queued</span></div><div><strong>{workspace.paused ? "Paused" : "Enabled"}</strong><span>Dispatch</span></div></div>
            <section className="section-block"><div className="section-heading"><h2>Recent decisions</h2><button className="button button-small button-secondary" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div><DecisionTable decisions={decisions.slice(0, 8)}/></section>
            <div className="overview-bottom"><section><h2>Production readiness</h2>{workspace.launch_gates?.length ? <ul className="readiness-list">{workspace.launch_gates.map((gate) => <li key={gate.name}><span className={`status-dot ${gate.ready ? "ready" : ""}`}/><span className={`status-text ${gate.ready ? "ready" : ""}`}>{gate.ready ? "Ready" : "Pending"}</span><span>{gate.name}</span></li>)}</ul> : <p className="muted">Production requirements have not been verified.</p>}</section><section><h2>Connected platforms</h2><ul className="platform-list">{providers.map((provider) => { const configured = integrations.some((item) => item.provider === provider.value && item.configured !== false); return <li key={provider.value}><strong>{provider.label}</strong><span className="status-text">{configured ? "Configured" : "Not configured"}</span><button className="button button-small button-secondary" onClick={() => setTab("integrations")}>Configure</button></li>; })}</ul></section></div>
          </>}
          {tab === "check" && <CheckPanel workspace={workspace} onSaved={refresh}/>}
          {tab === "consents" && <ConsentPanel workspace={workspace} revision={revision} onSaved={refresh}/>}
          {tab === "optouts" && <OptOutPanel revision={revision} onSaved={refresh}/>}
          {tab === "policies" && <PolicyPanel revision={revision} onSaved={refresh}/>}
          {tab === "dnc" && <DncPanel revision={revision} onSaved={refresh}/>}
          {tab === "integrations" && <IntegrationPanel onSaved={refresh}/>}
          {tab === "audit" && <AuditPanel workspace={workspace} decisions={decisions} jobs={jobs} refreshing={refreshing} onRefresh={refresh}/>}
          <footer className="workspace-footer"><span>Seller: <code>{workspace.seller_id}</code></span><button className={`button button-small ${workspace.paused ? "button-secondary" : "button-danger"}`} onClick={() => void togglePause()} disabled={mutating}>{mutating ? "Updating…" : workspace.paused ? "Resume dispatch" : "Pause dispatch"}</button></footer>
        </>}
      </main>
    </div>
  </div>;
}

const descriptions: Record<Tab, string> = {
  overview: "", check: "Evaluate a call against the current policy before sending it to a provider.",
  consents: "Keep the source, scope, and evidence of each seller’s permission to call.",
  optouts: "Block future marketing calls from this seller across both providers.",
  policies: "Define the supported coverage, calling window, and required checks.",
  dnc: "Import an authorized National DNC snapshot for this seller.",
  integrations: "Connect your own provider accounts. Credentials remain server-side.",
  audit: "Review decision evidence, queue outcomes, and workspace usage.",
};

function DecisionTable({ decisions }: { decisions: Decision[] }) {
  return <div className="table-frame"><div className="table-scroll"><table><thead><tr><th>Decision</th><th>Phone</th><th>Provider</th><th>Reason</th><th>Time</th></tr></thead><tbody>{decisions.map((item) => <tr key={item.id}><td><span className={`decision ${item.decision === "ALLOW" ? "allow" : "block"}`}>{item.decision}</span></td><td className="mono">{phoneLabel(item.input?.phone)}</td><td>{display(item.input?.provider)}</td><td className="reason-cell">{item.reason.replaceAll("_", " ").toLowerCase()}</td><td className="nowrap">{dateLabel(item.created_at)}</td></tr>)}</tbody></table></div>{decisions.length === 0 && <EmptyState title="No decisions yet">Run your first check to start an audit trail.</EmptyState>}</div>;
}

function CheckPanel({ workspace, onSaved }: { workspace: Workspace; onSaved: () => Promise<void> }) {
  const [result, setResult] = useState<RecordData | null>(null);
  const fields: FormField[] = [
    { name: "phone", label: "Phone number", required: true, placeholder: "+14155550123", help: "Use E.164 format, including the country code." },
    { name: "provider", label: "Voice provider", type: "select", options: providers, defaultValue: "vapi", required: true },
    { name: "campaign", label: "Campaign", required: true, placeholder: "lead_followup" },
    { name: "consent_id", label: "Consent ID", required: true, placeholder: "Paste a recorded consent ID" },
    { name: "state", label: "Recipient state", required: true, placeholder: "CA", help: "Use the verified two-letter state code." },
    { name: "timezone", label: "Recipient time zone", required: true, placeholder: "America/Los_Angeles", help: "Use an IANA time zone, not an area-code estimate." },
    { name: "location_source", label: "Location source", required: true, placeholder: "customer-provided address", wide: true },
  ];
  const decision = typeof result?.decision === "string" ? result.decision : typeof (result?.decision as RecordData)?.decision === "string" ? String((result?.decision as RecordData).decision) : "";
  return <div className="split-panel"><section><h2>Call details</h2><ApiForm fields={fields} endpoint="/v1/checks" submitLabel="Evaluate only" extra={{ seller_id: workspace.seller_id }} secondaryAction={{ endpoint: "/v1/calls", label: workspace.mode === "sandbox" ? "Queue simulated call" : "Queue call" }} onSaved={(data) => { setResult(data); void onSaved(); }}/><p className="field-note">Evaluation does not place a call. Dispatch rechecks the policy before contacting the provider.</p></section><aside className="result-panel"><h2>Decision result</h2>{result ? <><span className={`decision ${decision === "ALLOW" ? "allow" : decision === "BLOCK" ? "block" : ""}`}>{decision || String(result.status ?? "Recorded")}</span><pre className="json-result">{JSON.stringify(result, null, 2)}</pre></> : <EmptyState title="Ready when you are">Submit the call details to see the decision and its evidence reference.</EmptyState>}</aside></div>;
}

function ResourceList({ endpoint, columns, revision }: { endpoint: string; columns: { key: string; label: string; phone?: boolean }[]; revision: number }) {
  const [items, setItems] = useState<RecordData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<{ data: RecordData[] }>(endpoint).then((result) => { if (active) { setItems(result.data); setError(""); } }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load records."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, revision]);
  if (error) return <p className="form-message error" role="alert">{error}</p>;
  if (loading) return <p className="muted" role="status">Loading records…</p>;
  return <div className="table-frame resource-table"><div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={String(item.id ?? index)}>{columns.map((column) => <td key={column.key} className={column.key === "id" ? "mono id-cell" : ""}>{column.phone ? phoneLabel(item[column.key]) : display(item[column.key])}</td>)}</tr>)}</tbody></table></div>{items.length === 0 && <EmptyState title="No records yet">New records will appear here after you save them.</EmptyState>}</div>;
}

function ConsentPanel({ workspace, revision, onSaved }: { workspace: Workspace; revision: number; onSaved: () => Promise<void> }) {
  const [saved, setSaved] = useState<string>("");
  const fields: FormField[] = [
    { name: "phone", label: "Phone number", required: true, placeholder: "+14155550123" },
    { name: "source", label: "Consent source", required: true, placeholder: "Website opt-in form" },
    { name: "captured_at", label: "Captured at", type: "datetime-local", parse: "date", required: true, defaultValue: isoLocal() },
    { name: "expires_at", label: "Expires at (optional)", type: "datetime-local", parse: "date" },
    { name: "disclosure", label: "Exact consent disclosure", type: "textarea", required: true, wide: true, help: "Preserve the text that was presented to the recipient." },
    { name: "evidence_ref", label: "Evidence reference", required: true, placeholder: "Evidence object ID or authorized source reference", wide: true },
  ];
  return <><section className="form-section"><h2>Record consent</h2><p className="muted">Recording evidence does not establish that the consent is legally sufficient.</p><ApiForm fields={fields} endpoint="/v1/consents" submitLabel="Record consent" extra={{ seller_id: workspace.seller_id, scope: "marketing" }} onSaved={(data) => { setSaved(String(data.id ?? "")); void onSaved(); }}/>{saved && <p className="saved-reference" role="status">Consent ID: <code>{saved}</code></p>}</section><section className="section-block"><h2>Recorded consent</h2><ResourceList endpoint="/v1/consents" revision={revision} columns={[{ key: "id", label: "Consent ID" }, { key: "phone", label: "Phone", phone: true }, { key: "source", label: "Source" }, { key: "captured_at", label: "Captured" }, { key: "scope", label: "Scope" }]}/></section></>;
}

function OptOutPanel({ revision, onSaved }: { revision: number; onSaved: () => Promise<void> }) {
  return <><section className="form-section narrow-form"><h2>Record an opt-out</h2><p className="muted">Applies to future marketing calls for this seller across Vapi and Retell. Calls already accepted by a provider may be in progress.</p><ApiForm endpoint="/v1/opt-outs" submitLabel="Block future calls" fields={[{ name: "phone", label: "Phone number", required: true, placeholder: "+14155550123" }, { name: "reason", label: "Source or reason", required: true, placeholder: "Recipient requested no further calls" }]} onSaved={() => void onSaved()}/></section><section className="section-block"><h2>Seller suppression list</h2><ResourceList endpoint="/v1/opt-outs" revision={revision} columns={[{ key: "phone", label: "Phone", phone: true }, { key: "reason", label: "Reason" }, { key: "created_at", label: "Recorded" }]}/></section></>;
}

function PolicyPanel({ revision, onSaved }: { revision: number; onSaved: () => Promise<void> }) {
  const fields: FormField[] = [
    { name: "version", label: "Policy version", required: true, placeholder: "2026-11-05-v1" },
    { name: "allowed_states", label: "Supported states", required: true, parse: "list", placeholder: "CA, NY", help: "Only include coverage reviewed for this campaign type." },
    { name: "effective_from", label: "Effective from", type: "datetime-local", parse: "date", required: true, defaultValue: isoLocal() },
    { name: "effective_until", label: "Effective until", type: "datetime-local", parse: "date", required: true },
    { name: "window_start", label: "Calling window starts", type: "time", required: true, defaultValue: "09:00" },
    { name: "window_end", label: "Calling window ends", type: "time", required: true, defaultValue: "17:00" },
    { name: "disclosure", label: "Required calling disclosure", type: "textarea", required: true, wide: true },
    { name: "requires_dnc", label: "Require a valid National DNC snapshot", type: "checkbox", defaultValue: true, wide: true },
  ];
  return <><section className="form-section"><h2>Publish a policy version</h2><p className="muted">Times apply in the recipient’s verified time zone. Saving a policy does not grant legal approval for live use.</p><ApiForm fields={fields} endpoint="/v1/policies" submitLabel="Save policy version" onSaved={() => void onSaved()}/></section><section className="section-block"><h2>Policy history</h2><ResourceList endpoint="/v1/policies" revision={revision} columns={[{ key: "version", label: "Version" }, { key: "allowed_states", label: "States" }, { key: "window_start", label: "From" }, { key: "window_end", label: "Until" }, { key: "approved", label: "Approved" }]}/></section></>;
}

function DncPanel({ revision, onSaved }: { revision: number; onSaved: () => Promise<void> }) {
  const fields: FormField[] = [
    { name: "version", label: "Snapshot version", required: true, placeholder: "seller-registry-2026-11-05" },
    { name: "downloaded_at", label: "Downloaded at", type: "datetime-local", parse: "date", required: true, defaultValue: isoLocal() },
    { name: "area_codes", label: "Authorized area codes", required: true, parse: "list", placeholder: "415, 212", help: "Comma-separated codes covered by this seller’s access." },
    { name: "blocked_phones", label: "Blocked phone numbers", type: "textarea", parse: "list", wide: true, placeholder: "+14155550123\n+12125550123", help: "One E.164 number per line, or comma-separated. Empty means this snapshot contains no blocked numbers." },
    { name: "authorized", label: "I confirm this seller is authorized to use this snapshot and its listed coverage.", type: "checkbox", wide: true },
  ];
  return <><section className="form-section"><h2>Import a snapshot</h2><p className="muted">This form does not access the National DNC registry. Upload only data obtained through the seller’s authorized access. Missing, expired, or uncovered snapshots block calls when DNC is required.</p><ApiForm fields={fields} endpoint="/v1/dnc" submitLabel="Import DNC snapshot" onSaved={() => void onSaved()}/></section><section className="section-block"><h2>Imported snapshots</h2><ResourceList endpoint="/v1/dnc" revision={revision} columns={[{ key: "version", label: "Version" }, { key: "downloaded_at", label: "Downloaded" }, { key: "area_codes", label: "Coverage" }, { key: "authorized", label: "Authorized" }]}/></section></>;
}

function IntegrationPanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const [provider, setProvider] = useState("vapi");
  const fields: FormField[] = [
    { name: "api_key", label: "Provider API key", type: "password", required: true, wide: true },
    { name: "assistant_id", label: provider === "vapi" ? "Assistant ID" : "Agent ID", required: true },
    ...(provider === "vapi" ? [{ name: "phone_number_id", label: "Vapi phone number ID", required: true } satisfies FormField] : [{ name: "from_number", label: "From phone number", required: true, placeholder: "+14155550100" } satisfies FormField]),
    { name: "webhook_secret", label: "Webhook verification secret", type: "password", required: true, wide: true, help: provider === "vapi" ? "Configure the matching secret on the provider’s webhook requests." : "Use the key required by your Retell webhook signature configuration." },
  ];
  return <section className="form-section"><div className="provider-selector" role="group" aria-label="Select a provider">{providers.map((item) => <button key={item.value} className={`button ${provider === item.value ? "" : "button-secondary"}`} onClick={() => setProvider(item.value)}>{item.label}</button>)}</div><h2>Connect {provider === "vapi" ? "Vapi" : "Retell"}</h2><p className="muted">Use a dedicated provider credential for this workspace. Saving credentials does not verify production readiness.</p><ApiForm key={provider} fields={fields} endpoint="/v1/integrations" submitLabel="Save connection" extra={{ provider }} resetAfterSave onSaved={() => void onSaved()}/><p className="field-note">Webhook endpoint: <code>/v1/webhooks/{provider}</code>. <Link className="text-link" href={`/integrations/${provider}`}>Read the integration guide</Link>.</p></section>;
}

function AuditPanel({ workspace, decisions, jobs, refreshing, onRefresh }: { workspace: Workspace; decisions: Decision[]; jobs: RecordData[]; refreshing: boolean; onRefresh: () => Promise<void> }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  async function exportAudit() {
    setExporting(true); setExportError("");
    try {
      const data = await api<RecordData>("/v1/audit/exports");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `call-policy-audit-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "Unable to export audit records."); }
    finally { setExporting(false); }
  }
  return <><div className="metrics-row"><div><strong>{(workspace.period_usage ?? 0).toLocaleString()}</strong><span>Unique evaluations this month</span></div><div><strong>{(workspace.quota_remaining ?? 0).toLocaleString()}</strong><span>Evaluations remaining</span></div><div><strong>{workspace.subscription_active ? "Active" : "Inactive"}</strong><span>Workspace access</span></div></div><p className="field-note">Pilot offer: $79/month · 3 workspaces · 10,000 unique evaluations. Paid checkout stays unavailable until merchant approval. Opt-outs remain available regardless of billing status.</p><section className="section-block"><div className="section-heading"><h2>Decision evidence</h2><div className="inline-actions"><button className="button button-small button-secondary" onClick={() => void onRefresh()} disabled={refreshing}>Refresh</button><button className="button button-small" disabled={exporting} onClick={() => void exportAudit()}>{exporting ? "Exporting…" : "Export audit JSON"}</button></div></div>{exportError && <p className="form-message error" role="alert">{exportError}</p>}<DecisionTable decisions={decisions}/></section><section className="section-block"><h2>Call requests</h2><div className="table-frame"><div className="table-scroll"><table><thead><tr><th>Request ID</th><th>Status</th><th>Provider</th><th>Created</th></tr></thead><tbody>{jobs.map((job) => <tr key={String(job.id)}><td className="mono id-cell">{display(job.id)}</td><td>{display(job.status)}</td><td>{display(job.provider ?? (job.input as RecordData | undefined)?.provider)}</td><td>{dateLabel(job.created_at)}</td></tr>)}</tbody></table></div>{jobs.length === 0 && <EmptyState title="No call requests">Queued call requests and their outcomes will appear here.</EmptyState>}</div></section></>;
}
