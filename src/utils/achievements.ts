import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlipRecord } from "../features/vehicles/models/FlipRecord";


const KEY = "flipAchievements";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface AchievementMap {
  [key: string]: boolean;
}

// ------------------------------------------------------
// EVALUATE ACHIEVEMENTS
// ------------------------------------------------------
export async function evaluateAchievements(flips: FlipRecord[]): Promise<string[]> {
  const achieved = new Set<string>();

  // Basic count achievements
  if (flips.length > 0) achieved.add("First Flip");
  if (flips.length >= 10) achieved.add("10 Flips");
  if (flips.length >= 50) achieved.add("50 Flips");

  // Profit achievements
  const totalProfit = flips.reduce((sum, f) => {
    const profit =
      f.pricing?.recommendedSellPrice != null &&
      f.pricing?.recommendedBuyPrice != null
        ? f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice
        : f.pricing?.predictedProfit ?? 0;

    return sum + profit;
  }, 0);

  if (totalProfit >= 100) achieved.add("£100 Profit Club");
  if (totalProfit >= 500) achieved.add("£500 Profit Club");

  // Save to storage
  await AsyncStorage.setItem(KEY, JSON.stringify([...achieved]));

  return [...achieved];
}

// ------------------------------------------------------
// LOAD ACHIEVEMENTS
// ------------------------------------------------------
export async function loadAchievements(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}
