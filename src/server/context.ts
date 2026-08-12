// Request context wiring, per DEC-012: db factory + per-request ports.
// This file is the boundary between the pure cores (src/{auth,domain,forms,
// mail,lib}) and the Cloudflare runtime (D1/R2) — it's the only place that
// constructs concrete port implementations from Worker bindings.

import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { isDevMode, type Bindings } from "./env";
import { DevSinkMailer } from "../mail/dev-sink";
import { EmailBindingMailer } from "../mail/email-binding";
import type { EmailLogEntry, EmailLogWriter, Mailer } from "../mail/types";
import { newId } from "../domain/ids";

export function makeDb(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof makeDb>;

/** DEC-006: writes one email_log row per send, full rendered content inline. */
export function d1EmailLogWriter(db: Db): EmailLogWriter {
  return {
    async write(row: EmailLogEntry): Promise<void> {
      await db.insert(schema.emailLog).values({
        id: newId(),
        eventId: row.eventId,
        templateId: row.templateId ?? null,
        contactId: row.contactId ?? null,
        toEmail: row.toEmail,
        subject: row.subject,
        bodyText: row.bodyText,
        bodyHtml: row.bodyHtml ?? null,
        icsText: row.icsText ?? null,
        icsFilename: row.icsFilename ?? null,
        provider: row.provider,
        status: row.status,
        sentAt: new Date(row.sentAt),
        createdAt: new Date(),
      });
    },
  };
}

/** Stage-2 mailer selection: the Cloudflare Email Service binding when it is
 * configured AND isDevMode(env) is false (DEC-434: DEV_MODE="1" keeps local
 * dev, tests, and the render-sweep/walkthrough gates on the dev sink +
 * /dev/mailbox; every other DEV_MODE value, including "0", is non-dev); the
 * dev sink otherwise. Callers pass the request's env; the cron path passes
 * its Bindings directly.
 *
 * DEC-547: env is REQUIRED — makeMailer must never silently fall back to the
 * dev sink because a caller forgot to pass env. isDevMode(env) is the ONE
 * positive predicate that selects the dev sink; every other configuration
 * (missing EMAIL, missing MAIL_FROM_EMAIL) throws rather than degrading. */
export function makeMailer(db: Db, env: Pick<Bindings, "EMAIL" | "DEV_MODE" | "MAIL_FROM_EMAIL" | "MAIL_FROM_NAME">): Mailer {
  const log = d1EmailLogWriter(db);
  if (isDevMode(env)) return new DevSinkMailer(log);
  if (!env.EMAIL) throw new Error("EMAIL binding is not configured and DEV_MODE is not \"1\": set DEV_MODE=\"1\" for local/dev, or bind EMAIL for production");
  if (!env.MAIL_FROM_EMAIL) throw new Error("EMAIL binding configured but MAIL_FROM_EMAIL is not set");
  return new EmailBindingMailer(env.EMAIL, log, {
    email: env.MAIL_FROM_EMAIL,
    name: env.MAIL_FROM_NAME ?? "Chautauqua",
  });
}

/** Minimal R2 port; stage 1 serves files through the Worker (DEC-005), no
 * presigned URLs. Stage 2 can add signing without touching callers. */
export interface FileStore {
  put(key: string, data: ReadableStream | ArrayBuffer, contentType?: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; contentType: string | null; size: number } | null>;
  delete(key: string): Promise<void>;
}

export function makeFileStore(files: R2Bucket): FileStore {
  return {
    async put(key, data, contentType) {
      await files.put(key, data, contentType ? { httpMetadata: { contentType } } : undefined);
    },
    async get(key) {
      const obj = await files.get(key);
      if (!obj) return null;
      return { body: obj.body, contentType: obj.httpMetadata?.contentType ?? null, size: obj.size };
    },
    async delete(key) {
      await files.delete(key);
    },
  };
}

export type Clock = () => number;

export const systemClock: Clock = () => Date.now();
