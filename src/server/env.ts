// Worker bindings + request-scoped context shape, per DEC-012.
// This is the ONLY place Bindings/AppEnv are defined; src/index.ts and every
// route sub-app type their Hono instance as Hono<AppEnv>.

import type { Db } from "./context";

export type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  DEV_MODE?: string;
};

export type AuthInfo = {
  userId: string;
  role: "organizer" | "reviewer" | "speaker";
  orgId: string;
  contactId?: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: Db;
    auth?: AuthInfo;
  };
};
