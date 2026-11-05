import { randomUUID } from 'node:crypto';
import type { CallInput, Consent, DncSnapshot, EvaluationContext, Policy, Provider } from '../domain/types.ts';
import { evaluate } from '../domain/policy.ts';
import { dispatch, sandboxDispatch } from '../providers/index.ts';
import type { ProviderConfig } from '../providers/types.ts';
import type { Config } from './config.ts';
import { canonical, hash } from './evidence.ts';
import type { Evidence, EvidenceEvent } from './evidence.ts';
import { Store } from './store.ts';
import type { Data, Row } from './store.ts';
import { HttpError, decrypt, encrypt, callSchema, consentSchema, policySchema, dncSchema, integrationSchema, phone } from './security.ts';

export class GatewayService {
  store: Store; evidence: Evidence; settings: Config;
  constructor(store: Store, evidence: Evidence, settings: Config) { this.store = store; this.evidence = evidence; this.settings = settings; }
  async record(kind: string, data: Data, lookupKey = '', id = randomUUID()): Promise<Row> {
    const event: EvidenceEvent = { ...data, id, workspace_id: this.store.workspaceId, kind, created_at: new Date().toISOString() };
    const receipt = await this.evidence.write(event);
    return this.store.append(kind, id, { ...event, evidence: receipt }, lookupKey);
  }
  async workspace() {
    const workspace = await this.store.workspace();
    if (!workspace) throw new HttpError(404,'WORKSPACE_NOT_FOUND');
    const used = await this.store.usage(new Date().toISOString().slice(0,7));
    const policy = await this.store.latest('policy','active');
    return { ...workspace, id: this.store.workspaceId, mode: this.settings.mode,
      period_usage: used, quota_remaining: Math.max(0,Number(workspace.monthly_limit) - used),
      launch_gates: [
        { name: 'Legal coverage approved', ready: Boolean(this.settings.legalReference) },
        { name: 'Policy content approved', ready: Boolean(policy && this.policyApproved(policy as unknown as Policy)) },
        { name: 'PostgreSQL configured', ready: Boolean(this.settings.databaseUrl) },
        { name: 'Protected evidence configured', ready: Boolean(this.settings.bucket && Object.keys(this.settings.retention).length) },
        { name: 'Live dispatch enabled', ready: this.settings.liveEnabled },
        { name: 'Billing approved', ready: process.env.LEMON_SQUEEZY_APPROVED === 'true' && Boolean(process.env.BILLING_APPROVAL_REFERENCE) }
      ] };
  }
  private policyApproved(policy: Policy) {
    const { id: _id, approved: _approved, ...content } = policySchema.parse(policy);
    return this.settings.mode === 'sandbox' || (Boolean(this.settings.legalReference) && this.settings.approvedVersions.includes(policy.version) && this.settings.approvedPolicyHashes.includes(hash(canonical(content))));
  }
  async createConsent(body: unknown) {
    const value = consentSchema.parse(body); const workspace = await this.workspace();
    if (value.seller_id !== workspace.seller_id) throw new HttpError(403,'SELLER_MISMATCH');
    if (Date.parse(value.captured_at) > Date.now()) throw new HttpError(422,'CONSENT_IN_FUTURE');
    if (value.expires_at && value.expires_at <= value.captured_at) throw new HttpError(422,'INVALID_CONSENT_INTERVAL');
    const id = value.id ?? randomUUID();
    if (await this.store.get('consent',id)) throw new HttpError(409,'CONSENT_ALREADY_EXISTS');
    return this.record('consent', value, value.phone, id);
  }
  async createPolicy(body: unknown) {
    const value = policySchema.parse(body);
    const policy: Policy = { ...value, id: randomUUID(), approved: false };
    policy.approved = this.policyApproved(policy);
    const { id: _id, approved: _approved, ...content } = policy;
    return this.record('policy', { ...policy, approval_hash: hash(canonical(content)) },'active',policy.id);
  }
  async importDnc(body: unknown) {
    const value = dncSchema.parse(body); const workspace = await this.workspace();
    if (value.seller_id && value.seller_id !== workspace.seller_id) throw new HttpError(403,'SELLER_MISMATCH');
    if (Date.parse(value.downloaded_at) > Date.now()) throw new HttpError(422,'DNC_IN_FUTURE');
    if (value.blocked_phones.some(p => !value.area_codes.includes(p.slice(2,5)))) throw new HttpError(422,'DNC_NUMBER_OUTSIDE_COVERAGE');
    const authorized = value.authorized && (this.settings.mode === 'sandbox' || this.settings.dncApprovals.includes(value.authorization_reference ?? ''));
    return this.record('dnc', { ...value, authorized, seller_id: workspace.seller_id },'active');
  }
  async saveIntegration(body: unknown) {
    const value = integrationSchema.parse(body);
    await this.store.append('integration',randomUUID(), { provider: value.provider, configured: true, encrypted: encrypt(value,this.settings.encryptionKey) },value.provider);
    return { provider: value.provider, configured: true };
  }
  async integration(provider: Provider) {
    const row = await this.store.latest('integration',provider);
    return row ? decrypt<ReturnType<typeof integrationSchema.parse>>(String(row.encrypted),this.settings.encryptionKey) : null;
  }
  async optOut(body: unknown) {
    const value = body as { phone: unknown; reason?: unknown };
    const number = phone.parse(value?.phone);
    const reason = typeof value.reason === 'string' ? value.reason.slice(0,500) : 'Requested by recipient';
    // Persist the independent tombstone BEFORE acknowledgement or primary DB write.
    const existing = await this.store.latest('opt_out',number);
    if (existing && await this.evidence.hasOptOut(this.store.workspaceId,number)) return existing;
    const workspace = await this.store.workspace();
    return this.record('opt_out',{ phone: number, reason, seller_id: workspace?.seller_id },number);
  }
  async context(input: CallInput, dispatching = false): Promise<EvaluationContext> {
    const workspace = await this.workspace();
    const policyRow = await this.store.latest('policy','active');
    const policy = policyRow ? policySchema.parse(Object.fromEntries(Object.entries(policyRow).filter(([k]) => ['id','version','approved','allowed_states','effective_from','effective_until','window_start','window_end','requires_dnc','disclosure'].includes(k)))) as Policy : null;
    if (policy) policy.approved = this.policyApproved(policy);
    const consent = await this.store.get('consent',input.consent_id);
    const dnc = await this.store.latest('dnc','active');
    return {
      workspace_id: this.store.workspaceId, seller_id: String(workspace.seller_id), mode: this.settings.mode,
      paused: Boolean(workspace.paused) || this.settings.globalPaused || (this.settings.mode === 'live' && (!this.settings.liveEnabled || !this.settings.legalReference)),
      policy, consent: consent as unknown as Consent | null,
      opted_out: Boolean(await this.store.latest('opt_out',input.phone)) || await this.evidence.hasOptOut(this.store.workspaceId,input.phone),
      dnc: dnc as unknown as DncSnapshot | null, subscription_active: Boolean(workspace.subscription_active),
      quota_remaining: Number(workspace.quota_remaining) + (dispatching ? 1 : 0)
    };
  }
  async check(body: unknown, idempotencyKey: string, now = new Date()) {
    const input = callSchema.parse(body);
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) throw new HttpError(400,'IDEMPOTENCY_KEY_REQUIRED');
    const id = `check_${hash(idempotencyKey)}`; const fingerprint = hash(canonical(input));
    return this.store.withLease('evaluate',async () => {
      const old = await this.store.get('check',id);
      if (old) { if (old.fingerprint !== fingerprint) throw new HttpError(409,'IDEMPOTENCY_CONFLICT'); return old; }
      const context = await this.context(input);
      const result = evaluate(input,context,now);
      return this.record('check',{ ...result, input, fingerprint, mode: this.settings.mode,
        evaluated_at: now.toISOString(), context, decision_id: id },'',id);
    });
  }
  async enqueueCall(body: unknown, key: string, now = new Date()) {
    // Idempotent checks reserve quota once. The worker always re-evaluates current rules.
    const initial = await this.check(body,`call_${key}`,now);
    if (initial.decision === 'BLOCK') return initial;
    const id = `call_${hash(key)}`;
    const job = await this.store.enqueue(id,{ input: initial.input, decision_id: initial.id, fingerprint: initial.fingerprint, mode: this.settings.mode });
    return { ...initial, call_id: id, status: job.status };
  }
  async processNext(now = new Date()) {
    const job = await this.store.claim(); if (!job) return null;
    const input = callSchema.parse(job.data.input);
    try {
      return await this.store.withLease(`dispatch_${hash(input.phone)}`,async () => {
        const context = await this.context(input,true);
        const result = evaluate(input,context,now);
        const decision = await this.record('dispatch',{ ...result, input, context, call_id: job.id, mode: this.settings.mode });
        if (result.decision === 'BLOCK') { await this.store.updateJob(job.id,'blocked',{ ...job.data, decision_id: decision.id, reason: result.reason }); return { ...job, status: 'blocked' }; }
        // Evidence is durable. Re-check the independent revocation tombstone at the send boundary.
        if (await this.evidence.hasOptOut(this.store.workspaceId,input.phone)) {
          await this.store.updateJob(job.id,'blocked',{ ...job.data, reason: 'OPTED_OUT' }); return { ...job, status: 'blocked' };
        }
        let resultOfSend;
        if (this.settings.mode === 'sandbox') resultOfSend = sandboxDispatch(input.provider,job.id);
        else {
          const credentials = await this.integration(input.provider);
          if (!credentials) { await this.store.updateJob(job.id,'blocked',{ ...job.data, reason: 'INTEGRATION_NOT_CONFIGURED' }); return { ...job, status: 'blocked' }; }
          const configuration: ProviderConfig = { apiKey: credentials.api_key, assistantId: credentials.assistant_id,
            phoneNumberId: credentials.phone_number_id, fromNumber: credentials.from_number };
          resultOfSend = await dispatch(input.provider,configuration,input,job.id);
        }
        await this.store.updateJob(job.id,resultOfSend.status,{ ...job.data, decision_id: decision.id, result: resultOfSend });
        return { ...job, status: resultOfSend.status, result: resultOfSend };
      });
    } catch {
      // Never reset to queued: a crash could have occurred after the provider accepted a call.
      await this.store.updateJob(job.id,'unknown',{ ...job.data, reason: 'RECONCILIATION_REQUIRED' });
      return { ...job, status: 'unknown' };
    }
  }
  async exportAudit() {
    const records = (await this.store.all()).filter(r => r.kind !== 'integration');
    const manifest = records.map(r => ({ id: r.id, kind: r.kind, sha256: hash(canonical(r)) }));
    return { workspace_id: this.store.workspaceId, mode: this.settings.mode, exported_at: new Date().toISOString(), records, calls: await this.store.jobs(), manifest, manifest_sha256: hash(canonical(manifest)) };
  }
}
