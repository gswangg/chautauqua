// Minimal ambient module declarations for the node: built-ins used by
// source-scan guard tests (this repo has no @types/node dependency; the
// runtime — vitest under Node — resolves these fine, only `tsc` needs a
// type shape). Keep this narrow: just the two functions actually used.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf-8"): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
