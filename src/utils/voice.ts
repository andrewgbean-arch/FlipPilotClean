import * as Speech from "expo-speech";

/**
 * Narration for the first-run walkthrough, spoken by the phone's own text-to-speech — free, and
 * needs no key or credits (ElevenLabs is used elsewhere for the paid business app, not here).
 * Quality varies by phone, so this picks the best voice the device actually offers rather than
 * whatever it defaults to.
 */

let cachedVoiceId: string | null | undefined; // undefined = not looked up yet, null = use the system default

/** Highest-quality, most fitting voice from what the device offers, or null for the system default. */
export function chooseVoice(voices: Speech.Voice[]): Speech.Voice | null {
  const english = voices.filter((v) => v.language?.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;

  const rank = (v: Speech.Voice) => {
    let score = 0;
    if (v.quality === Speech.VoiceQuality.Enhanced) score += 10;
    // A UK app: prefer a British voice, then any other English, over a UK-adjacent-but-not-quite one.
    const lang = v.language.toLowerCase();
    if (lang === "en-gb" || lang === "en_gb") score += 3;
    else if (lang.startsWith("en-us") || lang.startsWith("en_us")) score += 1;
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
      pitch: 1,
      rate: 0.98,
      onDone,
      onStopped: onDone,
      onError: onDone,
    });
  } catch {
    onDone?.();
  }
}
