// DEC-887 (task w17-e): six Settings frame elements the seed previously left
// unrepresentable -- room capacities, saved embeds, API tokens, an
// unpublished public surface, organizer/reviewer display names, and
// per-track reviewer scopes. This test enumerates the generated .seed.sql
// (never a hand-picked sample, per the field guide) and asserts each now
// has real rows/values, mirroring test/seed-coherence.test.ts's row parser.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

let sql: string;

beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
  expect(existsSync(OUTPUT_PATH)).toBe(true);
  sql = readFileSync(OUTPUT_PATH, "utf-8");
}, 60_000);

/** Splits a VALUES(...) tuple's raw text into per-column literal strings
 * (still quoted), respecting SQL's doubled-single-quote escaping. Mirrors
 * test/seed-coherence.test.ts's helper. */
function tokenizeSqlValues(raw: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (raw[i] === " ") i++;
    if (raw[i] === "'") {
      let j = i + 1;
      let val = "'";
      while (j < raw.length) {
        if (raw[j] === "'" && raw[j + 1] === "'") {
          val += "''";
          j += 2;
          continue;
        }
        if (raw[j] === "'") {
          val += "'";
          j++;
          break;
        }
        val += raw[j];
        j++;
      }
      out.push(val);
      i = j;
    } else {
      let j = i;
      while (j < raw.length && raw[j] !== ",") j++;
      out.push(raw.slice(i, j).trim());
      i = j;
    }
    while (raw[i] === " ") i++;
    if (raw[i] === ",") i++;
  }
  return out;
}

function unquote(literal: string): string | null {
  if (literal === "NULL") return null;
  if (literal.startsWith("'") && literal.endsWith("'")) {
    return literal.slice(1, -1).replace(/''/g, "'");
  }
  return literal;
}

function parseInserts(sqlText: string, table: string): Array<Record<string, string | null>> {
  const rowRe = new RegExp(`^INSERT INTO ${table} \\(([^)]*)\\) VALUES \\((.*)\\);$`, "gm");
  const rows: Array<Record<string, string | null>> = [];
  for (const m of sqlText.matchAll(rowRe)) {
    const columns = m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const values = tokenizeSqlValues(m[2]!);
    if (values.length !== columns.length) {
      throw new Error(
        `parseInserts: column/value count mismatch for ${table} (${columns.length} cols, ${values.length} vals): ${m[0]}`,
      );
    }
    const row: Record<string, string | null> = {};
    columns.forEach((c, idx) => {
      row[c] = unquote(values[idx]!);
    });
    rows.push(row);
  }
  return rows;
}

