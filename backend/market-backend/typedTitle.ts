/**
 * The make and model number a person types in instead of scanning ("Sony WH-1000XM4"), turned into the title the price
 * lookup works from.
 *
 * A typed name is the best thing the lookup can be given: a photo only names a brand it can read, and a model number
 * stops a search matching the wrong variant. It is also the one input a person fully controls, so it is cleaned before
 * anything searches with it: symbols that mean something to a search or a program are dropped, it has to be short, and
 * a web address or an e-mail address (which is never a make and model) is turned away. A rejection comes back as words
 * the person can act on, as an error reply, which hands the scan back (see scanMeter.ts).
 */
export const TYPED_MIN = 3;
export const TYPED_MAX = 100;
export const TYPED_MAX_WORDS = 14;

export type TypedTitle = { ok: true; title: string } | { ok: false; message: string };

const EXAMPLE = "for example Sony WH-1000XM4";
const SAY = {
  empty: `Type the make and model number, ${EXAMPLE}.`,
  tooShort: `That's too short to look up. Type the make and the model number, ${EXAMPLE}.`,
  tooLong: `That's a bit long. Just the make and the model number please, ${EXAMPLE}.`,
  address: `That looks like a web or e-mail address. Type the make and the model number instead, ${EXAMPLE}.`,
  numbersOnly: `Numbers on their own can't be priced. Type the make as well as the model number, ${EXAMPLE}.`,
};

// Anything that is not a letter (in any language), a digit, a space or the punctuation a product name really uses.
const NOT_A_PRODUCT_CHARACTER = /[^\p{L}\p{N}\s\-.,'&+/()"#%]/gu;
const LOOKS_LIKE_AN_ADDRESS = /https?:|www\.|@|\.(com|co\.uk|net|org|io|uk)(\/|\b)/i;

export function cleanTypedTitle(raw: unknown): TypedTitle {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: false, message: SAY.empty };
  // Looked at before any other work is done on it, so a huge body costs nothing.
  if (raw.length > 400) return { ok: false, message: SAY.tooLong };
  if (LOOKS_LIKE_AN_ADDRESS.test(raw)) return { ok: false, message: SAY.address };

  const title = raw.normalize("NFKC").replace(NOT_A_PRODUCT_CHARACTER, " ").replace(/\s+/g, " ").trim();
  const wordsAndDigits = title.replace(/[^\p{L}\p{N}]/gu, "");

  if (wordsAndDigits.length < TYPED_MIN) return { ok: false, message: SAY.tooShort };
  if (title.length > TYPED_MAX || title.split(" ").length > TYPED_MAX_WORDS) return { ok: false, message: SAY.tooLong };
  if (!/\p{L}/u.test(title)) return { ok: false, message: SAY.numbersOnly };
  return { ok: true, title };
}
