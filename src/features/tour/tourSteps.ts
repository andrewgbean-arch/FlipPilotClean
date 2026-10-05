import type { Href } from "expo-router";

/**
 * The guided walkthrough's content: one entry per real button the tour spotlights. Add a step by
 * adding one entry here and wrapping the target button in <TourTarget id="..."> on its screen —
 * see TourTarget.tsx.
 */
export type TourStep = {
  id: string;
  /** The route to navigate to before spotlighting this step's target. */
  screen: Href;
  /** Must match the id a <TourTarget>/useTourTarget on that screen registers. */
  targetId: string;
  title: string;
  body: string;
  /** The shorter, spoken version of the same idea — see onboarding's own STEPS for the pattern. */
  say: string;
};

// Starting with a 3-step subset (Home -> Scan -> History) while the overlay/measurement pipeline
// itself is being built and tested on-device — the remaining 4 steps (Favourites, Marketplace,
// Motors/MOT, and the Home Settings gear) are added once this subset is confirmed working.
export const TOUR_STEPS: TourStep[] = [
  {
    id: "home.scan-tile",
    screen: "/home" as Href,
    targetId: "home.scan-tile",
    title: "Scan to see what it's worth",
    body: "Point the camera at a barcode, or take a photo of anything else. FlipPilot works out what it is and a fair price to buy and sell it for.",
    // "FlipPilot" run together reads as "flip a lot" to the phone's TTS — the spoken line gets a
    // space the written title doesn't need.
    say: "Point the camera at a barcode, or take a photo of anything else, and Flip Pilot works out what it's worth.",
  },
  {
    id: "scan.viewfinder",
    screen: "/scan" as Href,
    targetId: "scan.viewfinder",
    title: "Line it up in the frame",
    body: "Hold a barcode inside the frame to scan it, or use the photo button for anything else. The torch and zoom buttons help with small or far-off codes.",
    say: "Hold a barcode inside the frame, or use the photo button for anything else. The torch and zoom buttons help with small or far-off codes.",
  },
  {
    id: "history.list",
    screen: "/history" as Href,
    targetId: "history.list",
    // Found live: the old copy here described the Save button (on scan-results) and Favourites
    // (a different, not-yet-built step) — neither is visible from this screen, so it read as
    // pointing at the wrong thing. Rewritten to describe only what's actually here.
    title: "Your History",
    body: "Everything you save from a scan lands here, so you can come back and check on it, or pick up where you left off.",
    say: "Everything you save from a scan lands here in your History, so you can always find it again.",
  },
];
