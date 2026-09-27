/**
 * Operation Nightglass: a point-and-click spy adventure released one chapter a
 * month. Each chapter is a single web page bundled with the app in
 * assets/games/nightglass/chapter<N>.html and played in a WebView, so it works
 * offline. To add a chapter: copy dist/chapter<N>.html from the
 * operation-nightglass repo into that folder, add it to GAME_PAGES below and
 * list it in CHAPTERS. To release it, remove its comingLabel.
 */
export type Chapter = {
  id: number;
  number: string;
  place: string;
  blurb: string;
  /**
   * Shown instead of a Play button until the chapter is released. Development
   * builds can still preview a chapter that is bundled but not yet released.
   */
  comingLabel?: string;
};

// The bundled pages, by chapter id. Chapters without a page are coming soon.
export const GAME_PAGES: Record<number, number> = {
  1: require("../../assets/games/nightglass/chapter1.html"),
  2: require("../../assets/games/nightglass/chapter2.html"),
  3: require("../../assets/games/nightglass/chapter3.html"),
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
  },
  {
    id: 3,
    number: "Three",
    place: "The Iron Arrow",
    blurb:
      "Handcuffed on a night train to Moscow, with the plans hidden under the mattress. Borrow a waiter's jacket, serve the Colonel his champagne, and find out why Ilse dropped her glove.",
    comingLabel: "Arriving the month after",
  },
];
