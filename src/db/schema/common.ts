// Shared column helpers used across every schema submodule. Split out of the
// former monolithic src/db/schema.ts (contention-hotspot decomposition;
// behavior-preserving) — see src/db/schema/index.ts for the public barrel.

import { text, integer } from "drizzle-orm/sqlite-core";

export const id = () => text("id").primaryKey();
export const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull();
export const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull();
