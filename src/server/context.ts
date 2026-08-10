// Request context wiring, per DEC-012: db factory + per-request ports.
// This file is the boundary between the pure cores (src/{auth,domain,forms,
// mail,lib}) and the Cloudflare runtime (D1/R2) — it's the only place that
// constructs concrete port implementations from Worker bindings.

import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Bindings } from "./env";
import { DevSinkMailer } from "../mail/dev-sink";
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

export function makeMailer(db: Db): Mailer {
  return new DevSinkMailer(d1EmailLogWriter(db));
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
