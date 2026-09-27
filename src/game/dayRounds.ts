/**
 * Lampy's Boot Fair Dash — "A day at the boot fair": six rounds, each with its own job.
 *
 * Like dashLogic.ts, this is only the rules: plain functions of the numbers, so a round can be
 * checked without a phone. The screen (app/game/index.tsx) does the drawing.
 *
 * Goals count catches, not pounds. The combo multiplies what a catch pays, so takings swing
 * enormously between a careful player and a lucky one; "catch 10 bargains" means the same to
 * everybody.
 */
import { BARGAINS, GOLDEN_CHANCE, ItemKind, TAT } from "./dashLogic";

export type Goal =
  | { kind: "catch"; count: number } // catch this many genuine bargains
  | { kind: "list"; count: number } // catch one of each thing on the shopping list
  | { kind: "survive" } // still have a bag when the bell goes
  | { kind: "bonus" }; // nothing to fail: grab what you can

export type Round = {
  id: "gates" | "list" | "wind" | "fakes" | "lobs" | "rush";
  clock: string;
  title: string;
  /** What to do, in one or two short lines on the card before the round. */
  howTo: string;
  seconds: number;
  goal: Goal;
  /** Where the difficulty curve starts, in seconds of dashLogic's curve: later rounds start faster. */
  curveStart: number;
  speed: number;
  gap: number;
  /** The share of drops that is tat. */
  tat: number;
  /** The share of bargains that are fakes. */
  fakes: number;
  /** The chance a drop is an umbrella instead. */
  umbrellas: number;
  /** How hard the wind blows, in points a second at its strongest. */
  wind: number;
  /** Tat thrown in from the sides. */
  lobs: boolean;
  /** Everything pays this many times over. */
  pay: number;
  /** The sky at that time of day: top and middle of the gradient. */
  sky: [string, string];
};

export const ROUNDS: Round[] = [
  {
    id: "gates",
    clock: "7:00am",
    title: "Gates open",
    howTo: "Catch 22 bargains before the clock runs out. Leave the grubby tat alone.",
    seconds: 35,
    goal: { kind: "catch", count: 22 },
    curveStart: 0,
    speed: 1,
    gap: 1.35,
    tat: 0.16,
    fakes: 0,
    umbrellas: 0,
    wind: 0,
    lobs: false,
    pay: 1,
    sky: ["#3a2a55", "#1a1f45"],
  },
  {
    id: "list",
    clock: "8:00am",
    title: "The shopping list",
    howTo: "A collector wants the five things at the top, in that order. Only the one that's lit up counts: catch it, then the next.",
    seconds: 30,
    goal: { kind: "list", count: 5 },
    curveStart: 6,
    speed: 1,
    gap: 1.35,
    tat: 0.2,
    fakes: 0,
    umbrellas: 0,
    wind: 0,
    lobs: false,
    pay: 1,
    sky: ["#4a3560", "#222a55"],
  },
  {
    id: "wind",
    clock: "9:30am",
    title: "Blustery",
    howTo: "The wind blows everything sideways. Catch an umbrella and it blocks one bit of tat. Catch 28 bargains.",
    seconds: 40,
    goal: { kind: "catch", count: 28 },
    curveStart: 10,
    speed: 0.95,
    gap: 1.3,
    tat: 0.22,
    fakes: 0,
    umbrellas: 0.06,
    wind: 75,
    lobs: false,
    pay: 1,
    sky: ["#3d4a6a", "#243155"],
  },
  {
    id: "fakes",
    clock: "10:30am",
    title: "Spot the fakes",
    howTo: "Some bargains are fakes: no shine and a wonky red tag. Catch 26 real ones and leave the fakes.",
    seconds: 40,
    goal: { kind: "catch", count: 26 },
    curveStart: 12,
    speed: 0.95,
    gap: 1.25,
    tat: 0.14,
    fakes: 0.3,
    umbrellas: 0,
    wind: 0,
    lobs: false,
    pay: 1,
    sky: ["#35507a", "#223a66"],
  },
  {
    id: "lobs",
    clock: "11:30am",
    title: "Tat attack",
    howTo: "The stall next door is clearing out and lobbing tat at you from the sides. Watch for the warning and keep a bag till the bell.",
    seconds: 35,
    goal: { kind: "survive" },
    curveStart: 12,
    speed: 0.9,
    gap: 1.3,
    tat: 0.1,
    fakes: 0,
    umbrellas: 0.05,
    wind: 0,
    lobs: true,
    pay: 1,
    sky: ["#3c5a8a", "#27406e"],
  },
  {
    id: "rush",
    clock: "12:30pm",
    title: "Closing time rush",
    howTo: "Everyone's selling up cheap. No tat, and everything pays double. Grab all you can!",
    seconds: 20,
    goal: { kind: "bonus" },
    curveStart: 16,
    speed: 1.2,
    gap: 0.6,
    tat: 0,
    fakes: 0,
    umbrellas: 0,
    wind: 0,
    lobs: false,
    pay: 2,
    sky: ["#7a4a3a", "#3a2a4a"],
  },
];

/** What a drop is, to the loop: a bargain to catch, tat, an umbrella, or a fake. */
export type Role = "bargain" | "tat" | "umbrella" | "fake";

export type DayDrop = { kind: ItemKind; golden: boolean; role: Role };

/** An umbrella is drawn and named like any other item. */
export const UMBRELLA: ItemKind = { id: "umbrella", name: "Umbrella", value: 0, tat: false };

