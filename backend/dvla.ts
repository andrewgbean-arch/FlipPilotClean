import { Router } from "express";

const router = Router();

router.get("/dvla", async (req, res) => {
  const reg = req.query.reg as string;

  if (!reg) {
    return res.json({ ok: false, error: "Missing reg" });
  }

  return res.json({
    ok: true,
    vehicle: {
      make: "Ford",
      model: "Fiesta",
      year: 2015,
      colour: "Blue"
    }
  });
});

export default router;

