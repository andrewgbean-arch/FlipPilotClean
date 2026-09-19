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

// Throws if storage itself cannot be read; an empty or unparseable value is just "no fairs".
async function readUserFairs(): Promise<Fair[]> {
  const raw = await AsyncStorage.getItem(USER_FAIRS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadUserFairs(): Promise<Fair[]> {
  try {
    return await readUserFairs();
  } catch {
    return [];
  }
}

// Every fair the app knows about: fairs the user added on this device first,
// then the built-in list. Lists, details and search must all read from here.
export async function getAllFairs(): Promise<Fair[]> {
  const userFairs = await loadUserFairs();
  return [...userFairs, ...fairs];
}

export async function addUserFair(fair: Fair): Promise<Fair[]> {
  // Use the throwing read: if storage can't be read, fail the add instead of
  // writing back a list that contains only this fair and wipes the earlier ones.
  const existing = await readUserFairs();
  const updated = [fair, ...existing];
  await AsyncStorage.setItem(USER_FAIRS_KEY, JSON.stringify(updated));
  return updated;
}
