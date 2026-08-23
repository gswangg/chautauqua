// DEC-441 wave-47: the sent HTML reminder must compose to the frame
// (docs/design/Chautauqua Speakers.dc.html:522-531) exactly ONCE per
// section -- greeting / nudge / "Still to do" block / CTA / paste-URL line /
// sign-off -- never the body's own plain-text copy PLUS the fact block PLUS
// a duplicated sign-off. Fixture idiom copied from
// test/reminders-timezone.test.ts's multi-item describe (that file's own
// tests are untouched).
import { describe, expect, it } from "vitest";
import { remindNow } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const ORIGIN = "https://events.example.com";
const NOW = new Date(1_700_000_000_000);

interface OutstandingRowShape {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  dueDate: Date | null;
  status: string;
  lastRemindedAt: Date | null;
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  eventId: string;
  eventName: string;
  timezone: string;
  assignmentCreatedAt: Date;
}

function fakeDb(rows: OutstandingRowShape[]): { db: Db; updateCalls: unknown[] } {
  const updateCalls: unknown[] = [];
  let asCallCount = 0;

  function computeEligibleAndSkipped(): { eligible: string[]; skipped: number } {
    const byContact = new Map<string, OutstandingRowShape[]>();
    for (const r of rows) {
      if (r.status !== "pending") continue;
      const arr = byContact.get(r.contactId) ?? [];
      arr.push(r);
      byContact.set(r.contactId, arr);
    }
    const skipped = 0;
    // No fixture row carries a lastRemindedAt, so every distinct contact is
    // eligible -- the dedupe-window branch (reminders-timezone.test.ts's
    // fuller fake) is not exercised by this file's fixtures.
    const eligible: string[] = [...byContact.keys()].sort();
    return { eligible, skipped };
  }

  type SubqueryMarker = { __subqueryKind: "eligible" | "skipped" };

  function makeChain(state: { grouped?: boolean; limited?: number; outstandingLimited?: boolean; subquery?: SubqueryMarker }): any {
    return {
      from: (table: unknown) => {
        const marker = table as SubqueryMarker | undefined;
        if (marker && marker.__subqueryKind) return makeChain({ subquery: marker });
        return makeChain({});
      },
      innerJoin: () => makeChain(state),
      where: () => makeChain(state),
      groupBy: () => makeChain({ ...state, grouped: true }),
      having: () => makeChain(state),
      orderBy: () => makeChain(state),
      limit: (n: number) => {
        if (state.grouped) return makeChain({ ...state, limited: n });
        return makeChain({ ...state, outstandingLimited: true });
      },
      as: (): SubqueryMarker => {
        asCallCount += 1;
        return { __subqueryKind: asCallCount === 1 ? "eligible" : "skipped" };
      },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        try {
          if (state.subquery) {
            const { eligible, skipped } = computeEligibleAndSkipped();
            const count = state.subquery.__subqueryKind === "eligible" ? eligible.length : skipped;
            resolve([{ count }]);
            return;
          }
          if (state.limited !== undefined) {
            const { eligible } = computeEligibleAndSkipped();
            resolve(eligible.slice(0, state.limited).map((contactId) => ({ contactId })));
            return;
          }
          if (state.outstandingLimited) {
            resolve(rows);
            return;
          }
          resolve([]);
        } catch (err) {
          if (reject) reject(err);
        }
      },
    };
  }

  const db = {
    select: () => makeChain({}),
    update: () => ({
      set: (values: unknown) => ({
        where: (cond: unknown) => ({
          then: (resolve: (v: unknown) => void) => {
            updateCalls.push(values);
            resolve(undefined);
          },
          returning: async () => {
            updateCalls.push(values);
            void cond;
            return rows.map((r) => ({ id: r.assignmentId }));
          },
        }),
      }),
    }),
  } as unknown as Db;
  return { db, updateCalls };
}

