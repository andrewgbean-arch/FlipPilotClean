/**
 * Game sound, built so it cannot hold the game up.
 *
 * `expo-audio` is not in the build yet — the old `expo-av` was removed and
 * putting a sound library back needs a native rebuild. Rather than block the
 * game on that, this loads the library only if it is there. With it, you get
 * the bleeps; without it, every call quietly does nothing and the game plays
 * exactly as it does now.
 *
 * To switch sound on: `npx expo install expo-audio`, drop the four wav files
 * into src/game/sounds/, and rebuild. No other code changes.
 */

export type Cue = "catch" | "golden" | "tat" | "over";

type Player = { play: () => void; seekTo: (s: number) => void; remove?: () => void };

let players: Partial<Record<Cue, Player>> | null = null;
let tried = false;
let enabled = true;

function load() {
  if (tried) return;
  tried = true;

  try {
    // Deliberately indirect: a plain import would be resolved at build time and
    // would fail the bundle while the package is absent.
    const req: (name: string) => any = eval("require");
    const audio = req("expo-audio");
    if (!audio?.createAudioPlayer) return;

    players = {
      catch: audio.createAudioPlayer(req("./sounds/catch.wav")),
      golden: audio.createAudioPlayer(req("./sounds/golden.wav")),
      tat: audio.createAudioPlayer(req("./sounds/tat.wav")),
      over: audio.createAudioPlayer(req("./sounds/over.wav")),
    };
  } catch {
    // No package, or no files yet. Silence is the correct outcome.
    players = null;
  }
}

/** True once sound is actually available, for a settings line if wanted. */
export function soundAvailable(): boolean {
  load();
  return players !== null;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function play(cue: Cue) {
  if (!enabled) return;
  load();

  const player = players?.[cue];
  if (!player) return;

  try {
    // Restart from the beginning: catches come faster than a sound is long.
    player.seekTo(0);
    player.play();
  } catch {
    // A sound that will not play must never take the game down with it.
  }
}
