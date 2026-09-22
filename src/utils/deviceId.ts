import AsyncStorage from "@react-native-async-storage/async-storage";

// A stable, self-generated id for this install — there's no login in the app,
// so this is the only thing the free-scan weekly cap can count against. It is
// not a security credential (clearing app storage gets a fresh one), just a
// soft bucket key; see backend/middleware/freeScanLimit.ts.
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
