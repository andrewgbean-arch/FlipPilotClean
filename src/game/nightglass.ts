/**
 * Operation Nightglass: a point-and-click spy adventure released one chapter a
 * month. The game is a single web page bundled with the app in
 * assets/games/nightglass/index.html and played in a WebView, so it works
 * offline. To release a chapter: replace that file with the new build from the
 * operation-nightglass repo (dist/index.html) and update the list below.
 */
export type Chapter = {
  number: string;
  place: string;
  blurb: string;
  /** Shown instead of a Play button until the chapter is released. */
  comingLabel?: string;
};

export const CHAPTERS: Chapter[] = [
  {
    number: "One",
    place: "Vienna",
    blurb:
      "The plans for a stealth fighter have been stolen. Slip into a colonel's birthday gala, crack his safe and escape across the rooftops before midnight.",
  },
  {
    number: "Two",
    place: "Karvograd",
    blurb: "Who pulled the trigger? The trail leads behind the Iron Curtain.",
    comingLabel: "Arriving next month",
  },
];
