import { Router } from "express";
import { estimateVehiclePrice, type VehicleCondition } from "../vehicle-pricing/estimateVehiclePrice";
import { paidLookupBudget } from "../middleware/dailyBudget";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

const CONDITIONS = new Set<string>(["excellent", "good", "fair", "poor"]);

router.post("/vehicle-price", rateLimit(20), paidLookupBudget, async (req, res) => {
  try {
    const { make, model, year, mileage, condition, motAdvisoryCount, motFailureCount } = req.body ?? {};

    if (typeof make !== "string" || !make.trim() || typeof model !== "string" || !model.trim()) {
      return res.json({ ok: false, error: "missing-fields", message: "Make and model are needed." });
    }
    const yearN = Number(year);
    if (!Number.isFinite(yearN) || yearN < 1950 || yearN > new Date().getFullYear() + 1) {
      return res.json({ ok: false, error: "missing-fields", message: "A valid year is needed." });
    }

    const result = await estimateVehiclePrice({
      make: make.trim(),
      model: model.trim(),
      year: yearN,
      mileage: Number.isFinite(Number(mileage)) ? Number(mileage) : null,
      condition: (typeof condition === "string" && CONDITIONS.has(condition) ? condition : "good") as VehicleCondition,
      motAdvisoryCount: Number.isFinite(Number(motAdvisoryCount)) ? Number(motAdvisoryCount) : 0,
      motFailureCount: Number.isFinite(Number(motFailureCount)) ? Number(motFailureCount) : 0,
    });

    res.json(result);
  } catch (err: any) {
    console.log("VEHICLE PRICE ERROR:", err?.message || err);
    res.json({ ok: false, error: "server-error", message: "Something went wrong. Please try again." });
  }
});

export default router;
