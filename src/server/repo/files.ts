// Files repo (J8, DEC-020 contract). Repo functions are the only code that
// touches drizzle row types (DEC-012); handlers in src/routes/files.ts stay
// thin: parse/authz -> repo function -> pure core (src/domain/files.ts) ->
// response.
//
// Decomposed (contention custodian pass) into cohesive submodules — this
// file is now a re-export barrel so every existing import path
// (`from "./repo/files"` / `from "../repo/files"`) keeps working unchanged:
//   files-authz.ts           ownership / authz lookups + pure authz checks
//   files-versions.ts        version-chain lookups, writes, per-submission reads
//   files-comments.ts        file comment threads
//   files-content-status.ts  organizer content-approval status (DEC-009: no mailer)
//   files-library.ts         central files library (DEC-159/160), event-scoped chains
import { isValidFileKind } from "../../domain/files";

export * from "./files-authz";
export * from "./files-versions";
export * from "./files-comments";
export * from "./files-content-status";
export * from "./files-library";

export { isValidFileKind };
