import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { Data } from './store.ts';

export interface EvidenceEvent extends Data { id: string; workspace_id: string; kind: string; created_at: string }
export interface Receipt { key: string; sha256: string }
export interface Evidence {
  write(event: EvidenceEvent): Promise<Receipt>;
  hasOptOut(workspace: string, phone: string): Promise<boolean>;
  events(workspace: string): Promise<EvidenceEvent[]>;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function safe(value: string) { if (!/^[a-zA-Z0-9_-]{1,160}$/.test(value)) throw new Error('INVALID_EVIDENCE_ID'); return value; }
function keyFor(event: EvidenceEvent) { return `${safe(event.workspace_id)}/events/${safe(event.id)}.json`; }
function markerKey(workspace: string, phone: string) { return `${safe(workspace)}/opt-outs/${hash(phone)}.json`; }
function pack(event: EvidenceEvent) { return canonical({ event, sha256: hash(canonical(event)) }); }
function unpack(body: string): EvidenceEvent {
  const envelope = JSON.parse(body) as { event: EvidenceEvent; sha256: string };
  if (hash(canonical(envelope.event)) !== envelope.sha256) throw new Error('EVIDENCE_INTEGRITY_FAILURE');
  return envelope.event;
}

export class LocalEvidence implements Evidence {
  private root: string;
  constructor(root: string) { this.root = root; }
  private async writeOnce(key: string, body: string, marker = false) {
    const path = join(this.root, key); await mkdir(join(path, '..'), { recursive: true });
    let file;
    try { file = await open(path, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(path, 'utf8'); unpack(existing);
      if (!marker && existing !== body) throw new Error('EVIDENCE_IMMUTABLE');
      return;
    }
    try { await file.writeFile(body); await file.sync(); } finally { await file.close(); }
  }
  async write(event: EvidenceEvent): Promise<Receipt> {
    const key = keyFor(event); const body = pack(event);
    await this.writeOnce(key, body);
    if (event.kind === 'opt_out') await this.writeOnce(markerKey(event.workspace_id, String(event.phone)), body, true);
    return { key, sha256: hash(canonical(event)) };
  }
  async hasOptOut(workspace: string, phone: string) {
    try { unpack(await readFile(join(this.root, markerKey(workspace,phone)), 'utf8')); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  async events(workspace: string) {
    const path = join(this.root, safe(workspace), 'events');
    let files: string[];
    try { files = await readdir(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    return Promise.all(files.filter(f => f.endsWith('.json')).map(async f => unpack(await readFile(join(path,f), 'utf8'))));
  }
}

export class S3Evidence implements Evidence {
  private client: S3Client;
  private bucket: string;
  private retention: Record<string,number>;
  constructor(bucket: string, retention: Record<string,number>) {
    this.client = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 2 });
    this.bucket = bucket; this.retention = retention;
  }
  private async put(key: string, body: string, days: number, marker = false) {
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body,
        ContentType: 'application/json', ServerSideEncryption: 'AES256', IfNoneMatch: '*',
        ObjectLockMode: 'COMPLIANCE', ObjectLockRetainUntilDate: new Date(Date.now() + days * 86400000)
      }), { abortSignal: AbortSignal.timeout(10_000) });
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode: number } }).$metadata?.httpStatusCode !== 412) throw error;
      const old = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const text = await old.Body!.transformToString(); unpack(text);
      if (!marker && text !== body) throw new Error('EVIDENCE_IMMUTABLE');
    }
  }
  async write(event: EvidenceEvent) {
    const days = this.retention[event.kind];
    if (!Number.isInteger(days) || days < 1) throw new Error('RETENTION_NOT_APPROVED');
    const key = keyFor(event); const body = pack(event);
    await this.put(key,body,days);
    if (event.kind === 'opt_out') await this.put(markerKey(event.workspace_id,String(event.phone)),body,days,true);
    return { key, sha256: hash(canonical(event)) };
  }
  async hasOptOut(workspace: string, phone: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: markerKey(workspace,phone) }), { abortSignal: AbortSignal.timeout(10_000) }); return true;
    } catch (error) { if ((error as { $metadata?: { httpStatusCode: number } }).$metadata?.httpStatusCode === 404) return false; throw error; }
  }
  async events(workspace: string) {
    const events: EvidenceEvent[] = []; let cursor: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `${safe(workspace)}/events/`, ContinuationToken: cursor }));
      for (const object of page.Contents ?? []) {
        const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: object.Key }));
        events.push(unpack(await result.Body!.transformToString()));
      }
      cursor = page.NextContinuationToken;
    } while (cursor);
    return events;
  }
}
