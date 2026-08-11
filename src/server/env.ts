// Worker bindings + request-scoped context shape, per DEC-012.
// This is the ONLY place Bindings/AppEnv are defined; src/index.ts and every
// route sub-app type their Hono instance as Hono<AppEnv>.

import type { Db } from "./context";

export type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  DEV_MODE?: string;
  // Stage 2: Cloudflare Email Service binding + sender identity. Optional so
  // test env fixtures and pre-deploy local dev stay green; makeMailer only
  // selects the real mailer when EMAIL is bound and DEV_MODE is unset.
  EMAIL?: import("../mail/email-binding").EmailSender;
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  // DEC-049: /admin is served through the Worker (run_worker_first) so role
  // redirects can happen server-side; ASSETS proxies to the static bundle.
  // Optional so existing test env fixtures that predate this task stay green.
  ASSETS?: Fetcher;
};

export type AuthInfo = {
  userId: string;
  role: "organizer" | "reviewer" | "speaker";
  orgId: string;
  contactId?: string;
  // DEC-027: set when this request authenticated via an `Authorization:
  // Bearer chq_...` API token rather than the chq_session cookie. Bearer
  // requests are CSRF-exempt (cross-site forgery requires ambient cookie
  // credentials) and can never mint new tokens themselves.
  viaBearer?: boolean;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: Db;
    auth?: AuthInfo;
  };
};
