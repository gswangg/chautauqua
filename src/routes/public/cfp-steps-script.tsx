// w14-f (DEC-986, DEC-385): phone-only two-step CFP wizard inline vanilla
// JS. The wizard is gated on window.matchMedia('(max-width: 700px)') -- the
// SAME query cfp.css.ts declares for its .chq-cfp-step-* chrome -- so it
// never touches a desktop visitor's form: no data-chq-cfp-step write, no
// required-toggling, no scrollIntoView. Mirrors agenda-itinerary-script.tsx's
// shape: one exported component returning a single <script
// dangerouslySetInnerHTML>, no fetch, no change to the POST target.
// DEC-986 wave-138 first shipped this file believing display:none alone made
// it inert on desktop; it did not -- setStep('1') ran unconditionally at
// DOMContentLoaded, un-requiring the visible "about you" controls and
// jump-scrolling the page, a live DEC-385 desktop-freeze breach. The fix has
// two halves: (a) engage and disengage symmetrically across the breakpoint,
// restoring every stashed control's required-ness on disengage so a widened
// visitor is never left with an un-required visible control; (b) an automatic
// (non-user-initiated) state application never scrolls -- only the Next and
// Back click handlers pass scroll:true.
// DEC-986: a step transition un-requires every control it hides and
// restores it when the step is shown again (clause 1), and Next validates
// the outgoing step before it advances (clause 2), so a required control
// never ends up invalid inside a display:none section.
export function CfpStepsScript() {
  const js = `(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var form = document.getElementById('chq-cfp-submit-form');
    if (!form) return;
    // DEC-986: a rejected submission re-renders the SAME form with its
    // errors inline -- if any survive server-side validation, every field
    // (both steps) must stay visible so the speaker can find and fix them,
    // so the wizard never engages (data-chq-cfp-step stays "all").
    var hasError = form.querySelector('.chq-field-error') || form.querySelector('[role="alert"]');
    if (hasError) return;
    // DEC-385: gate on the SAME query the stylesheet declares. Absent
    // matchMedia, the wizard is disengaged entirely (house convention from
    // app/src/lib/useIsPhone.ts: missing matchMedia -> not phone) -- no
    // attribute is set, applyRequiredState never runs, scrollIntoView never
    // fires.
    if (typeof window.matchMedia !== 'function') return;
    var label = form.querySelector('.chq-cfp-steps-label');
    var fill = form.querySelector('.chq-cfp-steps-bar-fill');
    var talkSection = form.querySelector('.chq-cfp-step-talk');
    var youSection = form.querySelector('.chq-cfp-step-you');
    // wave-138 (DEC-385 + DEC-986): the wizard is a PHONE affordance. It must
    // mutate nothing -- no data-chq-cfp-step write, no required-toggling, no
    // scrollIntoView -- outside the same 700px breakpoint the stylesheet
    // uses. active tracks whether the wizard is currently engaged so a
    // resize/orientation change that crosses the breakpoint can arm or
    // disarm cleanly instead of doing both halves' work every time.
    var mql = window.matchMedia('(max-width: 700px)');
    var active = false;
    // DEC-986 clause (1): the required-toggle is part of HIDING, not a
    // separate concern. A step transition un-requires every control in the
    // section it is about to hide and restores the original required-ness
    // when that section is shown again. The original value is stashed on
    // the element itself (data-chq-cfp-required-orig), never in a JS-side
    // map, so it survives however many times a section toggles. Clause (2)
    // below already stops an INVALID control being hidden; this stops a
    // hidden control being constraint-validatable at all, which is what the
    // wave-93 ruling asked for and what keeps step 2's Submit -- which
    // clause (3) deliberately leaves fully validating -- from ever being
    // aborted on a control in the other, display:none step.
    function applyRequiredState(section, visible){
      if (!section) return;
      var controls = section.querySelectorAll('[required], [data-chq-cfp-required-orig]');
      for (var i = 0; i < controls.length; i++) {
        var el = controls[i];
        if (!el.hasAttribute('data-chq-cfp-required-orig')) {
          el.setAttribute('data-chq-cfp-required-orig', el.required ? '1' : '0');
        }
        el.required = visible && el.getAttribute('data-chq-cfp-required-orig') === '1';
      }
    }
    // wave-138: leaving phone width must put every control back exactly as
    // it was found, not merely stop touching it -- a control the wizard
    // un-required while it was hidden must regain its original required-ness
    // once the wizard steps aside and desktop's own layout makes it visible
    // again.
    function restoreOriginalRequired(section){
      if (!section) return;
      var controls = section.querySelectorAll('[data-chq-cfp-required-orig]');
      for (var i = 0; i < controls.length; i++) {
        var el = controls[i];
        el.required = el.getAttribute('data-chq-cfp-required-orig') === '1';
      }
    }
    // DEC-385 clause (b): setStep takes an explicit scroll flag. Only a
    // user-initiated transition (Next/Back) scrolls; an automatic engage
    // from the media-query listener never does.
    function setStep(step, scroll){
      form.setAttribute('data-chq-cfp-step', step);
      applyRequiredState(talkSection, step === '1');
      applyRequiredState(youSection, step === '2');
      if (label) {
        label.textContent = step === '2' ? 'Step 2 of 2 · about you' : 'Step 1 of 2 · your talk';
      }
      if (fill) {
        fill.style.width = step === '2' ? '100%' : '50%';
      }
      if (scroll) form.scrollIntoView();
    }
    // DEC-986 clause (2): "Next" is type="button", so the browser runs no
    // constraint validation of its own when it is pressed. Advancing
    // unchecked hides step 1 (cfp.css.ts's [data-chq-cfp-step="2"]
    // .chq-cfp-step-talk display:none rule) while its controls keep
    // their required flag, and the real Submit on step 2 aborts on a
    // non-focusable invalid control -- no message, no focus, no server hit.
    // So check the OUTGOING step's controls first and reportValidity() the
    // first invalid one: that focuses it and raises the browser's own
    // bubble on a field the speaker can still see, and refuses to advance.
    function firstInvalidIn(section){
      if (!section) return null;
      var controls = section.querySelectorAll('input, select, textarea');
      for (var i = 0; i < controls.length; i++) {
        var control = controls[i];
        if (control.disabled) continue;
        if (typeof control.checkValidity !== 'function') continue;
        if (!control.checkValidity()) return control;
      }
      return null;
    }
    var next = form.querySelector('.chq-cfp-step-next');
    var back = form.querySelector('.chq-cfp-step-back');
    if (next) {
      next.addEventListener('click', function(){
        if (!active) return;
        var invalid = firstInvalidIn(talkSection);
        if (invalid) {
          if (typeof invalid.reportValidity === 'function') invalid.reportValidity();
          else if (typeof invalid.focus === 'function') invalid.focus();
          return;
        }
        setStep('2', true);
      });
    }
    if (back) { back.addEventListener('click', function(){ if (!active) return; setStep('1', true); }); }
    // wave-138: enter/leave the wizard only across the breakpoint. Entering
    // re-runs setStep('1') so a device that starts wide and narrows mid-visit
    // still gets the two-step chrome -- without scrolling, since that
    // transition is not user-initiated; leaving restores every control's
    // original required-ness and puts data-chq-cfp-step back to the inert
    // "all" the server rendered, undoing exactly what setStep did.
    function engage(){
      if (active) return;
      active = true;
      setStep('1', false);
    }
    function disengage(){
      if (!active) return;
      active = false;
      form.setAttribute('data-chq-cfp-step', 'all');
      restoreOriginalRequired(talkSection);
      restoreOriginalRequired(youSection);
    }
    function onBreakpointChange(e){
      if (e.matches) engage(); else disengage();
    }
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onBreakpointChange);
    else if (typeof mql.addListener === 'function') mql.addListener(onBreakpointChange);
    if (mql.matches) engage();
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
