// api.ts — clean, stable, LAN‑ready API layer

const LOCAL_LAN_IP = "192.168.0.47"; // your laptop IP
const PORT = 3001;

// ⭐ Base URL for phone + dev build
export const BASE_URL = `http://${LOCAL_LAN_IP}:${PORT}`;

// -----------------------------
// BARCODE SEARCH
// -----------------------------
export async function searchBarcode(barcode: string) {
  try {
    const res = await fetch(`${BASE_URL}/search?q=${barcode}`);
    if (!res.ok) throw new Error("Search failed");
    return await res.json();
  } catch (err) {
    console.log("❌ Barcode search error:", err);
    return null;
  }
}

// -----------------------------
// AI LOOKUP (VISION)
// -----------------------------
export async function aiLookup(imageBase64: string) {
  try {
    const res = await fetch(`${BASE_URL}/search-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!res.ok) throw new Error("AI lookup failed");
    return await res.json();
  } catch (err) {
    console.log("❌ AI lookup error:", err);
    return null;
  }
}

// -----------------------------
// VEHICLE PHOTO CONDITION ANALYSIS
// -----------------------------
export async function analyzeVehiclePhoto(imageBase64: string) {
  try {
    const res = await fetch(`${BASE_URL}/vehicle-photo-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!res.ok) throw new Error("Vehicle photo analysis failed");
    return await res.json();
  } catch (err) {
    console.log("❌ Vehicle photo analysis error:", err);
    return null;
  }
}
