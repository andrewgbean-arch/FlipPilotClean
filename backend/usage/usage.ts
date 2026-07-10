import fs from "fs";
import path from "path";

const FILE = path.join(__dirname, "../usage.json");

// ------------------------------
// Load + Save Helpers
// ------------------------------
function loadUsage() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveUsage(data: any) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ------------------------------
// Constants
// ------------------------------
const DAILY_FREE_LIMIT = 20;       // barcode scans
const DAILY_VISION_LIMIT = 5;      // AI image scans
const MONTHLY_VISION_LIMIT = 100;  // AI image scans

// ------------------------------
// ⭐ MAIN FUNCTION
// ------------------------------
export function registerScan(deviceId: string, type: "vision" | "barcode") {
  const usage = loadUsage();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  // Create user if missing
  if (!usage[deviceId]) {
    usage[deviceId] = {
      tier: "free",
      deviceId,
      visionScansToday: 0,
      visionScansMonth: 0,
      lastScanDate: today,
      lastScanMonth: month,
      today: 0,
    };
  }

  const u = usage[deviceId];

  // Reset Daily
  if (u.lastScanDate !== today) {
    u.visionScansToday = 0;
    u.today = 0;
    u.lastScanDate = today;
  }

  // Reset Monthly
  if (u.lastScanMonth !== month) {
    u.visionScansMonth = 0;
    u.lastScanMonth = month;
  }

  const isFree = u.tier === "free";

  // Barcode logic
  if (type === "barcode") {
    if (isFree && u.today >= DAILY_FREE_LIMIT) {
      return { allowed: false, reason: "daily_barcode_limit" };
    }
    u.today += 1;
  }

  // Vision logic
  if (type === "vision") {
    if (isFree && u.visionScansToday >= DAILY_VISION_LIMIT) {
      return { allowed: false, reason: "daily_vision_limit" };
    }
    if (isFree && u.visionScansMonth >= MONTHLY_VISION_LIMIT) {
      return { allowed: false, reason: "monthly_vision_limit" };
    }

    u.visionScansToday += 1;
    u.visionScansMonth += 1;
  }

  saveUsage(usage);

  return {
    allowed: true,
    tier: u.tier,
    today: u.today,
    visionToday: u.visionScansToday,
    visionMonth: u.visionScansMonth,
  };
}
