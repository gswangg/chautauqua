// Files repo — version-chain lookups + writes + per-submission reads (J8,
// DEC-020 contract). Barrel re-export over the four cohesive submodules this
// file was decomposed into (contention decomposition, wave 52) — no behavior
// change, files.ts re-exports everything below for existing callers.
//
//   files-versions-chain.ts   version-chain lookups (walk/resolve/list)
//   files-versions-write.ts   insertFile (DEC-818 version_no assignment)
//   files-versions-read.ts    per-submission reads + uploader-name batch
//   files-versions-delete.ts  DEC-713 delete authz scope + chain-relink write

export * from "./files-versions-chain";
export * from "./files-versions-write";
export * from "./files-versions-read";
export * from "./files-versions-delete";
