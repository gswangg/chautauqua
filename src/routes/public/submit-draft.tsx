// POST /submit/:eventSlug/save-draft (DEC-014 drafts) -- split out of
// submit.tsx purely to reduce merge contention on that file; no behavior
// change. See submit.tsx for the shared DEC references.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  getEventBySlug,
  getDefaultForm,
  getFormFields,
  getEventTracks,
} from "../../server/repo/submit";
import { formWindowState, resolveOfferedTrackIds } from "../../lib/submit-core";
import { LOCKED_SPEAKER_FIELDS } from "../../forms/types";
import { requestIpFromHeaders } from "../../lib/rate-limit";
import { checkAndIncrementScopedLimit } from "../../server/repo/rate-limit";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate";
import { MAX_SUBMISSION_TRACK_IDS } from "../../domain/ids";
import { saveDraft, newDraftToken, draftCookieName, type KVStore as DraftKVStore } from "../../lib/draft";
import { parseCookies, newCsrfToken, buildDraftCookie, isSecureRequest, CSRF_COOKIE_NAME } from "../../auth/cookies";
import { publicNotFound } from "./not-found";
import { ClosedPage, NotYetOpenPage, SubmitPage } from "./submit-views";
import { extractAnswers, extractTrackIds, applyNameSplit } from "./submit-body";
import { emailBudgetOk, refundEmailBudget } from "./submit-guards";

export const publicSubmitDraftRoutes = new Hono<AppEnv>();

