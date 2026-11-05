import { resolve } from 'node:path';

export interface Config {
  mode: 'sandbox' | 'live'; dataDir: string; databaseUrl?: string;
  origin: string; encryptionKey: string; liveEnabled: boolean;
  approvedVersions: string[]; approvedPolicyHashes: string[]; dncApprovals: string[]; legalReference: string; retention: Record<string,number>;
  bucket?: string; globalPaused: boolean; supabaseUrl?: string; supabaseKey?: string;
}
export function config(): Config {
  const mode = process.env.GATEWAY_MODE ?? 'sandbox';
  if (mode !== 'sandbox' && mode !== 'live') throw new Error('INVALID_GATEWAY_MODE');
  const key = process.env.GATEWAY_ENCRYPTION_KEY ?? '';
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('RUN_SETUP_OR_CONFIGURE_ENCRYPTION_KEY');
  let retention: Record<string,number> = {};
  try { retention = JSON.parse(process.env.EVIDENCE_RETENTION_JSON ?? '{}'); } catch { throw new Error('INVALID_RETENTION_CONFIG'); }
  if (mode === 'live' && (!process.env.DATABASE_URL || !process.env.S3_EVIDENCE_BUCKET || !process.env.RETENTION_APPROVAL_REFERENCE || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)) throw new Error('LIVE_INFRASTRUCTURE_NOT_READY');
  return {
    mode, dataDir: resolve(process.env.GATEWAY_DATA_DIR ?? '.data'), databaseUrl: process.env.DATABASE_URL,
    origin: process.env.APP_ORIGIN ?? 'http://localhost:3000', encryptionKey: key,
    liveEnabled: process.env.LIVE_CALLS_ENABLED === 'true',
    approvedVersions: (process.env.APPROVED_POLICY_VERSIONS ?? '').split(',').filter(Boolean),
    approvedPolicyHashes: (process.env.APPROVED_POLICY_HASHES ?? '').split(',').filter(Boolean),
    dncApprovals: (process.env.DNC_APPROVAL_REFERENCES ?? '').split(',').filter(Boolean),
    legalReference: process.env.LEGAL_APPROVAL_REFERENCE ?? '', retention,
    bucket: process.env.S3_EVIDENCE_BUCKET, globalPaused: process.env.GLOBAL_PAUSED === 'true',
    supabaseUrl: process.env.SUPABASE_URL, supabaseKey: process.env.SUPABASE_ANON_KEY
  };
}
