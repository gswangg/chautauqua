// GET /submit/:eventSlug (J1 share link) -- split out of submit.tsx purely
// to reduce merge contention on that file; no behavior change. See
// submit.tsx for the shared DEC references (DEC-005, DEC-008, DEC-014).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import {
  getEventBySlug,
  getDefaultForm,
  getFormFields,
  getEventTracks,
} from "../../server/repo/submit";
import type { AnswerMap } from "../../forms/types";
import { formWindowState, resolveOfferedTrackIds } from "../../lib/submit-core";
import {
  parseDraftRecord,
  draftCookieName,
  draftKvKey,
  hashDraftToken,
  type KVStore as DraftKVStore,
} from "../../lib/draft";
import { parseCookies } from "../../auth/cookies";
import { publicNotFound } from "./not-found";
import { ClosedPage, NotYetOpenPage, SubmitPage } from "./submit-views";
import { ensureCsrfCookie } from "./submit-body";

export const publicSubmitGetRoutes = new Hono<AppEnv>();

publicSubmitGetRoutes.get("/submit/:eventSlug", async (c) => {
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

  const fields = await getFormFields(db, form.id);
  const eventTracks = await getEventTracks(db, event.id);
  const offeredTrackIds = resolveOfferedTrackIds(form.tracksJson, eventTracks.map((t) => t.id), form.id);
  const tracks = eventTracks.filter((t) => offeredTrackIds.includes(t.id));

  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const draftCookie = cookies[draftCookieName(form.id)];
  let answers: AnswerMap = {};
  let selectedTrackIds: string[] = [];
  let hasDraft = false;
  let draftSavedAt: number | undefined;
  let draftUnreadable = false;
  if (draftCookie) {
    const kv = c.env.KV as unknown as DraftKVStore;
    const hash = await hashDraftToken(draftCookie);
    const raw = await kv.get(draftKvKey(hash));
    if (raw) {
      const draft = parseDraftRecord(raw);
      if (draft && draft.formId === form.id) {
        answers = draft.answers;
        selectedTrackIds = draft.trackIds;
        hasDraft = true;
        draftSavedAt = draft.savedAt;
      } else if (!draft) {
        // The KV record exists but failed parseDraftRecord's shape check --
        // delete the now-unusable record so the browser isn't stuck
        // carrying a dead cookie for the rest of the 30-day TTL, and tell
        // the person rather than silently starting them over.
        await kv.delete(draftKvKey(hash));
        draftUnreadable = true;
      }
    }
  }

  return c.html(
    <SubmitPage
      event={event}
      form={form}
      fields={fields}
      tracks={tracks}
      answers={answers}
      selectedTrackIds={selectedTrackIds}
      hasDraft={hasDraft}
      draftSavedAt={draftSavedAt}
      csrfToken={csrfToken}
      draftSavedNotice={c.req.query("draft") === "saved"}
      banner={draftUnreadable ? "We couldn't restore your saved draft, so we've started you with a blank form." : undefined}
    />,
  );
});