publicSubmitDraftRoutes.post("/submit/:eventSlug/save-draft", csrfForm, async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const form = await getDefaultForm(db, event.id);
  if (!form) return publicNotFound(c, "This event is not accepting submissions yet.");

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now(), event.timezone);
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  // DEC-422: save-draft is an otherwise-unmetered KV write path — mirror the
  // final-submit handler's TWO independent budgets (DEC-072/DEC-057/DEC-038):
  // a per-IP scoped limiter (scope "draft", checked here, before touching
  // KV) and a per-email scoped limiter (scope "draft-email", checked below
  // once the submitted email is known, before saveDraft's write). The
  // second budget exists for the same reason final-submit's does:
  // src/lib/rate-limit.ts's own doc comment on requestIpFromHeaders states
  // x-forwarded-for is client-supplied and not a trustworthy identity, so an
  // attacker can rotate it to bypass the IP budget while hammering one
  // address's draft slot.
  // DEC-072 (wave-58 amendment)/DEC-949: IP-keyed, stays UNREFUNDED — same
  // reasoning as final-submit's "submit" scope (see submit-post.tsx): it's a
  // FAILURE budget over the single "unknown" bucket every untrustworthy/
  // absent IP collapses to, and refunding it would stop it being a guard.
  const kv = c.env.KV as unknown as DraftKVStore;
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const rate = await checkAndIncrementScopedLimit(db, "draft", ip, Date.now(), {
    windowSeconds: 3600,
    max: 60,
  });
  if (!rate.ok) {
    throw new ApiError("invalid", "Too many submissions from this address. Try again later.");
  }

  const fields = await getFormFields(db, form.id);
  const eventTracks = await getEventTracks(db, event.id);
  const offeredTrackIds = resolveOfferedTrackIds(form.tracksJson, eventTracks.map((t) => t.id));
  const tracks = eventTracks.filter((t) => offeredTrackIds.includes(t.id));
  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers = extractAnswers(fields, body);
  applyNameSplit(fields, body, answers);
  const selectedTrackIds = extractTrackIds(body);

  // DEC-422 (wave-54 amendment): bound the trackIds SHAPE before saveDraft
  // ever runs — the cap loop below only ever inspected string answers and
  // silently skipped everything else, so an unauthenticated POST could
  // persist an arbitrarily large trackIds array into a 30-day KV record
  // (only the 100 MB body ceiling bounded it). This checks SIZE only: an
  // array over MAX_SUBMISSION_TRACK_IDS entries, or any entry longer than
  // MAX_TEXT_LENGTH, is refused outright. It deliberately does NOT validate
  // trackId membership against the event's offered tracks — task-w49-h
  // already ruled membership is not owed on the draft path.
  if (
    selectedTrackIds.length > MAX_SUBMISSION_TRACK_IDS ||
    selectedTrackIds.some((id) => id.length > MAX_TEXT_LENGTH)
  ) {
    return c.html(
      <SubmitPage
        event={event}
        form={form}
        fields={fields}
        tracks={tracks}
        answers={answers}
        selectedTrackIds={selectedTrackIds}
        hasDraft={false}
        csrfToken={(c.req.header("cookie") && parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE_NAME]) || newCsrfToken()}
        banner="Too many track selections. Try again."
      />,
      400,
    );
  }

  // DEC-422: reject any answer over its field-kind cap before it ever
  // reaches saveDraft — never truncate.
  const fieldCapsById = new Map(fields.map((field) => [field.id, field]));
  for (const [fieldId, value] of Object.entries(answers)) {
    if (typeof value === "boolean") continue;
    if (typeof value !== "string") {
      // Any answer that is neither a string nor a boolean (e.g. an array or
      // object slipped in by a hand-crafted request) is refused outright —
      // never persisted unbounded, never truncated.
      return c.html(
        <SubmitPage
          event={event}
          form={form}
          fields={fields}
          tracks={tracks}
          answers={answers}
          selectedTrackIds={selectedTrackIds}
          hasDraft={false}
          csrfToken={(c.req.header("cookie") && parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE_NAME]) || newCsrfToken()}
          banner="This draft could not be saved. Try again."
        />,
        400,
      );
    }
    const field = fieldCapsById.get(fieldId);
    if (!field) continue;
    const cap = field.kind === "long_text" ? MAX_LONG_TEXT_LENGTH : MAX_TEXT_LENGTH;
    if (value.length > cap) {
      return c.html(
        <SubmitPage
          event={event}
          form={form}
          fields={fields}
          tracks={tracks}
          answers={answers}
          selectedTrackIds={selectedTrackIds}
          hasDraft={false}
          csrfToken={(c.req.header("cookie") && parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE_NAME]) || newCsrfToken()}
          errors={{ [fieldId]: `${field.label} is too long.` }}
        />,
        400,
      );
    }
  }

  // DEC-072 amendment: the second, per-email budget — closes the spoofed-
  // x-forwarded-for gap for the draft path exactly as it does for
  // final-submit (see the comment above the per-IP check). A draft posted
  // before the submitter has typed an email skips this check entirely and
  // behaves exactly as before.
  // DEC-072 (wave-58 amendment): read the clock once so a refund below (if
  // saveDraft fails) lands in the exact same window bucket as this spend.
  const budgetNow = Date.now();
  const draftEmail = String(answers[LOCKED_SPEAKER_FIELDS[2]] ?? "").trim().toLowerCase();
  if (draftEmail) {
    const draftEmailRateOk = await emailBudgetOk(db, "draft-email", draftEmail, 30, budgetNow);
    if (!draftEmailRateOk) {
      return c.html(
        <SubmitPage
          event={event}
          form={form}
          fields={fields}
          tracks={tracks}
          answers={answers}
          selectedTrackIds={selectedTrackIds}
          hasDraft={false}
          csrfToken={(c.req.header("cookie") && parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE_NAME]) || newCsrfToken()}
          banner={`Too many drafts saved from ${draftEmail}. Try again later.`}
        />,
        429,
      );
    }
  }

  // Track selection is stored in the same draft answers blob under a
  // reserved key so it survives resume, without becoming a fake form field.
  (answers as Record<string, unknown>).__trackIds = selectedTrackIds;
  // Drafts never persist file selections (DEC-040): file answers are
  // extracted only at final submit, so `answers` here already omits them.

  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const cookieName = draftCookieName(form.id);
  const token = cookies[cookieName] ?? newDraftToken();
  const savedAt = Date.now();
  // DEC-072 (wave-58 amendment): saveDraft's KV put is the one write on this
  // path after the draft-email spend above — unlike submit-post there was no
  // pre-existing try/catch-rethrow shape here, so this one is added rather
  // than leaving the question open. A rejected put is our own transient
  // failure, not submitter abuse; refund only if the identity-keyed budget
  // was actually spent (draftEmail present) before rethrowing unmodified.
  try {
    await saveDraft(kv, token, { formId: form.id, answers, savedAt });
  } catch (err) {
    if (draftEmail) {
      await refundEmailBudget(db, "draft-email", draftEmail, budgetNow);
    }
    throw err;
  }

  if (!cookies[cookieName]) {
    c.header(
      "Set-Cookie",
      buildDraftCookie(cookieName, token, { secure: isSecureRequest(c.req.url) }),
      { append: true },
    );
  }

  // DEC-245: redirect (rather than re-render) so the URL itself carries the
  // ?draft=saved marker — the GET handler reads it and renders a distinct
  // "Draft saved" confirmation banner above the form.
  return c.redirect(`/submit/${event.slug}?draft=saved`, 302);
});
