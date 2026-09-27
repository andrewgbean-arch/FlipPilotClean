import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Small, real facts about a first-time visit, kept on the phone: has the walkthrough been shown,
 * is its narration muted, and has this phone ever opened the Marketplace (the other three "Getting
 * started" milestones on Home come straight from a real saved flip or vehicle, not a flag).
 */

const ONBOARDING_SEEN_KEY = "flippilot.onboardingSeen";
const NARRATION_MUTED_KEY = "flippilot.onboardingMuted";
const MARKETPLACE_VISITED_KEY = "flippilot.marketplaceVisited";

async function readFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === "1";
  } catch {
    return false;
  }
}
async function writeFlag(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Not knowing it was seen just means it may be shown again; never block on this.
  }
}

export const hasSeenOnboarding = () => readFlag(ONBOARDING_SEEN_KEY);
export const markOnboardingSeen = () => writeFlag(ONBOARDING_SEEN_KEY, true);

export const isNarrationMuted = () => readFlag(NARRATION_MUTED_KEY);
export const setNarrationMuted = (muted: boolean) => writeFlag(NARRATION_MUTED_KEY, muted);

export const hasVisitedMarketplace = () => readFlag(MARKETPLACE_VISITED_KEY);
export const markMarketplaceVisited = () => writeFlag(MARKETPLACE_VISITED_KEY, true);
