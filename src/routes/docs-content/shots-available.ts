// WRITTEN BY scripts/docs-shots.ts after a successful shoot (DEC-518
// amendment, wave 4). This file must NEVER be hand-extended: the only
// legal edits are (a) the script overwriting it with the sorted list of
// shot ids it actually captured against a real, seeded `npm run dev`, or
// (b) emptying it back to `[]`, which is always legal (it just returns
// every docs figure to its named placeholder — see
// src/routes/docs-site.tsx's figure block renderer). A hand-added id here
// with no PNG on disk would silently 404 an <img> the reader can't get
// back from; that's why this is generated, not maintained.

export const DOCS_SHOTS_AVAILABLE: readonly string[] = [];
