import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';

export type Data = Record<string, unknown>;
export interface Row extends Data { id: string; created_at: string }
export interface Job { id: string; workspace_id: string; status: string; data: Data; updated_at: string }

export class Database {
  private sqlite?: DatabaseSync;
  private pool?: Pool;
  constructor(options: { filename?: string; url?: string }) {
    if (options.url) this.pool = new Pool({ connectionString: options.url, max: 8 });
    else {
      const filename = options.filename ?? ':memory:';
      if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
      const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
      this.sqlite = new Sqlite(filename);
      this.sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    }
  }
  async initialize() {
    // Live PostgreSQL uses the reviewed migration, never runtime DDL.
    if (this.pool) { await this.pool.query('SELECT 1 FROM gateway_workspaces LIMIT 1'); return; }
    this.sqlite!.exec(`
      CREATE TABLE IF NOT EXISTS gateway_workspaces (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS gateway_api_keys (token_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS gateway_memberships (user_id TEXT NOT NULL, workspace_id TEXT NOT NULL, PRIMARY KEY(user_id,workspace_id));
      CREATE TABLE IF NOT EXISTS gateway_records (seq INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, lookup_key TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(workspace_id,id));
      CREATE INDEX IF NOT EXISTS records_lookup ON gateway_records(workspace_id,kind,lookup_key,seq);
      CREATE TABLE IF NOT EXISTS gateway_jobs (id TEXT NOT NULL, workspace_id TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(workspace_id,id));
      CREATE TABLE IF NOT EXISTS gateway_leases (workspace_id TEXT NOT NULL, name TEXT NOT NULL, owner TEXT NOT NULL, expires_at TEXT NOT NULL, PRIMARY KEY(workspace_id,name));
    `);
  }
  async query<T extends Data = Data>(sql: string, args: unknown[] = [], workspace?: string): Promise<T[]> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.workspace_id',$1,true)", [workspace ?? '']);
        const result = await client.query(sql, args);
        await client.query('COMMIT'); return result.rows as T[];
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    const values: unknown[] = [];
    const statement = sql.replace(/\$(\d+)/g, (_, n: string) => { values.push(args[Number(n) - 1]); return '?'; });
    const prepared = this.sqlite!.prepare(statement);
    return prepared.all(...values as (string | number | null)[]) as T[];
  }
  async workspaces(): Promise<string[]> {
    // Registry contains routing IDs, not workspace/customer data; workers set RLS per ID.
    return (await this.query('SELECT DISTINCT workspace_id FROM gateway_api_keys')).map(r => String(r.workspace_id));
  }
  async close() { this.sqlite?.close(); await this.pool?.end(); }
}

