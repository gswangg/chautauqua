// DEC-317 Amendment (wave 37): the WRITE mirror of
// test/participant-reader-invite-filter.test.ts (which scans reads only).
// Enumerates every `inviteStatus: "<literal>"` written into a participant
// row across src/**/*.ts(x) (never a hand-listed manifest — a file added
// after this test is written must still be caught) and asserts the set of
// files that ever write a member of ACTIVE_INVITE_STATUSES ("none" or
// "accepted") is EXACTLY the reasoned map below.
//
// This is the class of defect that inverted DEC-317's invite gate: a
// speaker-driven UNTRUSTED write path (addCoPresenter) minted 'none' —
// immediately ACTIVE — while the organizer's own TRUSTED add-participant
// path wrote 'invited'. A speaker could name any known contact's email and
// grant that contact read/write access, comms-recipient status, and
// onboarding tasks on their submission without any acceptance step. Fixed
// in src/server/repo/portal-edit.ts (addCoPresenter now writes 'invited').
//
// ACTIVE_MAP is NOT a blanket exemption: every entry is a real, hand-
// verified site. A brand-new file writing an ACTIVE_INVITE_STATUSES literal
// — in particular any speaker/portal-driven path — fails this test until a
// human adds a reasoned entry (reviewed, not rubber-stamped).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ACTIVE_INVITE_STATUSES } from "../src/domain/acceptance";

const SRC_ROOT = join(__dirname, "..", "src");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full === join(SRC_ROOT, "decisions-data")) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Strips // line comments and block comments so a comment mentioning a
 * literal never counts as a live write. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Matches an object-literal property write `inviteStatus: "<word>"`,
 * optionally followed by `as const`, and REQUIRES a trailing comma (or
 * close-brace) — this is what distinguishes a real property assignment from
 * a type-union annotation like
 * `inviteStatus: "none" | "invited" | ... | null = ...` (routes/tasks.ts),
 * which ends in ` | `, never a comma. */
const WRITE_RE = /inviteStatus:\s*"([a-z]+)"(?:\s+as\s+const)?\s*[,}]/g;

/** relative/path.ts (forward-slash, relative to src/) -> reason(s), one per
 * known site that writes a member of ACTIVE_INVITE_STATUSES ("none" or
 * "accepted") into a participant row. Every entry is a TRUSTED-actor path:
 * the submission's own author authenticating via the claim link, or an
 * organizer/admin action. A speaker-supplied path (e.g. addCoPresenter)
 * must NEVER appear here — it writes 'invited' and gains ACTIVE status only
 * through the existing accept/decline flow (src/routes/portal/index.tsx). */
const ACTIVE_MAP: Record<string, string[]> = {
  "server/repo/submit.ts": [
    "createParticipant, order 0 — the CFP submission's own author, the person the claim-link email authenticates. This is the person WHO IS SUBMITTING, trusted by construction.",
  ],
  "server/repo/import/sessionboard.ts": [
    "Organizer-run Sessionboard import — an admin-initiated bulk migration of already-vetted external data, not a speaker/portal-driven write.",
  ],
  "server/repo/submissions/create.ts": [
    "createSubmission — organizer manually creates a session and names its contact directly (admin surface, routes/api/submissions.ts POST); not a speaker/portal-driven write.",
    "cloneSubmission — organizer clones a submission; copies only already-ACTIVE source participants (none|accepted) and resets invite_status to 'none' on the copy (DEC-275), never invents a new active grant from an untrusted input.",
  ],
  "server/repo/participants.ts": [
    "insertActiveParticipants (DEC-810 amendment, wave 59) — organizer-run CSV roster import (routes/api/contacts/import.ts) attaches every imported contact as an ACTIVE participant of the batch's one submission; an admin-initiated bulk import of already-vetted contacts the organizer chose to push onto the event, not a speaker/portal-driven write, and 'none' (not 'invited') is required so DEC-283/DEC-746's onboarding-task expansion picks them up immediately.",
  ],
};

describe("every participant-insert inviteStatus literal write is enumerated (DEC-317 Amendment, wave 37)", () => {
  const files = listSourceFiles(SRC_ROOT);

  it("finds source files to scan (scanner sanity check)", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(join(SRC_ROOT, "server", "repo", "portal-edit.ts"));
  });

  it("addCoPresenter (the speaker-supplied co-presenter path) writes 'invited', never an active status", () => {
    const raw = stripComments(readFileSync(join(SRC_ROOT, "server", "repo", "portal-edit.ts"), "utf8"));
    const fnStart = raw.indexOf("export async function addCoPresenter");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = raw.slice(fnStart);
    WRITE_RE.lastIndex = 0;
    const match = WRITE_RE.exec(fnBody);
    expect(match).toBeTruthy();
    expect(match![1]).toBe("invited");
    expect(ACTIVE_INVITE_STATUSES as readonly string[]).not.toContain(match![1]);
  });

  it("the set of files writing an ACTIVE_INVITE_STATUSES literal is EXACTLY the reasoned ACTIVE_MAP", () => {
    const foundByFile = new Map<string, string[]>();

    for (const file of files) {
      const relPath = relative(SRC_ROOT, file).split("\\").join("/");
      const stripped = stripComments(readFileSync(file, "utf8"));
      WRITE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      const activeWrites: string[] = [];
      while ((match = WRITE_RE.exec(stripped)) !== null) {
        const literal = match[1]!;
        if ((ACTIVE_INVITE_STATUSES as readonly string[]).includes(literal)) {
          activeWrites.push(literal);
        }
      }
      if (activeWrites.length > 0) foundByFile.set(relPath, activeWrites);
    }

    // No third file (and in particular no speaker/portal-driven path)
    // writes an active-status literal outside the reasoned map.
    const unexpected = [...foundByFile.keys()].filter((f) => !(f in ACTIVE_MAP));
    expect(unexpected).toEqual([]);

    // Every reasoned entry is still backed by a real site with the exact
    // count of active-literal writes claimed (no stale allowances).
    const stale: string[] = [];
    for (const [relPath, reasons] of Object.entries(ACTIVE_MAP)) {
      const seen = foundByFile.get(relPath)?.length ?? 0;
      if (seen !== reasons.length) {
        stale.push(`${relPath}: ACTIVE_MAP has ${reasons.length} reason(s) but ${seen} active-literal write(s) found`);
      }
    }
    expect(stale).toEqual([]);

    // Exactness both ways: the reasoned map has no entries for files that
    // no longer write anything active.
    expect(new Set(foundByFile.keys())).toEqual(new Set(Object.keys(ACTIVE_MAP)));
  });
});
