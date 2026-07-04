import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@flippilot_history";

export type FlipRecord = {
  id: string;
  title: string;
  barcode: string | null;
  image: string | null;
  buyPrice: number | null;
  sellPrice: number | null;
  profit: number | null;
  roi: number | null;
  confidence: number | null;
  date: string;
  favourite: boolean;
};

export async function saveFlipRecord(record: FlipRecord) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const history: FlipRecord[] = existing ? JSON.parse(existing) : [];

    const updated = [record, ...history];

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return true;
  } catch (error) {
    console.error("Error saving flip:", error);
    return false;
  }
}