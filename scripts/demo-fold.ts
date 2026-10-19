// Writes .demo-fold.sql: multi-portal decision 78's fold of the DevFlow
// demo's duplicate items (scripts/demo-fold-lib.ts), for a database that
// already has data -- production included. Idempotent: a second run
// matches nothing. Run the multi-portal demo SQL first so the Hotel and
// Flight forms are already in their portals.
//
//   npm run seed:portal-demo:remote
//   npm run seed:demo-fold:remote
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoFoldStatements } from "./demo-fold-lib";

const OUTPUT_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", ".demo-fold.sql");
const statements = demoFoldStatements(Date.now());
writeFileSync(OUTPUT_PATH, statements.join("\n") + "\n");
// eslint-disable-next-line no-console
console.log(`Wrote ${statements.length} statements to ${OUTPUT_PATH}`);
