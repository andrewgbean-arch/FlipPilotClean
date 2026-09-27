/**
 * Operation Nightglass: a point-and-click spy adventure released one chapter a
 * month. The game itself is a single web page hosted on the FlipPilot site;
 * this file is the only thing to edit when a new chapter goes live.
 *
 *   EXPO_PUBLIC_NIGHTGLASS_URL   where the game is hosted (defaults to the live site)
 */
export const NIGHTGLASS_URL =
  process.env.EXPO_PUBLIC_NIGHTGLASS_URL?.trim() ||
  "https://flippilot-office-live-frontend.onrender.com/games/nightglass/index.html";

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
