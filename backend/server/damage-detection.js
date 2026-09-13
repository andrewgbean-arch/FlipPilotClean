import { YOLO } from "ultralytics";
import express from "express";
import multer from "multer";

const app = express();
const upload = multer({ dest: "uploads/" });

const model = new YOLO("yolov8n.pt"); // You can replace with a custom car model

app.post("/detect", upload.single("image"), async (req, res) => {
  try {
    const results = await model.predict(req.file.path);

    const detections = results[0].boxes.map((box) => ({
      x: box.xyxy[0],
      y: box.xyxy[1],
      w: box.xyxy[2] - box.xyxy[0],
      h: box.xyxy[3] - box.xyxy[1],
      confidence: box.conf,
      class: box.cls,
    }));

    res.json({ detections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI detection failed" });
  }
});

app.listen(3001, () => console.log("AI server running on port 3001"));
