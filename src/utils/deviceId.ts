import AsyncStorage from "@react-native-async-storage/async-storage";

// A stable, self-generated id for this install. Before someone signs in it is
// all that names them; once they sign in the account's own id replaces it (see
// adoptDeviceId below), and the free scans, which are counted per account, follow
// the account. It is not a security credential (clearing app storage gets a
// fresh one); see backend/middleware/freeScanLimit.ts.
const STORAGE_KEY = "flippilot.deviceId";

let cached: string | null = null;

function randomId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return `${Date.now().toString(16)}-${Array.from({ length: 16 }, hex).join("")}`;
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // Fall through and generate one for this session; it just won't persist.
  }

  const id = randomId();
  cached = id;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage failed — the id still works for this session.
  }
  return id;
}

/**
 * Signing in hands the phone the id its account owns; from then on that is the id it uses.
 */
export async function adoptDeviceId(id: string): Promise<void> {
  cached = id;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage failed — the id still works for this session.
  }
}

/**
 * After signing out or deleting an account the phone can no longer use that account's id (it is
 * protected), so it starts again with a fresh one of its own.
 */
export async function resetDeviceId(): Promise<string> {
  const id = randomId();
  await adoptDeviceId(id);
  return id;
}
