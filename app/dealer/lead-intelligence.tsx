import React from "react";
import { LeadIntelligenceBrainScreen } from "../../src/features/dealer-ai/screens/LeadIntelligenceBrainScreen";

export default function LeadIntelligence() {
  const leads = [
    {
      name: "John Carter",
      intent: 8.2,
      engagement: 7.4,
      behaviour: 6.9,
      risk: 3.1,
      value: 7.8,
      urgency: 6.2,
    },
    {
      name: "Emily Davis",
      intent: 6.1,
      engagement: 5.4,
      behaviour: 5.9,
      risk: 4.8,
      value: 6.0,
      urgency: 4.2,
    },
    {
      name: "Mark Thompson",
      intent: 4.2,
      engagement: 3.9,
      behaviour: 4.1,
      risk: 6.2,
      value: 4.8,
      urgency: 3.1,
    },
  ];

  const data = leads.map(l => {
    const conversion =
      l.intent * 6 +
      l.engagement * 5 +
      l.behaviour * 4 -
      l.risk * 5 +
      l.value * 4 +
      l.urgency * 3;

    const conversionPercent = Math.min(100, Math.max(0, conversion));

    const leadBand =
      conversionPercent > 70 ? "HIGH" : conversionPercent > 40 ? "MEDIUM" : "LOW";

    const leadAdjustment =
      leadBand === "HIGH"
        ? 900
        : leadBand === "MEDIUM"
        ? 200
        : -600;

    const recommendation =
      leadBand === "HIGH"
        ? "High‑value lead — call immediately."
        : leadBand === "MEDIUM"
        ? "Warm lead — follow up within 24 hours."
        : "Low‑value lead — nurture or deprioritise.";

    return {
      ...l,
      conversion: conversionPercent,
      leadBand,
      leadAdjustment,
      recommendation,
    };
  });

  return <LeadIntelligenceBrainScreen data={data} />;
}
