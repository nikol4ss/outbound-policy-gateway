import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database, Store } from '../src/server/store.ts';
import { LocalEvidence } from '../src/server/evidence.ts';

test('persistent records are scoped, append-only, and survive reopening', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gateway-'));
  let db = new Database({ filename: join(dir, 'test.sqlite') });
  try {
    await db.initialize();
    const a = new Store(db, 'a'); const b = new Store(db, 'b');
    await a.append('consent', 'c1', { phone: '+14155550123' });
    assert.equal(await b.get('consent', 'c1'), null);
    await assert.rejects(a.append('consent', 'c1', { phone: 'changed' }));
    await db.close(); db = new Database({ filename: join(dir, 'test.sqlite') });
    await db.initialize();
    assert.equal((await new Store(db, 'a').get('consent', 'c1'))?.phone, '+14155550123');
  } finally { await db.close(); await rm(dir, { recursive: true, force: true }); }
});

test('two workers cannot claim the same call and claimed calls never auto-retry', async () => {
  const db = new Database({ filename: ':memory:' }); await db.initialize();
  try {
    const store = new Store(db, 'a');
    await store.enqueue('job-1', { phone: '+14155550123' });
    const claims = await Promise.all([store.claim(), store.claim()]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(await store.claim(), null);
    assert.equal((await store.getJob('job-1'))?.status, 'dispatching');
  } finally { await db.close(); }
});

test('evidence cannot be overwritten and opt-out survives loss of primary records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'evidence-'));
  try {
    const evidence = new LocalEvidence(dir);
    const event = { id: 'opt1', workspace_id: 'a', kind: 'opt_out', phone: '+14155550123', created_at: '2026-11-05T12:00:00Z' };
    await evidence.write(event);
    await evidence.write(event);
    await assert.rejects(evidence.write({ ...event, phone: 'changed' }));
    assert.equal(await new LocalEvidence(dir).hasOptOut('a', '+14155550123'), true);
    assert.equal(await evidence.hasOptOut('b', '+14155550123'), false);
    assert.equal((await evidence.events('a')).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
