import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Fair {
  id: string;

  name: string;
  postcode: string;
  nextDate: string;
  entryFee: string;
  stallFee: string;
  openingTime: string;
  closingTime: string;

  website?: string;
  email: string;
  displayEmailPublicly?: boolean;
  categories: string[];
phone?: string;

  address: string;
  lat: number;
  lng: number;
  hours: string;
  frequency: string;

  images: string[];
  featured: boolean;
  busyScore: number;
  description: string;
  verified: boolean;
  lastUpdated: string;

  social: Record<string, string>;

  parking: boolean;
  toilets: boolean;
  foodStalls: boolean;
  dogFriendly: boolean;
  wheelchairAccessible: boolean;

  indoor: boolean;
  weatherSafe: boolean;

  estimatedStalls: number;
  estimatedVisitors: number;

  acceptsCard: boolean;
  acceptsCash: boolean;
}

export const fairs: Fair[] = [];

const USER_FAIRS_KEY = "@flippilot_user_bootfairs";

export async function loadUserFairs(): Promise<Fair[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_FAIRS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addUserFair(fair: Fair): Promise<Fair[]> {
  const existing = await loadUserFairs();
  const updated = [fair, ...existing];
  await AsyncStorage.setItem(USER_FAIRS_KEY, JSON.stringify(updated));
  return updated;
}
