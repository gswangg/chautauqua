// Session minting (DEC-994): SPEC §6 "session rotation on login" — every
// path that mints a session for a user must first revoke every existing
// auth_session row for that user, then insert exactly one fresh row. This
// is the ONLY place that may `insert(schema.authSession)`; a source-grep
// test (test/session-rotation.test.ts) enumerates and enforces that.

import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { newId } from "../domain/ids";
import { newSessionToken, hashToken } from "../auth/tokens";
import type { Db } from "./context";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function issueSession(db: Db, userId: string, now: Date): Promise<string> {
  await db.delete(schema.authSession).where(eq(schema.authSession.userId, userId));

  const token = newSessionToken();
  const tokenHash = await hashToken(token);
  await db.insert(schema.authSession).values({
    id: newId(),
    userId,
    tokenHash,
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
    createdAt: now,
    updatedAt: now,
  });

  return token;
}
