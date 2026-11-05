import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function encrypt(value: unknown, key: string) {
  const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', Buffer.from(key,'hex'), nonce);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
  return [nonce.toString('hex'),cipher.getAuthTag().toString('hex'),body.toString('hex')].join('.');
}
export function decrypt<T>(value: string, key: string): T {
  const [nonce,tag,body] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(nonce,'hex'));
  decipher.setAuthTag(Buffer.from(tag,'hex'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'hex')),decipher.final()]).toString());
}
export const phone = z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/);
const short = z.string().trim().min(1).max(200);
const iso = z.iso.datetime({ offset: true });
export const callSchema = z.object({ phone, seller_id: short, campaign: short, consent_id: short,
  provider: z.enum(['vapi','retell']), state: z.string().length(2), timezone: short, location_source: short }).strict();
export const consentSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).optional(),
  seller_id: short, phone, scope: z.literal('marketing'), captured_at: iso, expires_at: iso.optional(),
  disclosure: z.string().min(10).max(10000), source: short, evidence_ref: z.string().min(1).max(2000) }).strict();
export const policySchema = z.object({ id: short.optional(), version: short,
  approved: z.boolean().optional(), allowed_states: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(51),
  effective_from: iso, effective_until: iso, window_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  window_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), requires_dnc: z.boolean(),
  disclosure: z.string().min(10).max(10000) }).strict().refine(p => p.effective_until > p.effective_from && p.window_start < p.window_end, 'Invalid policy interval');
export const dncSchema = z.object({ seller_id: short.optional(), downloaded_at: iso,
  area_codes: z.array(z.string().regex(/^[2-9]\d{2}$/)).min(1).max(1000),
  blocked_phones: z.array(phone).max(100000), authorized: z.boolean(), version: short,
  authorization_reference: short.optional() }).strict();
export const integrationSchema = z.object({ provider: z.enum(['vapi','retell']), api_key: z.string().min(1).max(4096),
  assistant_id: short, phone_number_id: short.optional(), from_number: phone.optional(), webhook_secret: z.string().min(16).max(4096)
}).strict().refine(v => v.provider === 'vapi' ? Boolean(v.phone_number_id) : Boolean(v.from_number), 'A provider phone number is required');
