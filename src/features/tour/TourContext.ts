import { useEffect, useSyncExternalStore } from "react";
import { router, type Href } from "expo-router";
import { Camera as ExpoCamera } from "expo-camera";

import { markOnboardingSeen, isNarrationMuted, setNarrationMuted } from "@/utils/onboarding";
import { speakLine, stopSpeaking } from "@/utils/voice";
import { TOUR_STEPS } from "./tourSteps";

/**
 * The guided walkthrough: narration plays while the tour navigates the REAL app and spotlights
 * the real button it's talking about, rather than describing features on static slides.
 *
 * A plain module store (same shape as src/lib/account.ts's useAccount), not a React Context tree,
 * so a <TourTarget> deep inside any screen can register itself, and the one global <TourOverlay>
 * can read state, without either needing to sit inside a Provider component.
 */

export type Rect = { x: number; y: number; width: number; height: number };

type TargetEntry = { measure: () => Promise<Rect | null>; node: any };
type ScrollContainer = { scrollTo: (y: number) => void; node: any };

type State = {
  active: boolean;
  stepIndex: number;
  muted: boolean;
  targetRect: Rect | null;
  waitingForTarget: boolean;
};

let state: State = {
  active: false,
  stepIndex: 0,
  muted: false,
  targetRect: null,
  waitingForTarget: false,
};

const listeners = new Set<() => void>();
const targets = new Map<string, TargetEntry>();
// Keyed by the step's own `screen` string — a screen whose target can be below the fold (Home's
// Tools row, scrolled past the Getting Started card and Weather) registers its ScrollView here so
// the tour can bring the target into view before spotlighting it, instead of pointing at
// something that's off-screen entirely.
const scrollContainers = new Map<string, ScrollContainer>();
// Bumped on every registerTarget call so a re-measure in progress for a step that's since moved
// on (or the same id re-registering after a navigation) can tell it's stale and drop its result.
let measureToken = 0;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useTourState(): State {
  useEffect(() => {
    isNarrationMuted().then((m) => set({ muted: m }));
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function registerTarget(id: string, measure: () => Promise<Rect | null>, node: any) {
  targets.set(id, { measure, node });
  // If the tour is actively waiting on exactly this target, measure it right away instead of
  // waiting for the next poll tick — makes the spotlight land as soon as the screen is ready.
  const step = TOUR_STEPS[state.stepIndex];
  if (state.active && state.waitingForTarget && step?.targetId === id) {
    measureCurrentTarget();
  }
}

export function unregisterTarget(id: string) {
  targets.delete(id);
}

/** A screen with a scrollable target (e.g. Home's Tools row, below the Getting Started card and
 *  Weather) registers its ScrollView here, keyed by the same `screen` string its TOUR_STEPS entry
 *  uses, so the tour can scroll a below-the-fold target into view before spotlighting it. */
export function registerScrollContainer(screenKey: string, scrollTo: (y: number) => void, node: any) {
  scrollContainers.set(screenKey, { scrollTo, node });
}

export function unregisterScrollContainer(screenKey: string) {
  scrollContainers.delete(screenKey);
}

/** A <TourTarget> pings this after it (re)lays out, in case it's the one being waited on. */
export function notifyTargetLayout(id: string) {
  const step = TOUR_STEPS[state.stepIndex];
  if (state.active && state.waitingForTarget && step?.targetId === id) {
    measureCurrentTarget();
  }
}

const MEASURE_INTERVAL_MS = 80;
// A fixed delay before trusting a measurement wasn't enough: Home's own content above the Tools
// row (the Getting Started card) loads its completion state asynchronously and changes height
// once it resolves, reflowing everything below it — including the very button being spotlighted.
// A single measurement taken mid-reflow is real, but wrong: it's where the button WAS a moment
// ago, not where it ends up. Found live: the ring landed near the header, on whatever was at that
// position before Getting Started finished loading and pushed the real target further down.
// Fix: don't trust a measurement until it's been seen TWICE IN A ROW, unchanged — that's what
// "the layout has actually stopped moving" looks like, however long it takes to get there.
const STABLE_HITS_REQUIRED = 3;
const MAX_ATTEMPTS = 40; // 40 * 80ms = ~3.2s ceiling, generous for a slow-loading card
const RECT_TOLERANCE = 1;

function sameRect(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) <= RECT_TOLERANCE &&
    Math.abs(a.y - b.y) <= RECT_TOLERANCE &&
    Math.abs(a.width - b.width) <= RECT_TOLERANCE &&
    Math.abs(a.height - b.height) <= RECT_TOLERANCE
  );
}

// Calling Speech.speak() immediately after Speech.stop() is a known flaky combo on Android TTS —
// the new utterance can silently no-op, firing onDone almost instantly with nothing actually
// spoken, which then auto-advances on schedule regardless. A short gap avoids the race.
const SPEECH_RESTART_GAP_MS = 150;
// About how long a line takes to read at an easy pace (~170 words a minute), with a floor for short ones.
const readingTimeMs = (text: string) => Math.max(4000, text.trim().split(/\s+/).length * 350);
// A below-the-fold target scrolled to sit right under this much top padding, clear of any fixed
// header/status bar chrome rather than flush against the very top edge.
const SCROLL_TOP_PADDING = 140;

function measureLayoutRelative(node: any, relativeToNode: any): Promise<{ top: number } | null> {
  return new Promise((resolve) => {
    if (!node || !relativeToNode || typeof node.measureLayout !== "function") return resolve(null);
    node.measureLayout(
      relativeToNode,
      (_left: number, top: number) => resolve({ top }),
      () => resolve(null)
    );
  });
}

async function measureCurrentTarget() {
  const myToken = ++measureToken;
  const step = TOUR_STEPS[state.stepIndex];
  if (!step) return;

  let lastRect: Rect | null = null;
  let stableHits = 0;
  let scrollAttempted = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (myToken !== measureToken) return; // superseded by a newer step/navigation
    const entry = targets.get(step.targetId);

    // Below-the-fold targets (Home's Tools row, past Getting Started and Weather) are invisible
    // to a plain window-measure until the screen is scrolled to show them — try to scroll into
    // view once, as soon as both the target and its screen's ScrollView have registered.
    if (!scrollAttempted && entry) {
      const scroller = scrollContainers.get(step.screen as string);
      if (scroller) {
        scrollAttempted = true;
        const layout = await measureLayoutRelative(entry.node, scroller.node);
        if (layout) scroller.scrollTo(Math.max(0, layout.top - SCROLL_TOP_PADDING));
      }
    }

    const rect = entry ? await entry.measure() : null;

    if (rect && rect.width > 0 && rect.height > 0) {
      stableHits = lastRect && sameRect(rect, lastRect) ? stableHits + 1 : 1;
      lastRect = rect;
      if (stableHits >= STABLE_HITS_REQUIRED) {
        if (myToken !== measureToken) return;
        set({ targetRect: rect, waitingForTarget: false });
        stopSpeaking();
        setTimeout(() => {
          if (myToken !== measureToken) return;
          const currentStep = TOUR_STEPS[state.stepIndex];
          if (!currentStep || state.muted) return;
          const startedAt = Date.now();
          const readMs = readingTimeMs(currentStep.say);
          speakLine(currentStep.say, () => {
            if (myToken === measureToken && state.active && !state.muted) {
              // A short pause reads as a natural beat, not a jump-cut, before moving on. And never before
              // the caption could have been READ: a phone with no speech engine "finishes" a line at once,
              // which used to run the whole tour past at about a step a second.
              const wait = Math.max(0, readMs - (Date.now() - startedAt)) + 600;
              setTimeout(() => {
                if (myToken === measureToken && state.active && !state.muted) nextStep();
              }, wait);
            }
          });
        }, SPEECH_RESTART_GAP_MS);
        return;
      }
    } else {
      stableHits = 0;
      lastRect = null;
    }
    await new Promise((r) => setTimeout(r, MEASURE_INTERVAL_MS));
  }
  // Ran out of attempts: leave waitingForTarget true so the overlay can show a neutral state
  // rather than pointing at a stale or zero-size rect.
}

