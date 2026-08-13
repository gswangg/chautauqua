// Request context wiring, per DEC-012: db factory + per-request ports.
// This file is the boundary between the pure cores (src/{auth,domain,forms,
// mail,lib}) and the Cloudflare runtime (D1/R2) — it's the only place that
// constructs concrete port implementations from Worker bindings.

import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { isDevMode, type Bindings } from "./env";
import { DevSinkMailer } from "../mail/dev-sink";
import { ResendMailer } from "../mail/resend";
import type { EmailLogEntry, EmailLogWriter, Mailer } from "../mail/types";
import { newId } from "../domain/ids";
import { ICS_ORGANIZER_EMAIL } from "../mail/ics";
import { DEC_995 } from "../decisions";
void DEC_995;

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
        batchId: row.batchId ?? null,
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

/** Stage-2 mailer selection (DEC-996): Resend over HTTP when RESEND_API_KEY is
 * configured AND isDevMode(env) is false (DEC-434: DEV_MODE="1" keeps local
 * dev, tests, and the render-sweep/walkthrough gates on the dev sink +
 * /dev/mailbox; every other DEV_MODE value, including "0", is non-dev); the
 * dev sink otherwise. Callers pass the request's env; the cron path passes
 * its Bindings directly.
 *
 * DEC-547: env is REQUIRED — makeMailer must never silently fall back to the
 * dev sink because a caller forgot to pass env. isDevMode(env) is the ONE
 * positive predicate that selects the dev sink; every other configuration
 * (missing RESEND_API_KEY, missing MAIL_FROM_EMAIL) throws rather than
 * degrading. */
export function makeMailer(db: Db, env: Pick<Bindings, "RESEND_API_KEY" | "DEV_MODE" | "MAIL_FROM_EMAIL" | "MAIL_FROM_NAME">): Mailer {
  const log = d1EmailLogWriter(db);
  if (isDevMode(env)) return new DevSinkMailer(log);
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured and DEV_MODE is not \"1\": set DEV_MODE=\"1\" for local/dev, or set the RESEND_API_KEY secret for production");
  if (!env.MAIL_FROM_EMAIL) throw new Error("RESEND_API_KEY is configured but MAIL_FROM_EMAIL is not set");
  return new ResendMailer(fetch, env.RESEND_API_KEY, log, {
    email: env.MAIL_FROM_EMAIL,
    name: env.MAIL_FROM_NAME ?? "Chautauqua",
  });
}

/** DEC-947: the ICS ORGANIZER email is governed by the same policy as
 * makeMailer (DEC-547) — env.MAIL_FROM_EMAIL when set, the dev-local
 * placeholder in ics.ts only when isDevMode(env), and otherwise a loud
 * throw rather than silently shipping a non-routable ".local" organizer
 * that bounces RSVPs. */
export function resolveIcsOrganizerEmail(env: Pick<Bindings, "DEV_MODE" | "MAIL_FROM_EMAIL">): string {
  if (env.MAIL_FROM_EMAIL) return env.MAIL_FROM_EMAIL;
  if (isDevMode(env)) return ICS_ORGANIZER_EMAIL;
  throw new Error('MAIL_FROM_EMAIL is not set and DEV_MODE is not "1": set DEV_MODE="1" for local/dev, or configure MAIL_FROM_EMAIL for production');
}

/** Minimal R2 port; stage 1 serves files through the Worker (DEC-005), no
 * presigned URLs. Stage 2 can add signing without touching callers.
 *
 * DEC-995: `get` does NOT return a content type. R2 object metadata is
 * writer-supplied and mutable; the only trustworthy content type for a
 * served file is the DB column validateUpload's extension allowlist wrote
 * at upload time. Callers MUST read the content type from their own scope's
 * DB row, never from the object store. */
export interface FileStore {
  put(key: string, data: ReadableStream | ArrayBuffer, contentType?: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
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
      return { body: obj.body, size: obj.size };
    },
    async delete(key) {
      await files.delete(key);
    },
  };
}

export type Clock = () => number;

export const systemClock: Clock = () => Date.now();