export class Store {
  public db: Database;
  public workspaceId: string;
  constructor(db: Database, workspaceId: string) { this.db = db; this.workspaceId = workspaceId; }
  private query(sql: string, args: unknown[]) { return this.db.query(sql, args, this.workspaceId); }
  async workspace(): Promise<Data | null> {
    const [r] = await this.query('SELECT data FROM gateway_workspaces WHERE id=$1', [this.workspaceId]);
    return r ? JSON.parse(String(r.data)) : null;
  }
  async putWorkspace(data: Data) {
    await this.query('INSERT INTO gateway_workspaces(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [this.workspaceId, JSON.stringify(data)]);
  }
  async append(kind: string, id: string, data: Data, lookupKey = ''): Promise<Row> {
    const row: Row = { ...data, id, created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString() };
    await this.query('INSERT INTO gateway_records(workspace_id,id,kind,lookup_key,data,created_at) VALUES($1,$2,$3,$4,$5,$6)', [this.workspaceId,id,kind,lookupKey,JSON.stringify(row),row.created_at]);
    return row;
  }
  async get(kind: string, id: string): Promise<Row | null> {
    const [r] = await this.query('SELECT data FROM gateway_records WHERE workspace_id=$1 AND kind=$2 AND id=$3', [this.workspaceId,kind,id]);
    return r ? JSON.parse(String(r.data)) : null;
  }
  async latest(kind: string, lookupKey: string): Promise<Row | null> {
    const [r] = await this.query('SELECT data FROM gateway_records WHERE workspace_id=$1 AND kind=$2 AND lookup_key=$3 ORDER BY seq DESC LIMIT 1', [this.workspaceId,kind,lookupKey]);
    return r ? JSON.parse(String(r.data)) : null;
  }
  async list(kind: string, limit = 200): Promise<Row[]> {
    return (await this.query('SELECT data FROM gateway_records WHERE workspace_id=$1 AND kind=$2 ORDER BY seq DESC LIMIT $3', [this.workspaceId,kind,limit])).map(r => JSON.parse(String(r.data)));
  }
  async all(): Promise<Data[]> {
    return (await this.query('SELECT kind,data FROM gateway_records WHERE workspace_id=$1 ORDER BY seq', [this.workspaceId])).map(r => ({ kind: r.kind, ...JSON.parse(String(r.data)) }));
  }
  async usage(period: string): Promise<number> {
    const [row] = await this.query("SELECT COUNT(*) AS total FROM gateway_records WHERE workspace_id=$1 AND kind='check' AND created_at >= $2", [this.workspaceId, `${period}-01T00:00:00.000Z`]);
    return Number(row.total);
  }
  async enqueue(id: string, data: Data): Promise<Job> {
    await this.query("INSERT INTO gateway_jobs(id,workspace_id,status,data,updated_at) VALUES($1,$2,'queued',$3,$4) ON CONFLICT(workspace_id,id) DO NOTHING", [id,this.workspaceId,JSON.stringify(data),new Date().toISOString()]);
    return (await this.getJob(id))!;
  }
  async jobs(): Promise<Job[]> {
    return (await this.query('SELECT * FROM gateway_jobs WHERE workspace_id=$1 ORDER BY updated_at DESC LIMIT 200', [this.workspaceId])).map(parseJob);
  }
  async getJob(id: string): Promise<Job | null> {
    const [r] = await this.query('SELECT * FROM gateway_jobs WHERE workspace_id=$1 AND id=$2', [this.workspaceId,id]);
    return r ? parseJob(r) : null;
  }
  async claim(): Promise<Job | null> {
    const [r] = await this.query("UPDATE gateway_jobs SET status='dispatching',updated_at=$2 WHERE workspace_id=$1 AND id=(SELECT id FROM gateway_jobs WHERE workspace_id=$1 AND status='queued' ORDER BY updated_at LIMIT 1) AND status='queued' RETURNING *", [this.workspaceId,new Date().toISOString()]);
    return r ? parseJob(r) : null;
  }
  async updateJob(id: string, status: string, data: Data) {
    await this.query('UPDATE gateway_jobs SET status=$3,data=$4,updated_at=$5 WHERE workspace_id=$1 AND id=$2', [this.workspaceId,id,status,JSON.stringify(data),new Date().toISOString()]);
  }
  async withLease<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const owner = randomUUID(); const until = new Date(Date.now() + 60_000).toISOString();
    const [r] = await this.query('INSERT INTO gateway_leases(workspace_id,name,owner,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE gateway_leases.expires_at < $5 RETURNING owner', [this.workspaceId,name,owner,until,new Date().toISOString()]);
    if (!r || r.owner !== owner) throw new Error('RESOURCE_BUSY');
    try { return await fn(); }
    finally { await this.query('DELETE FROM gateway_leases WHERE workspace_id=$1 AND name=$2 AND owner=$3', [this.workspaceId,name,owner]); }
  }
}
function parseJob(row: Data): Job { return { id: String(row.id), workspace_id: String(row.workspace_id), status: String(row.status), data: JSON.parse(String(row.data)), updated_at: String(row.updated_at) }; }
