// Run with: npx tsx src/utils/checks/voice.check.ts (from the app root).
// Found by review 2026-10-09: the male-voice hint was a plain substring test, and "male" is the end of
// "female". So "English (UK) Female" scored +5 for "male" and -5 for "female" = 0, ranking level with an
// unlabelled voice instead of below it, and a voice called "Serena" (-5) ranked below a "Female" one.
import { chooseVoice } from "../voiceChoice";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

const voice = (identifier: string, name: string, language = "en-GB", quality = "Default") => ({ identifier, name, language, quality }) as any;

// The exact voice the owner picked wins whatever else is on the phone.
eq(
  "the picked voice wins when it is installed",
  chooseVoice([voice("x-male", "UK English Male"), voice("en-gb-x-gbb-network", "en-gb-x-gbb-network"), voice("x-other", "Other")])?.identifier,
  "en-gb-x-gbb-network"
);

// "Female" must count as female, not as male.
eq(
  "a voice labelled Female does NOT outrank an unlabelled one",
  chooseVoice([voice("v-female", "English (UK) Female"), voice("v-plain", "English (UK)")])?.identifier,
  "v-plain"
);
eq(
  "a voice labelled Female ranks below an unlabelled one whichever order they are listed in",
  chooseVoice([voice("v-plain", "English (UK)"), voice("v-female", "English (UK) Female")])?.identifier,
  "v-plain"
);
eq(
  "a voice labelled Male outranks an unlabelled one",
  chooseVoice([voice("v-plain", "English (UK)"), voice("v-male", "English (UK) Male")])?.identifier,
  "v-male"
);
eq(
  "Male outranks Female",
  chooseVoice([voice("v-female", "English (UK) Female"), voice("v-male", "English (UK) Male")])?.identifier,
  "v-male"
);
eq(
  "a named female voice ranks below a plain one",
  chooseVoice([voice("v-serena", "Serena"), voice("v-plain", "English (UK)")])?.identifier,
  "v-plain"
);
eq(
  "a named male voice outranks a plain one",
  chooseVoice([voice("v-plain", "English (UK)"), voice("v-david", "David")])?.identifier,
  "v-david"
);

// The older rules still hold.
eq(
  "an enhanced voice outranks a default one",
  chooseVoice([voice("v-default", "English (UK)"), voice("v-enhanced", "English (UK)", "en-GB", "Enhanced")])?.identifier,
  "v-enhanced"
);
eq("a British voice outranks an American one", chooseVoice([voice("v-us", "English (US)", "en-US"), voice("v-gb", "English (UK)", "en-GB")])?.identifier, "v-gb");
eq("no English voice at all: null (use the system default)", chooseVoice([voice("v-fr", "Francais", "fr-FR")]), null);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
