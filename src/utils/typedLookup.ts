// What the "make and model number" box on the Scan screen does with what is typed. Kept apart from the screen so it can
// be checked (src/utils/checks/typedLookup.check.ts). The server cleans it again before anything searches with it
// (backend/market-backend/typedTitle.ts), so this only decides whether the Go button is ready and where a lookup goes.

export const TYPED_MIN = 3;
/** The server's limit as well: a longer name is turned away there. */
export const TYPED_MAX = 100;

/** Spaces tidied, which is what gets sent. */
export const tidyTyped = (text: string): string => text.replace(/\s+/g, " ").trim();

// Letters (including accented ones) and digits only, so "- -" or "..." never counts as a name.
const NAME_CHARACTER = /[0-9A-Za-zÀ-ɏ]/g;

/** Whether enough has been typed to be worth a lookup: the Go button is switched on by this. */
export const typedReady = (text: string): boolean => (tidyTyped(text).match(NAME_CHARACTER) ?? []).length >= TYPED_MIN;

// Home's "Make & Model" tile asks the Scan tab to put the cursor in the box when it opens. A flag the Scan screen picks up
// as it comes into view, not a route parameter: a parameter sent to a tab screen from another tab never reached it.
let focusWanted = false;
export const askForTypedFocus = () => {
  focusWanted = true;
};
/** True once for each ask, then false until asked again. */
export const takeTypedFocusRequest = (): boolean => {
  const wanted = focusWanted;
  focusWanted = false;
  return wanted;
};

/**
 * A barcode number typed into the box (8 to 14 digits, spaces and dashes ignored) is looked up as a barcode, which is
 * what the person meant and gets a far better answer than the digits would as a name. Otherwise null.
 */
export const typedBarcode = (text: string): string | null => {
  const digits = text.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
};
