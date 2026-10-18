// The multi-portal tables' CREATE TABLE statements, read from the migration
// itself (migrations/0046_multi_portal.sql), for tests that hand-build a
// schema subset and still need the tables a contact delete or merge now
// touches. Reading the migration keeps these from drifting.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = readFileSync(join(__dirname, "..", "..", "migrations", "0046_multi_portal.sql"), "utf8");

export const PORTAL_TABLES_DDL: string = [...MIGRATION.matchAll(/CREATE TABLE `[a-z_]+` \([\s\S]*?\n\);/g)].map((m) => m[0]).join("\n");
