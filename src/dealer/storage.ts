import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

const KEY = "dealer_stock";

export async function getDealerStock(): Promise<FlipRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveDealerStock(stock: FlipRecord[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(stock));
}
