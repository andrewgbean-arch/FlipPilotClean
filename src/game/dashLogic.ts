/**
 * Lampy's Boot Fair Dash — the rules, with no screen attached.
 *
 * Everything here is a plain function of the numbers, so the difficulty curve
 * and the scoring can be checked without a phone. The screen does the drawing;
 * this decides what any of it means.
 */

export type ItemKind = {
  id: string;
  name: string;
  /** What a bargain is worth. Tat is worth nothing and costs you a bag. */
  value: number;
  tat: boolean;
};

/* --------------------------------------------------------------
   WHAT IS ON THE TABLES
   Values are made up for the game. Nothing here comes from a real
   price lookup, so no pricing licence is involved and the game
   never pretends to tell you what anything is really worth.
-------------------------------------------------------------- */
export const BARGAINS: ItemKind[] = [
  { id: "lamp", name: "Brass lamp", value: 32, tat: false },
  { id: "vinyl", name: "Vinyl LP", value: 18, tat: false },
  { id: "camera", name: "Old camera", value: 45, tat: false },
  { id: "watch", name: "Pocket watch", value: 60, tat: false },
  { id: "teapot", name: "Teapot", value: 14, tat: false },
  { id: "trainers", name: "Trainers", value: 40, tat: false },
  { id: "ring", name: "Gold ring", value: 85, tat: false },
  { id: "console", name: "Games console", value: 55, tat: false },
  { id: "plate", name: "China plate", value: 22, tat: false },
  { id: "spoons", name: "Silver spoons", value: 28, tat: false },
];

export const TAT: ItemKind[] = [
  { id: "mug", name: "Cracked mug", value: 0, tat: true },
  { id: "tape", name: "Chewed-up tape", value: 0, tat: true },
  { id: "shoe", name: "Odd shoe", value: 0, tat: true },
  { id: "plant", name: "Dead plant", value: 0, tat: true },
  { id: "tin", name: "Rusty tin", value: 0, tat: true },
];

export const ALL_KINDS: ItemKind[] = [...BARGAINS, ...TAT];

export function kindById(id: string): ItemKind | undefined {
  return ALL_KINDS.find((k) => k.id === id);
}

/* --------------------------------------------------------------
   DIFFICULTY
   Gentle for the first few seconds so a child or a first-timer gets
   a feel for it, then it tightens. Every curve is capped, because a
   game that becomes impossible is a game nobody beats their score at.
-------------------------------------------------------------- */

/**
 * How fast things fall, in points per second. It runs inside the frame loop on the UI thread, so
 * it must be a worklet: without the marker, calling it there closed the app on phones.
 */
export function fallSpeed(elapsed: number): number {
  "worklet";
  return 150 + Math.min(300, Math.max(0, elapsed) * 11);
}

/** How long between drops, in milliseconds. */
export function dropGap(elapsed: number): number {
  return Math.max(360, 900 - Math.max(0, elapsed) * 22);
}

/** The share of what falls that is junk. */
export function tatChance(elapsed: number): number {
  return Math.min(0.42, 0.14 + Math.max(0, elapsed) * 0.011);
}

/** Now and then something really good turns up. */
export const GOLDEN_CHANCE = 0.055;
export const GOLDEN_MULTIPLIER = 4;

/* --------------------------------------------------------------
   SCORING
-------------------------------------------------------------- */

/**
 * What a catch is worth. The combo is the whole game: every bargain in a
 * row is worth more than the last, and one bit of tat wipes it out.
 */
export function payout(value: number, combo: number, golden: boolean): number {
  const base = golden ? value * GOLDEN_MULTIPLIER : value;
  return Math.round(base * Math.max(1, combo));
}

/**
 * The magnet.
 *
 * It was every fifth catch for four seconds, which was far too generous: once
 * you got going it never switched off, everything drifted towards you and the
 * game played itself. It has to be a rare few seconds that feel like a reward,
 * not the normal state of play — so it is a golden find, or a properly long
 * streak, and it is over quickly.
 */
export const MAGNET_EVERY = 12;
export const MAGNET_MS = 2500;
export const GOLDEN_MAGNET_MS = 3000;

/** How far across the screen it reaches, as a fraction of the width. */
export const MAGNET_RANGE = 0.35;
/** How hard it pulls. Gentle enough to look like attraction, not teleporting. */
export const MAGNET_PULL = 2;

export function earnsMagnet(combo: number): boolean {
  return combo > 0 && combo % MAGNET_EVERY === 0;
}

/**
 * How far an item slides towards him this frame. Only things already near him
 * move at all — a magnet that reaches the far edge of the screen means never
 * having to move, which is the whole game gone.
 */
export function magnetPull(
  itemCx: number,
  lampyCx: number,
  screenWidth: number,
  dt: number
): number {
  "worklet";
  const gap = lampyCx - itemCx;
  if (Math.abs(gap) > screenWidth * MAGNET_RANGE) return 0;
  return gap * Math.min(1, dt * MAGNET_PULL);
}

export const STARTING_BAGS = 3;

/* --------------------------------------------------------------
   CATCHING
   The catch box is his lampshade, taken from the drawing: the shade
   runs from y=40 to y=262 in a 640-tall character, and is widest at
   the rim. A little slack above it, because a near miss that clearly
   landed on his head should count.
-------------------------------------------------------------- */
export const SHADE_TOP = 40 / 640;
export const SHADE_RIM = 262 / 640;
export const SHADE_HALF_WIDTH = 0.4;
export const CATCH_SLACK = 18;

export function isCaught(
  itemCx: number,
  itemCy: number,
  lampyCx: number,
  lampyTop: number,
  lampyW: number,
  lampyH: number
): boolean {
  "worklet";
  const withinX = Math.abs(itemCx - lampyCx) < lampyW * SHADE_HALF_WIDTH;
  const top = lampyTop + lampyH * SHADE_TOP - CATCH_SLACK;
  const bottom = lampyTop + lampyH * SHADE_RIM;
  return withinX && itemCy > top && itemCy < bottom;
}

/* --------------------------------------------------------------
   PICKING WHAT FALLS NEXT
-------------------------------------------------------------- */
export type Drop = { kind: ItemKind; golden: boolean };

/**
 * `roll` values are passed in rather than generated, so a test can decide
 * exactly what turns up instead of hoping.
 */
export function pickDrop(
  elapsed: number,
  rolls: { isTat: number; golden: number; which: number }
): Drop {
  const tat = rolls.isTat < tatChance(elapsed);
  const table = tat ? TAT : BARGAINS;
  const kind = table[Math.min(table.length - 1, Math.floor(rolls.which * table.length))];
  return { kind, golden: !tat && rolls.golden < GOLDEN_CHANCE };
}

export function randomDrop(elapsed: number): Drop {
  return pickDrop(elapsed, {
    isTat: Math.random(),
    golden: Math.random(),
    which: Math.random(),
  });
}

/* --------------------------------------------------------------
   THE END OF A RUN
-------------------------------------------------------------- */
export function verdict(takings: number, best: number): string {
  if (takings > 0 && takings >= best) return "New personal best";
  if (takings > 200) return "Cracking morning";
  if (takings > 80) return "Not a bad morning";
  if (takings > 0) return "Slim pickings";
  return "Came home empty handed";
}

export function formatMoney(pounds: number): string {
  return "£" + Math.round(pounds).toLocaleString("en-GB");
}