function fakeMailer(): {
  mailer: Mailer;
  sent: Array<{ to: { email: string }; subject: string; text: string; html: string }>;
} {
  const sent: Array<{ to: { email: string }; subject: string; text: string; html: string }> = [];
  const mailer: Mailer = {
    async send(m) {
      sent.push({ to: m.to, subject: m.subject, text: m.text, html: m.html });
    },
  };
  return { mailer, sent };
}

describe("reminder email HTML composes to the frame exactly once per section (DEC-441 wave-47)", () => {
  it("never doubles the 'Still to do' block, task titles, sign-off or claim URL", async () => {
    const rows: OutstandingRowShape[] = [
      {
        assignmentId: "assign_a",
        taskId: "task_a",
        taskTitle: "Upload headshot",
        dueDate: new Date(Date.parse("2027-04-10T00:00:00Z")),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_x",
        firstName: "Marcus",
        lastName: "Lee",
        email: "marcus@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
        assignmentCreatedAt: new Date(0),
      },
      {
        assignmentId: "assign_b",
        taskId: "task_b",
        taskTitle: "Complete your bio",
        dueDate: new Date(Date.parse("2027-04-10T00:00:00Z")),
        status: "pending",
        lastRemindedAt: null,
        contactId: "contact_x",
        firstName: "Marcus",
        lastName: "Lee",
        email: "marcus@example.com",
        eventId: "event_1",
        eventName: "DevFlow Conf 2027",
        timezone: "America/Los_Angeles",
        assignmentCreatedAt: new Date(0),
      },
    ];
    const { db } = fakeDb(rows);
    const { mailer, sent } = fakeMailer();

    const result = await remindNow(db, mailer, "event_1", undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(result.sent).toBe(1);
    expect(sent).toHaveLength(1);

    const html = sent[0]?.html ?? "";
    const text = sent[0]?.text ?? "";

    function occurrences(haystack: string, needle: string): number {
      let count = 0;
      let idx = haystack.indexOf(needle);
      while (idx !== -1) {
        count += 1;
        idx = haystack.indexOf(needle, idx + needle.length);
      }
      return count;
    }

    // docs/design/Chautauqua Speakers.dc.html:526 `Still to do` -- the
    // reminder card's "Still to do" eyebrow label, drawn exactly once.
    expect(occurrences(html, ">Still to do<")).toBe(1);
    expect(occurrences(html, "Upload headshot")).toBe(1);
    expect(occurrences(html, "Complete your bio")).toBe(1);

    // The claim URL occurs exactly twice: the CTA href and the paste line.
    const urlMatches = html.match(/https:\/\/events\.example\.com\/claim\/[^"<\s]+/g) ?? [];
    const claimUrls = new Set(urlMatches);
    expect(claimUrls.size).toBe(1);
    const claimUrl = [...claimUrls][0]!;
    expect(occurrences(html, claimUrl)).toBe(2);

    // Never a standalone body line containing just the bare URL outside the
    // CTA href / paste-line contexts (i.e. not preceded by 'href="' or
    // 'browser: ').
    const bareUrlLine = new RegExp(`>${claimUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`);
    expect(html).not.toMatch(bareUrlLine);

    const signature = "— The DevFlow Conf 2027 team";
    expect(html).toContain(signature);
    const signOffIdx = html.indexOf(signature);
    const ctaIdx = html.indexOf("Open your tasks");
    const footerIdx = html.indexOf("You are receiving this because");
    expect(signOffIdx).toBeGreaterThan(ctaIdx);
    expect(signOffIdx).toBeLessThan(footerIdx);

    // Plain-text body unchanged: still the bulleted list, bare portal URL,
    // and signature.
    expect(text).toContain("- Upload headshot — due Sat 10 Apr 2027");
    expect(text).toContain("- Complete your bio — due Sat 10 Apr 2027");
    expect(text).toContain(claimUrl);
    expect(text).toContain(signature);
  });
});
