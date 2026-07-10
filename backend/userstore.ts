import fs from "fs";
import path from "path";

/* ================================
   ⭐ TYPES
================================ */
export interface UserData {
  lockedDevice: string | null;

  dailyUses: number;
  monthlyUses: number;

  dailyLimit: number;
  monthlyLimit: number;

  lastScanDate: string;
  lastScanMonth: string;

  tier: "free" | "pro";

  // Optional: track scan types
  barcodeUses: number;
  visionUses: number;

  createdAt: string;
}

type UserStore = Record<string, UserData>;

/* ================================
   ⭐ STORAGE FILE
================================ */
const storePath = path.join(__dirname, "data", "users.json");

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, "{}");
}

function loadStore(): UserStore {
  ensureStore();
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: UserStore) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

let userStore: UserStore = loadStore();

/* ================================
   ⭐ RESET LOGIC
================================ */
function resetIfNeeded(user: UserData) {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  if (user.lastScanDate !== today) {
    user.dailyUses = 0;
    user.barcodeUses = 0;
    user.visionUses = 0;
    user.lastScanDate = today;
  }

  if (user.lastScanMonth !== month) {
    user.monthlyUses = 0;
    user.lastScanMonth = month;
  }
}

/* ================================
   ⭐ CREATE USER TEMPLATE
================================ */
function createUser(): UserData {
  const now = new Date().toISOString();

  return {
    lockedDevice: null,

    dailyUses: 0,
    monthlyUses: 0,

    dailyLimit: 20,
    monthlyLimit: 600,

    lastScanDate: now.slice(0, 10),
    lastScanMonth: now.slice(0, 7),

    tier: "free",

    barcodeUses: 0,
    visionUses: 0,

    createdAt: now,
  };
}

/* ================================
   ⭐ GET USER (AUTO‑CREATE)
================================ */
export function getUser(userId: string): UserData {
  if (!userStore[userId]) {
    userStore[userId] = createUser();
    saveStore(userStore);
  }

  const user = userStore[userId];
  resetIfNeeded(user);

  return user;
}

/* ================================
   ⭐ SAVE USER
================================ */
export function saveUser(userId: string, data: UserData): void {
  userStore[userId] = data;
  saveStore(userStore);
}

/* ================================
   ⭐ INCREMENT USAGE
================================ */
export function incrementUsage(
  userId: string,
  type: "barcode" | "vision"
) {
  const user = getUser(userId);

  user.dailyUses++;
  user.monthlyUses++;

  if (type === "barcode") user.barcodeUses++;
  if (type === "vision") user.visionUses++;

  saveUser(userId, user);
}

/* ================================
   ⭐ CHECK LIMITS
================================ */
export function isOverLimit(userId: string): boolean {
  const user = getUser(userId);

  return (
    user.dailyUses >= user.dailyLimit ||
    user.monthlyUses >= user.monthlyLimit
  );
}

/* ================================
   ⭐ LOCK DEVICE
================================ */
export function lockDevice(userId: string, deviceId: string) {
  const user = getUser(userId);

  if (!user.lockedDevice) {
    user.lockedDevice = deviceId;
    saveUser(userId, user);
  }
}

/* ================================
   ⭐ VERIFY DEVICE
================================ */
export function isDeviceAllowed(
  userId: string,
  deviceId: string
): boolean {
  const user = getUser(userId);

  if (!user.lockedDevice) return true;
  return user.lockedDevice === deviceId;
}