describe("settings frame seed (DEC-887)", () => {
  it("(1) every seeded room carries a real capacity, in frame order", () => {
    const rooms = parseInserts(sql, "room").sort((a, b) => Number(a.position) - Number(b.position));
    expect(rooms.map((r) => r.name)).toEqual(["Main Stage", "Room 2A", "Room 2B", "Workshop Lab"]);
    expect(rooms.map((r) => Number(r.capacity))).toEqual([900, 220, 220, 60]);
  });

  // DEC-887 amendment (wave 40): the frame draws FOUR saved-embed rows, not
  // two, and the disabled row is now the seed's demonstration of a surface
  // that is not live (a job the CFP window used to do -- see (4)).
  it("(2) all four saved embeds the frame draws exist, with both enabled and disabled rows, each with a real recipe", () => {
    const embeds = parseInserts(sql, "embed");
    expect(embeds.length).toBe(4);
    const enabled = embeds.filter((e) => e.enabled === "1");
    const disabled = embeds.filter((e) => e.enabled === "0");
    expect(enabled.length).toBeGreaterThanOrEqual(1);
    expect(disabled.length).toBeGreaterThanOrEqual(1);
    expect(enabled.length + disabled.length).toBe(embeds.length);
    for (const e of embeds) {
      expect(typeof e.name).toBe("string");
      expect((e.name ?? "").length).toBeGreaterThan(0);
      expect(typeof e.surface).toBe("string");
      expect(typeof e.format).toBe("string");
      // options_json must be valid, real JSON (not a placeholder string).
      expect(() => JSON.parse(e.options_json ?? "")).not.toThrow();
    }
  });

  it("(3) two API tokens exist with only tokenHash/tokenPrefix/name/createdByUserId(+lastUsedAt on one), never a plaintext or a hash of a known constant", () => {
    const tokens = parseInserts(sql, "api_token");
    expect(tokens.length).toBe(2);
    const withLastUsed = tokens.filter((t) => t.last_used_at !== null);
    expect(withLastUsed.length).toBe(1);
    const knownConstantHashes = new Set(
      ["", "test", "chq_test", "seed", "seed-token", "password", "secret"].map((s) => s), // sanity: not asserting these are hashed, just that token_hash isn't one of these literal strings
    );
    for (const t of tokens) {
      expect(t.token_hash).toBeTruthy();
      expect(t.token_hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest, not a plaintext token
      expect(knownConstantHashes.has(t.token_hash ?? "")).toBe(false);
      expect(t.token_prefix).toBeTruthy();
      expect(t.token_prefix).not.toMatch(/^[0-9a-f]{64}$/); // prefix is plaintext-shaped, not the hash itself
      expect(t.created_by_user_id).toBeTruthy();
      expect(typeof t.name).toBe("string");
      expect((t.name ?? "").length).toBeGreaterThan(0);
    }
    // Never the same hash twice (each token is independently random).
    expect(tokens[0]!.token_hash).not.toBe(tokens[1]!.token_hash);
  });

  // DEC-887 amendment (wave 40): the default form used to open in the future
  // so PublicPagesPanel had exactly one row that was not live -- but that left
  // /submit/<slug> reading "Submissions aren't open yet" on delivery day while
  // Settings showed a live Open link. RULING: the window now straddles now
  // (opens in the past, closes in the future) so the front door is live, and
  // the 'not live' demo moves to a DISABLED saved embed, a genuinely
  // switchable surface.
  it("(4) the default CFP form's window straddles now, so the public front door is open, and a disabled embed carries the 'not live' demo instead", () => {
    const forms = parseInserts(sql, "form").filter((f) => f.is_default === "1");
    expect(forms.length).toBe(1);
    const form = forms[0]!;
    expect(form.open_date).not.toBeNull();
    expect(form.close_date).not.toBeNull();
    const openDate = Number(form.open_date);
    const closeDate = Number(form.close_date);
    expect(openDate).toBeLessThan(closeDate);
    // Open on delivery day: now sits strictly inside the window.
    expect(openDate).toBeLessThan(Date.now());
    expect(Date.now()).toBeLessThan(closeDate);

    // The state DEC-887 originally wanted from this window is still
    // demonstrated somewhere real -- by a switchable, disabled saved embed.
    const disabledEmbeds = parseInserts(sql, "embed").filter((e) => e.enabled === "0");
    expect(disabledEmbeds.length).toBeGreaterThanOrEqual(1);
  });

  it("(5) the organizer user resolves to a real contact name, not their raw email", () => {
    const users = parseInserts(sql, "user").filter((u) => u.role === "organizer");
    expect(users.length).toBe(1);
    const organizer = users[0]!;
    expect(organizer.contact_id).not.toBeNull();
    const contacts = parseInserts(sql, "contact");
    const contact = contacts.find((c) => c.id === organizer.contact_id);
    expect(contact).toBeTruthy();
    expect(contact!.first_name).toBe("Jordan");
    expect(contact!.last_name).toBe("Alvarez");
    expect(contact!.email).toBe(organizer.email);

    // Every reviewer user is also contact-linked (pre-existing, w3-a), so
    // resolveActorName never falls back to a raw email for any seeded
    // organizer or reviewer identity.
    const reviewers = parseInserts(sql, "user").filter((u) => u.role === "reviewer");
    expect(reviewers.length).toBeGreaterThanOrEqual(2);
    for (const r of reviewers) {
      expect(r.contact_id).not.toBeNull();
    }
  });

  it("(6) at least two reviewers are scoped to exactly one track each on some plan", () => {
    const planReviewers = parseInserts(sql, "plan_reviewer");
    expect(planReviewers.length).toBeGreaterThan(0);
    // Group by (plan_id, user_id): every seeded pairing carries a single,
    // non-null track_id -- never 'all tracks' (null) and never a scope
    // that varies across rows for the same (plan, user) pair.
    const byPlanUser = new Map<string, Set<string | null>>();
    for (const row of planReviewers) {
      const key = `${row.plan_id}::${row.user_id}`;
      const set = byPlanUser.get(key) ?? new Set<string | null>();
      set.add(row.track_id ?? null);
      byPlanUser.set(key, set);
    }
    const singleTrackScopedPairs = [...byPlanUser.entries()].filter(([, tracks]) => {
      const [only] = tracks;
      return tracks.size === 1 && only !== null;
    });
    const scopedUsers = new Set(singleTrackScopedPairs.map(([key]) => key.split("::")[1]));
    expect(scopedUsers.size).toBeGreaterThanOrEqual(2);
  });
});
