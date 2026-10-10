import type { Voice } from "expo-speech";

/**
 * Which of a phone's text-to-speech voices the guided tour should use. Kept apart from voice.ts (which
 * talks to the phone's speech engine) so the ranking can be checked on its own.
 */

// Picked by ear on a real phone: a British-English, male-sounding Google Android voice. Tried
// first, exactly, before anything else is scored — a different phone/OS without this exact voice
// installed falls through to the heuristic ranking below.
const PREFERRED_VOICE_ID = "en-gb-x-gbb-network";

// expo-speech's Voice type has no gender field — Android TTS engines don't expose one through
// this API — so this is a best-effort guess from the voice's own name/identifier string. Google's
// Android voices are commonly named like "en-gb-x-gbd-local" with no readable hint at all, in
// which case neither list below matches anything and gender just doesn't factor into the score;
// other engines (Samsung's, some OEM ones) do spell it out ("UK English Male", "David").
// Whole words only: "male" is also the end of "female", which a plain substring test would count
// as a male voice (and then cancel out against the female hint, ranking it level with an unlabelled one).
const MALE_NAME_HINTS = [/\bmale\b/, / m\)/, /\(m\)/, /\b(?:david|daniel|oliver|george|arthur|ryan)\b/];
const FEMALE_NAME_HINTS = [/\bfemale\b/, / f\)/, /\(f\)/, /\b(?:serena|kate|emma|amy|fiona)\b/];

/** Highest-quality, most fitting voice from what the device offers, or null for the system default. */
export function chooseVoice(voices: Voice[]): Voice | null {
  const preferred = voices.find((v) => v.identifier === PREFERRED_VOICE_ID);
  if (preferred) return preferred;

  const english = voices.filter((v) => v.language?.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;

  const rank = (v: Voice) => {
    let score = 0;
    // expo-speech's VoiceQuality.Enhanced is the string "Enhanced".
    if (String(v.quality) === "Enhanced") score += 10;
    // A UK app: prefer a British voice, then any other English, over a UK-adjacent-but-not-quite one.
    const lang = v.language.toLowerCase();
    if (lang === "en-gb" || lang === "en_gb") score += 3;
    else if (lang.startsWith("en-us") || lang.startsWith("en_us")) score += 1;
    const label = `${v.name} ${v.identifier}`.toLowerCase();
    if (MALE_NAME_HINTS.some((hint) => hint.test(label))) score += 5;
    if (FEMALE_NAME_HINTS.some((hint) => hint.test(label))) score -= 5;
    return score;
  };

  return [...english].sort((a, b) => rank(b) - rank(a))[0];
}
