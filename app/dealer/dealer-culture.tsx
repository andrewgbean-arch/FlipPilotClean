import React from "react";
import { DealerCultureBrainScreen } from "../../src/features/dealer-ai/screens/DealerCultureBrainScreen";

export default function DealerCulture() {
  const data = {
    cohesion: 7.4,
    leadership: 8.1,
    alignment: 6.9,
    communication: 7.2,
    motivation: 6.8,
    conflict: 3.1,
    trust: 7.5,
  };

  const stability =
    data.cohesion * 0.25 +
    data.leadership * 0.2 +
    data.alignment * 0.2 +
    data.communication * 0.15 +
    data.motivation * 0.1 +
    (10 - data.conflict) * 0.1;

  const cultureBand =
    stability > 7 ? "HIGH" : stability > 4.5 ? "MEDIUM" : "LOW";

  const cultureAdjustment =
    cultureBand === "HIGH"
      ? 4500
      : cultureBand === "MEDIUM"
      ? 1200
      : -3000;

  const recommendation =
    cultureBand === "HIGH"
      ? "Strong culture — maintain leadership consistency and reward team cohesion."
      : cultureBand === "MEDIUM"
      ? "Moderate culture — improve communication and reduce friction."
      : "Weak culture — restructure leadership and rebuild trust.";

  return (
    <DealerCultureBrainScreen
      data={{
        ...data,
        stability,
        cultureBand,
        cultureAdjustment,
        recommendation,
      }}
    />
  );
}
