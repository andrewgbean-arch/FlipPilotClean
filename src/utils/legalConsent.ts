import AsyncStorage from "@react-native-async-storage/async-storage";

import { LEGAL_VERSION } from "@/constants/legal";

const KEY = "flippilot.legalAccepted";

type Acceptance = { version: string; acceptedAt: string };

/** Has this person agreed to the current terms and confirmed they are an adult? */
export async function hasAcceptedLegal(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return false;
    const record = JSON.parse(raw) as Acceptance;
    return record?.version === LEGAL_VERSION;
  } catch {
    // If storage cannot be read, ask again rather than assume agreement.
    return false;
  }
}

export async function recordLegalAcceptance(): Promise<void> {
  const record: Acceptance = { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY, JSON.stringify(record));
}