/**
 * Asks for camera access before the tour begins. The first ever visit to the Scan screen otherwise
 * raises the system permission dialog in the middle of the tour: narration stops, the tour carries
 * on behind the dialog, and the camera is not ready when the step reaches it. Does nothing (and shows
 * nothing) when the answer is already known. Resolves true only when access is granted.
 */
async function ensureCameraAccess(): Promise<boolean> {
  try {
    const current = await ExpoCamera.getCameraPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await ExpoCamera.requestCameraPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function cameraGranted(): Promise<boolean> {
  try {
    return (await ExpoCamera.getCameraPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** `direction` says which way to keep looking when a step has to be skipped (Next = 1, Back = -1). */
async function goToStep(requested: number, direction: 1 | -1 = 1) {
  // A step that points at the camera view is skipped when camera access was refused: there is no
  // viewfinder on screen for it to highlight, only the permission screen.
  let index = requested;
  while (TOUR_STEPS[index]?.needsCamera && !(await cameraGranted())) index += direction;
  if (!state.active) return;
  if (index < 0) index = 0;
  const step = TOUR_STEPS[index];
  if (!step) {
    skipTour();
    return;
  }
  stopSpeaking();
  set({ stepIndex: index, targetRect: null, waitingForTarget: true });
  router.push(step.screen as Href);
  measureCurrentTarget();
}

/** Whether the guided tour is running right now (for screens that must not react to what the tour does to them). */
export const isTourActive = () => state.active;

let starting = false;

export async function startTour() {
  // A second tap while the camera question is still open, or while a tour is already running, must not
  // start another one on top (two tours would navigate and narrate over each other).
  if (starting || state.active) return;
  starting = true;
  try {
    // Settled first, so the permission dialog never lands on top of a running tour.
    await ensureCameraAccess();
    if (state.active) return;
    set({ active: true, stepIndex: 0, targetRect: null, waitingForTarget: true });
    const muted = await isNarrationMuted();
    set({ muted });
    goToStep(0);
  } finally {
    starting = false;
  }
}

export function nextStep() {
  if (!state.active) return;
  const next = state.stepIndex + 1;
  if (next >= TOUR_STEPS.length) {
    finishTour();
    return;
  }
  goToStep(next, 1);
}

export function prevStep() {
  if (!state.active) return;
  const prev = Math.max(0, state.stepIndex - 1);
  goToStep(prev, -1);
}

function finishTour() {
  measureToken++; // stop any in-flight measure/speech chain
  stopSpeaking();
  markOnboardingSeen();
  set({ active: false, targetRect: null, waitingForTarget: false });
  // The tour pushes screens as it goes (Marketplace on top of the tabs, then Motors), so finishing or
  // skipping puts the person back on a clean Home rather than wherever the last step happened to be.
  try {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/home" as Href);
  } catch {
    // Navigation not ready (or nothing to dismiss): staying where they are is harmless.
  }
}

export function skipTour() {
  finishTour();
}

export function toggleTourMute() {
  const next = !state.muted;
  setNarrationMuted(next);
  set({ muted: next });
  if (next) {
    stopSpeaking();
  } else {
    const step = TOUR_STEPS[state.stepIndex];
    if (step && state.targetRect) speakLine(step.say);
  }
}
