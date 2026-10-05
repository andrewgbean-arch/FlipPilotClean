import * as Speech from "expo-speech";

/**
 * Narration for the first-run walkthrough, spoken by the phone's own text-to-speech — free, and
 * needs no key or credits (ElevenLabs is used elsewhere for the paid business app, not here).
 * Quality varies by phone, so this picks the best voice the device actually offers rather than
 * whatever it defaults to.
 */

let cachedVoiceId: string | null | undefined; // undefined = not looked up yet, null = use the system default

// Picked by ear, live on-device via app/voice-picker.tsx: a British-English, male-sounding
// Google Android voice. Tried first, exactly, before anything else is scored — a different
// phone/OS without this exact voice installed falls through to the heuristic ranking below.
const PREFERRED_VOICE_ID = "en-gb-x-gbb-network";

// expo-speech's Voice type has no gender field — Android TTS engines don't expose one through
// this API — so this is a best-effort guess from the voice's own name/identifier string. Google's
// Android voices are commonly named like "en-gb-x-gbd-local" with no readable hint at all, in
// which case neither list below matches anything and gender just doesn't factor into the score;
// other engines (Samsung's, some OEM ones) do spell it out ("UK English Male", "David").
const MALE_NAME_HINTS = ["male", " m)", "(m)", "david", "daniel", "oliver", "george", "arthur", "ryan"];
const FEMALE_NAME_HINTS = ["female", " f)", "(f)", "serena", "kate", "emma", "amy", "fiona"];

/** Highest-quality, most fitting voice from what the device offers, or null for the system default. */
export function chooseVoice(voices: Speech.Voice[]): Speech.Voice | null {
  const preferred = voices.find((v) => v.identifier === PREFERRED_VOICE_ID);
  if (preferred) return preferred;

  const english = voices.filter((v) => v.language?.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;

  const rank = (v: Speech.Voice) => {
    let score = 0;
    if (v.quality === Speech.VoiceQuality.Enhanced) score += 10;
    // A UK app: prefer a British voice, then any other English, over a UK-adjacent-but-not-quite one.
    const lang = v.language.toLowerCase();
    if (lang === "en-gb" || lang === "en_gb") score += 3;
    else if (lang.startsWith("en-us") || lang.startsWith("en_us")) score += 1;
    const label = `${v.name} ${v.identifier}`.toLowerCase();
    if (MALE_NAME_HINTS.some((hint) => label.includes(hint))) score += 5;
    if (FEMALE_NAME_HINTS.some((hint) => label.includes(hint))) score -= 5;
    return score;
  };

  return [...english].sort((a, b) => rank(b) - rank(a))[0];
}

async function bestVoiceId(): Promise<string | null> {
  if (cachedVoiceId !== undefined) return cachedVoiceId;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    cachedVoiceId = chooseVoice(voices)?.identifier ?? null;
  } catch {
    cachedVoiceId = null;
  }
  return cachedVoiceId;
}

export function stopSpeaking() {
  Speech.stop().catch(() => {});
}

/** Speaks one line, using the best voice found. Never throws: a device with no speech engine just stays quiet. */
export async function speakLine(text: string, onDone?: () => void): Promise<void> {
  try {
    const voice = await bestVoiceId();
    Speech.speak(text, {
      voice: voice ?? undefined,
      // A touch brighter and quicker than flat-neutral reads as more upbeat without sounding sped
      // up or cartoonish.
      pitch: 1.08,
      rate: 1.02,
      onDone,
      onStopped: onDone,
      onError: onDone,
    });
  } catch {
    onDone?.();
  }
}
