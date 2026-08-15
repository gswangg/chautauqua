// DEC-917: one optionality grammar for every form row in the product --
// no asterisks, and the identical " · optional" suffix on every skippable
// row so the two form renderers (src/views/form-render.tsx and
// app/src/components/ModalFrame.tsx) cannot drift from each other.
export const OPTIONAL_SUFFIX = " · optional";

// DEC-422 (wave-67 amendment): per-form question ceiling AND the write/echo
// burst bound for reorderFields (src/server/repo/forms.ts) -- moved out of
// that drizzle-importing repo module so the form builder's Add-a-question
// control can import and print it (a route/repo module the SPA cannot
// import can never disclose a cap it enforces).
export const MAX_FORM_FIELDS = 200;

// w2-c: dropdown option COUNT ceiling (each option was already capped at
// MAX_NAME_LENGTH, but the array itself was unbounded) -- also doubles as
// the cardinality cap for a text/long_text trigger's 'in' rule.value array,
// both of which end up rendered/serialized on the public CFP.
export const MAX_FIELD_OPTIONS = 50;
