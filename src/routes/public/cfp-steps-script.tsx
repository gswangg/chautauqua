// w14-f (DEC-986): phone-only two-step CFP wizard inline vanilla JS.
// Additive only -- desktop's chq-cfp-step-* chrome stays display:none
// outside the 700px media query (cfp.css.ts), so this script is inert
// there too (it only ever flips an attribute + text/width the desktop
// stylesheet never reads). Mirrors agenda-itinerary-script.tsx's shape:
// one exported component returning a single <script
// dangerouslySetInnerHTML>, no fetch, no change to the POST target.
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
    var label = form.querySelector('.chq-cfp-steps-label');
    var fill = form.querySelector('.chq-cfp-steps-bar-fill');
    function setStep(step){
      form.setAttribute('data-chq-cfp-step', step);
      if (label) {
        label.textContent = step === '2' ? 'Step 2 of 2 · about you' : 'Step 1 of 2 · your talk';
      }
      if (fill) {
        fill.style.width = step === '2' ? '100%' : '50%';
      }
      form.scrollIntoView();
    }
    var next = form.querySelector('.chq-cfp-step-next');
    var back = form.querySelector('.chq-cfp-step-back');
    if (next) { next.addEventListener('click', function(){ setStep('2'); }); }
    if (back) { back.addEventListener('click', function(){ setStep('1'); }); }
    setStep('1');
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
