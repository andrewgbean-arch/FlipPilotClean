// Run with: npx tsx src/utils/checks/typedLookup.check.ts (from the app root).
// The "Type make and model number" box on the Scan screen (added 29 Oct 2026): when its Go button switches on, and
// whether what was typed is looked up as a name or, if it is only a barcode number, as a barcode.
import fs from "fs";
import { TYPED_MAX, TYPED_MIN, askForTypedFocus, takeTypedFocusRequest, tidyTyped, typedBarcode, typedReady } from "../typedLookup";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// Go switches on once there are three letters or digits, and not before: "ab" is not a make and model.
eq("nothing typed: not ready", typedReady(""), false);
eq("only spaces: not ready", typedReady("    "), false);
eq("two characters: not ready", typedReady("ab"), false);
eq("three characters: ready", typedReady("Aga"), true);
eq("a model number on its own is enough here (the server asks for a letter)", typedReady("1234"), true);
eq("dashes and spaces do not count towards the three", typedReady("a - b"), false);
eq("dots and dashes are not a name", typedReady("... ---"), false);
eq("letters with accents count", typedReady("Bürstner"), true);
eq("spaces round a name do not matter", typedReady("   Sony   "), true);

eq("spaces are tidied", tidyTyped("  Sony   WH-1000XM4 \n"), "Sony WH-1000XM4");
eq("a name with nothing to tidy is left alone", tidyTyped("Sony WH-1000XM4"), "Sony WH-1000XM4");

// A barcode number typed into the box is looked up as a barcode (far better than a string of digits as a name).
eq("a 13 digit barcode", typedBarcode("5012345678900"), "5012345678900");
eq("an 8 digit barcode (EAN-8)", typedBarcode("96385074"), "96385074");
eq("a 14 digit barcode", typedBarcode("12345678901234"), "12345678901234");
eq("spaces and dashes inside a barcode are ignored", typedBarcode("5012 3456-78900"), "5012345678900");
eq("7 digits is too short to be a barcode", typedBarcode("1234567"), null);
eq("15 digits is too long to be a barcode", typedBarcode("123456789012345"), null);
eq("a model number with letters is a name", typedBarcode("WH1000XM4"), null);
eq("a name with a number in it is a name", typedBarcode("Sony 12345678"), null);
eq("digits with other punctuation are not a barcode", typedBarcode("5012345678.900"), null);
eq("nothing is not a barcode", typedBarcode(""), null);

// Home's "Make & Model" tile asks for the cursor to be put in the box; the Scan screen takes the ask once as it opens.
eq("no ask yet: nothing to do", takeTypedFocusRequest(), false);
askForTypedFocus();
eq("asked: the Scan screen is told", takeTypedFocusRequest(), true);
eq("and only once, so coming back to the tab later does not pop the keyboard up", takeTypedFocusRequest(), false);

// The server turns away what is too short or too long (backend/market-backend/typedTitle.ts), so the two must agree
// or Go would switch on for a name the server then refuses. They are two packages, so the numbers are read from its file.
const server = fs.readFileSync("backend/market-backend/typedTitle.ts", "utf8");
const serverNumber = (name: string) => Number(new RegExp(`export const ${name} = (\\d+)`).exec(server)?.[1]);
eq("the shortest name matches the server's", TYPED_MIN, serverNumber("TYPED_MIN"));
eq("the longest name matches the server's", TYPED_MAX, serverNumber("TYPED_MAX"));

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
