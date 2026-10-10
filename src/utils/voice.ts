import * as Speech from "expo-speech";

import { chooseVoice } from "./voiceChoice";

/**
 * Narration for the first-run walkthrough, spoken by the phone's own text-to-speech — free, and
 * needs no key or credits (ElevenLabs is used elsewhere for the paid business app, not here).
 * Quality varies by phone, so this picks the best voice the device actually offers rather than
 * whatever it defaults to (see voiceChoice.ts for how).
 */

export { chooseVoice };

let cachedVoiceId: string | null | undefined; // undefined = not looked up yet, null = use the system default

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

// Bumped by every stopSpeaking() and every new speakLine(), so a line still waiting for the voice list
// (the first call can take a moment on a cold speech engine) knows it has been cancelled or replaced.
let speechRun = 0;

export function stopSpeaking() {
  speechRun++;
  Speech.stop().catch(() => {});
}

/** Speaks one line, using the best voice found. Never throws: a device with no speech engine just stays quiet. */
export async function speakLine(text: string, onDone?: () => void): Promise<void> {
  const myRun = ++speechRun;
  try {
    const voice = await bestVoiceId();
    // Skip, Next or a newer line arrived while the voice was being looked up: stay silent (and don't
    // call onDone: whoever cancelled it has moved on and must not be advanced a second time).
    if (myRun !== speechRun) return;
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
