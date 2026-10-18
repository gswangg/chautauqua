// Writes .portal-demo.sql: the multi-portal demo for DevFlow Conf 2027
// (scripts/portal-demo-lib.ts) as additive, idempotent SQL for a database
// that already has data -- production included. It never deletes or
// updates a row: every statement is INSERT OR IGNORE (or INSERT ... WHERE
// NOT EXISTS) with fixed ids, so running it twice changes nothing.
//
//   npx tsx scripts/portal-demo-seed.ts
//   npx wrangler d1 execute chautauqua --remote --file=.portal-demo.sql
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_INVITATION_TOKEN, portalDemoStatements, profileBasicsForEveryEvent } from "./portal-demo-lib";

const OUTPUT_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", ".portal-demo.sql");
const now = Date.now();
const statements = [profileBasicsForEveryEvent(now), ...portalDemoStatements(now)];
writeFileSync(OUTPUT_PATH, statements.join("\n") + "\n");
// eslint-disable-next-line no-console
console.log(`Wrote ${statements.length} statements to ${OUTPUT_PATH}`);
// eslint-disable-next-line no-console
console.log(`Invited-speaker demo link: /portal/invitations/${DEMO_INVITATION_TOKEN}`);
