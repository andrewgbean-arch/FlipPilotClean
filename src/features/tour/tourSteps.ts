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

// Home (scan tile, settings gear) -> Scan -> History -> Favourites -> Marketplace -> Motors.
// "Flip Pilot" in every spoken line: "FlipPilot" run together reads as "flip a lot" to the phone's TTS.
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
    id: "home.settings",
    screen: "/home" as Href,
    targetId: "home.settings",
    title: "Settings and your account",
    body: "Your account, your data and the tour voice live in Settings. You can replay this tour from there any time.",
    say: "Settings is the cog in the corner. Your account and preferences live there, and you can replay this tour from it any time.",
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
  {
    id: "favourites.header",
    screen: "/favourites" as Href,
    targetId: "favourites.header",
    title: "Your Favourites",
    body: "Tap the heart on a flip in History and it's kept here, so your best finds are always one tap away.",
    say: "Tap the heart on a flip in your History and it's kept here, so your best finds are always one tap away.",
  },
  {
    id: "marketplace.sell",
    screen: "/marketplace" as Href,
    targetId: "marketplace.sell",
    title: "Buy and sell nearby",
    body: "The Marketplace is people in your area buying and selling directly. List something in a minute, or message a seller about theirs.",
    say: "The Marketplace is people nearby buying and selling directly with each other. Tap here to list something in a minute.",
  },
  {
    id: "motors.mot-lookup",
    screen: "/motors" as Href,
    targetId: "motors.mot-lookup",
    title: "Checking a car? Look up its MOT",
    body: "Look up a registration to see its full MOT record, mileage history and advisories before you buy or sell it.",
    say: "If you're looking at a car, look up its registration to see its full MOT history and mileage before you buy.",
  },
];
