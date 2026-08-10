// Worker bindings, per DEC-001 (wrangler.jsonc) and DEC-002 (ports live
// outside this file; this is just the runtime binding shape).
export type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  DEV_MODE?: string;
};