/**
 * How often the item the collector wants next turns up, among the bargains. Only the next one is
 * favoured (and only it counts when caught), so the list is worked through in order.
 */
export const LIST_SHARE = 0.15;

/** Three different things for the collector's list. `roll` is 0..1, passed in so a test can fix it. */
export function makeList(roll: () => number, count = 3): ItemKind[] {
  const pool = [...BARGAINS];
  const out: ItemKind[] = [];
  while (out.length < count && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(roll() * pool.length));
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * What falls next in a round. `rolls` are 0..1 and passed in, as in dashLogic.pickDrop.
 * `wanted` is what the collector wants next (empty in other rounds): pass only the next item.
 */
export function pickDayDrop(
  round: Round,
  wanted: ItemKind[],
  rolls: { umbrella: number; tat: number; fake: number; golden: number; which: number; list: number }
): DayDrop {
  if (rolls.umbrella < round.umbrellas) return { kind: UMBRELLA, golden: false, role: "umbrella" };
  if (rolls.tat < round.tat) {
    const kind = TAT[Math.min(TAT.length - 1, Math.floor(rolls.which * TAT.length))];
    return { kind, golden: false, role: "tat" };
  }
  const fromList = wanted.length > 0 && rolls.list < LIST_SHARE;
  const table = fromList ? wanted : BARGAINS;
  const kind = table[Math.min(table.length - 1, Math.floor(rolls.which * table.length))];
  if (!fromList && rolls.fake < round.fakes) return { kind, golden: false, role: "fake" };
  return { kind, golden: rolls.golden < GOLDEN_CHANCE, role: "bargain" };
}

export function randomDayDrop(round: Round, wanted: ItemKind[]): DayDrop {
  return pickDayDrop(round, wanted, {
    umbrella: Math.random(),
    tat: Math.random(),
    fake: Math.random(),
    golden: Math.random(),
    which: Math.random(),
    list: Math.random(),
  });
}

/** A fake that's caught: it cost you, and the run is broken. */
export const FAKE_COST = 15;

/** Pounds for every whole second left on the clock when a round's goal is met. */
export const TIME_BONUS_PER_SECOND = 5;
/** Finishing the shopping list. */
export const LIST_BONUS = 100;

export function timeBonus(secondsLeft: number): number {
  return Math.max(0, Math.floor(secondsLeft)) * TIME_BONUS_PER_SECOND;
}

/** Is the goal met by these numbers? `bells` is true once the round's time is up. */
export function goalMet(goal: Goal, s: { genuine: number; listLeft: number; bags: number; bell: boolean }): boolean {
  switch (goal.kind) {
    case "catch":
      return s.genuine >= goal.count;
    case "list":
      return s.listLeft === 0;
    case "survive":
      return s.bell && s.bags > 0;
    case "bonus":
      return s.bell;
  }
}

/** How far along the goal is, for the bar under the clock: 0..1. */
export function goalProgress(goal: Goal, s: { genuine: number; listLeft: number; secondsLeft: number; seconds: number }): number {
  switch (goal.kind) {
    case "catch":
      return Math.min(1, s.genuine / goal.count);
    case "list":
      return (goal.count - s.listLeft) / goal.count;
    case "survive":
    case "bonus":
      return Math.min(1, 1 - s.secondsLeft / s.seconds);
  }
}

/** Finishing a round gives a bag back (never more than you started with). */
export function bagsAfterRound(bags: number, max: number): number {
  return Math.min(max, bags + 1);
}

/* --------------------------------------------------------------
   TAT ATTACK: things thrown in from the side
-------------------------------------------------------------- */
export const LOB_GRAVITY = 900;

/** Seconds between lobs, drawn from this range. */
export const LOB_EVERY: [number, number] = [1.6, 2.8];
/** How long the warning shows before the throw. */
export const LOB_WARNING_MS = 700;

/**
 * A throw from one side that comes down at `landX`, at the height of Lampy's shade, `flight`
 * seconds later. Returns the starting point and the speeds to give it.
 */
export function lobLaunch(opts: {
  fromLeft: boolean;
  screenW: number;
  startY: number;
  landX: number;
  landY: number;
  flight: number;
  item: number;
}): { x: number; y: number; vx: number; vy: number } {
  const x = opts.fromLeft ? -opts.item : opts.screenW;
  const startCx = x + opts.item / 2;
  const vx = (opts.landX - startCx) / opts.flight;
  const t = opts.flight;
  const vy = (opts.landY - opts.startY - 0.5 * LOB_GRAVITY * t * t) / t;
  return { x, y: opts.startY, vx, vy };
}

/** The wind at a moment: it rises, drops and changes direction, so it can't just be ignored. */
export function windAt(t: number, strength: number): number {
  "worklet";
  if (strength === 0) return 0;
  return strength * (0.75 * Math.sin(t * 0.55) + 0.25 * Math.sin(t * 1.9 + 1));
}

/* --------------------------------------------------------------
   THE END OF A DAY
-------------------------------------------------------------- */
export function dayVerdict(roundsDone: number, total: number): string {
  if (roundsDone >= total) return "What a day!";
  if (roundsDone >= total - 2) return "So close to closing time";
  if (roundsDone >= 2) return "A decent morning";
  if (roundsDone === 1) return "Made it past the gates";
  return "Early start, early finish";
}
