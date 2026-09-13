import { Express, Request, Response } from "express";

export default function registerAIDescriptionRoute(app: Express) {
  app.post("/ai/description", (req: Request, res: Response) => {
    const { vehicle, score } = req.body;

    if (!vehicle) {
      return res.status(400).json({ ok: false, error: "Missing vehicle data" });
    }

    const text = `
This ${vehicle.year} ${vehicle.make} ${vehicle.model} comes in a clean ${vehicle.colour} finish and runs on ${vehicle.fuelType}. Powered by a ${vehicle.engineSize}cc engine, it offers reliable performance and smooth driving.

It has a current FlipPilot Score of ${score}/100, reflecting strong condition and good maintenance history. The latest MOT shows a mileage of ${vehicle.mileage ?? "N/A"} with ${
      vehicle.failures?.length ? "some advisories noted" : "no major issues reported"
    }.

Overall, this vehicle is a solid choice for anyone looking for a dependable and well‑maintained car.
    `.trim();

    res.json({ ok: true, description: text });
  });
}
