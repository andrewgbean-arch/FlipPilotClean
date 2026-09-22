import { FlipRecord } from "../models/FlipRecord";

// ===============================
// VEHICLE TIMELINE ENGINE
// ===============================
export function buildVehicleTimeline(vehicle: FlipRecord) {
  const timeline: {
    type: string;
    date: string;
    label: string;
  }[] = [];

  // Purchase
  if (vehicle.timestamp) {
    timeline.push({
      type: "purchase",
      date: vehicle.timestamp,
      label: "Purchased",
    });
  }

  // MOT expiry
  if (vehicle.mot?.motExpiry) {
    timeline.push({
      type: "mot-expiry",
      date: vehicle.mot.motExpiry,
      label: "MOT Expiry",
    });
  }

  // AI insights
  if (vehicle.insights) {
    timeline.push({
      type: "ai-insight",
      date: new Date().toISOString(),
      label: `AI Insight: ${vehicle.insights}`,
    });
  }

  // Market scan
  if (vehicle.market?.average) {
    timeline.push({
      type: "market-scan",
      date: new Date().toISOString(),
      label: `Market Avg £${vehicle.market.average}`,
    });
  }

  return timeline.sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
