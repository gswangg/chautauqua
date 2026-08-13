// DEC-917: one optionality grammar for every form row in the product --
// no asterisks, and the identical " · optional" suffix on every skippable
// row so the two form renderers (src/views/form-render.tsx and
// app/src/components/ModalFrame.tsx) cannot drift from each other.
export const OPTIONAL_SUFFIX = " · optional";
