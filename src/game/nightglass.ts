/**
 * Operation Nightglass: a point-and-click spy adventure released one chapter a
 * month. Each chapter is a single web page played in a WebView.
 *
 * Chapter One is bundled with the app (assets/games/nightglass/chapter1.html),
 * so a new player can start at once, offline. Later chapters are downloaded
 * from the FlipPilot server (backend/public/games/nightglass) when the player
 * asks, kept on the phone, and play offline from then on; the player can
 * delete one and download it again (see nightglassDownloads.ts).
 *
 * To add a chapter: copy dist/chapter<N>.html from the operation-nightglass
 * repo into backend/public/games/nightglass and list it in CHAPTERS with a
 * `download` entry. When a chapter is rebuilt, bump its version so players get
 * the new copy. To release it, remove its comingLabel.
 *
 * A released chapter is then unlocked for each player in turn: a new one every four weeks from the day
 * they start, or the next one at once for credits (see nightglassUnlocks.ts). At the end of a chapter
 * the game tells the app, which offers the next one (see ChapterFinished.tsx).
 */
export type Chapter = {
  id: number;
  number: string;
  place: string;
  blurb: string;
  /**
   * Shown instead of a Play button until the chapter is released. Development
   * builds can still preview (and download) a chapter before its release day.
   */
  comingLabel?: string;
  /** For a chapter that is downloaded rather than bundled: its version and size. */
  download?: { version: number; mb: number };
};

// The bundled pages, by chapter id.
export const GAME_PAGES: Record<number, number> = {
  1: require("../../assets/games/nightglass/chapter1.html"),
};

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    number: "One",
    place: "Vienna",
    blurb:
      "The plans for a stealth fighter have been stolen. Slip into a colonel's birthday gala, crack his safe and escape across the rooftops before midnight.",
  },
  {
    id: 2,
    number: "Two",
    place: "Karvograd",
    blurb:
      "Who pulled the trigger? Follow the real plans behind the Iron Curtain: a night train, a snowbound station, and a portrait of the vainest man in Europe.",
    comingLabel: "Arriving next month",
    download: { version: 3, mb: 8.8 },
  },
  {
    id: 3,
    number: "Three",
    place: "The Iron Arrow",
    blurb:
      "Handcuffed on a night train to Moscow, with the plans hidden under the mattress. Borrow a waiter's jacket, serve the Colonel his champagne, and find out why Ilse dropped her glove.",
    comingLabel: "Arriving the month after",
    download: { version: 3, mb: 5.5 },
  },
  {
    id: 4,
    number: "Four",
    place: "Nightglass",
    blurb:
      "A village inn, a secret airbase inside a mountain and a goose called Colonel. Get inside disguised as the baker's boy, photograph the aircraft nobody is supposed to see, and get out again.",
    comingLabel: "Coming soon",
    download: { version: 3, mb: 6.2 },
  },
  {
    id: 5,
    number: "Five",
    place: "The Golden Horn",
    blurb:
      "Istanbul, and the stolen jet is up for auction. Talk your way out of an airfield with a tray of tea, dodge Kolar through the Grand Bazaar, and gatecrash the sale as a buyer nobody has ever seen.",
    comingLabel: "Coming soon",
    download: { version: 3, mb: 6.2 },
  },
  {
    id: 6,
    number: "Six",
    place: "Masquerade",
    blurb:
      "Venice in the fog, and a masked ball where the buyer from London comes to collect. Wake a gondolier with the help of a goose, blow a glass swan on Murano, and row for your life down the Grand Canal.",
    comingLabel: "Coming soon",
    download: { version: 2, mb: 6.2 },
  },
];
