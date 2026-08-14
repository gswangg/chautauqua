// Itinerary picker inline vanilla JS, shared by the agenda/schedule
// surfaces. Split out of the former monolithic src/routes/public/agenda.tsx
// (contention decomposition, wave 66) — no behavior change.

import { MAX_ITINERARY_IDS, itineraryStorageKey, mergeItinerarySelection, mirrorItineraryCheckboxes } from "../../lib/itinerary";

/** Itinerary picker inline vanilla JS (DEC-022): reads/writes
 * localStorage chq_itinerary_<slug>, keeps the .ics download link's ?ids=
 * query in sync with the checked set. */
export function ItineraryScript(props: { eventSlug: string }) {
  const storageKey = itineraryStorageKey(props.eventSlug);
  // EMB-10/11: mergeItinerarySelection's own body references MAX_ITINERARY_IDS
  // as a free identifier -- .toString() embeds only the function's SOURCE,
  // never its closed-over module-level const, so the const must be emitted into
  // the IIFE below too. Without it every change handler throws before
  // localStorage.setItem ever runs and no pick persists.
  // NB: keep this explanation OUT of the emitted `js` string. The hostile-input
  // surface test (test/public-surface-hostile-input.test.ts) asserts no public
  // response body ever names a raw exception type, so a comment naming one
  // would fail it once shipped inside the inline script.
  const js = `(function(){
  var MAX_ITINERARY_IDS = ${MAX_ITINERARY_IDS};
  var __chqMerge = (${mergeItinerarySelection.toString()});
  var __chqMirror = (${mirrorItineraryCheckboxes.toString()});
  var key = ${JSON.stringify(storageKey)};
  var slug = ${JSON.stringify(props.eventSlug)};
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { stored = []; }
  var boxes = document.querySelectorAll('.chq-itinerary-toggle');
  // DEC-584: the desktop grid and the phone list both render a
  // '.chq-itinerary-toggle' for every session (one is display:none at a
  // time, but both stay in the DOM), so the SAME submission id appears
  // twice in the raw NodeList -- dedupe before this list reaches
  // __chqMerge, or the itinerary is not the set of unique rendered ids.
  var allRenderedIds = [];
  Array.prototype.forEach.call(boxes, function(b){
    if (allRenderedIds.indexOf(b.value) === -1) { allRenderedIds.push(b.value); }
  });
  function currentIds(){
    return Array.prototype.filter.call(boxes, function(b){ return b.checked; }).map(function(b){ return b.value; });
  }
  function updateLink(ids){
    var link = document.getElementById('chq-ics-link');
    var count = document.getElementById('chq-ics-count');
    if (count) { count.textContent = ids.length + ' picked'; }
    if (!link) return;
    if (ids.length === 0) { link.setAttribute('aria-disabled', 'true'); link.removeAttribute('href'); return; }
    link.removeAttribute('aria-disabled');
    link.href = '/e/' + slug + '/schedule.ics?ids=' + encodeURIComponent(ids.join(','));
  }
  // DEC-602: 'Show only my picks' toggle (/schedule only -- no-ops
  // harmlessly if these elements aren't on the page). Filters the rendered
  // list to the stored ids, shows a live count and an honest empty state,
  // and drops a session the moment it's unchecked (see applyPicksFilter
  // call at the end of the change handler below).
  var picksOnly = document.getElementById('chq-picks-only');
  var picksCount = document.getElementById('chq-picks-only-count');
  var picksEmpty = document.getElementById('chq-picks-empty');
  var listItems = Array.prototype.slice.call(document.querySelectorAll('.chq-pub-agenda-list-item'));
  var daySections = Array.prototype.slice.call(document.querySelectorAll('.chq-pub-schedule-day'));
  function applyPicksFilter(){
    var ids = currentIds();
    if (picksCount) { picksCount.textContent = String(ids.length); }
    var on = !!(picksOnly && picksOnly.checked);
    Array.prototype.forEach.call(listItems, function(li){
      var id = li.getAttribute('data-submission-id');
      li.style.display = (!on || ids.indexOf(id) !== -1) ? '' : 'none';
    });
    Array.prototype.forEach.call(daySections, function(sec){
      var items = sec.querySelectorAll('.chq-pub-agenda-list-item');
      var anyVisible = Array.prototype.some.call(items, function(li){ return li.style.display !== 'none'; });
      sec.style.display = (on && !anyVisible) ? 'none' : '';
    });
    if (picksEmpty) { picksEmpty.hidden = !(on && ids.length === 0); }
  }
  Array.prototype.forEach.call(boxes, function(b){ b.checked = stored.indexOf(b.value) !== -1; });
  updateLink(stored);
  applyPicksFilter();
  if (picksOnly) { picksOnly.addEventListener('change', applyPicksFilter); }
  document.addEventListener('change', function(e){
    if (!e.target || !e.target.classList || !e.target.classList.contains('chq-itinerary-toggle')) return;
    // THE TRAP (DEC-584): currentIds() below is "every checked box" across
    // BOTH copies. Without mirroring first, unchecking only the visible
    // copy leaves the hidden copy's box still checked, so the id never
    // leaves currentIds() and the uncheck never persists. Mirror every box
    // sharing the changed input's value to its new checked state first.
    var states = Array.prototype.map.call(boxes, function(b){ return { value: b.value, checked: b.checked }; });
    var mirrored = __chqMirror(states, e.target.value, e.target.checked);
    Array.prototype.forEach.call(boxes, function(b, i){ b.checked = mirrored[i].checked; });
    var latestStored = [];
    try { latestStored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { latestStored = []; }
    var ids = __chqMerge(latestStored, allRenderedIds, currentIds());
    localStorage.setItem(key, JSON.stringify(ids));
    updateLink(ids);
    applyPicksFilter();
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
