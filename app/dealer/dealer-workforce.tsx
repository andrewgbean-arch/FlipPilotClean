import React from "react";
import { DealerWorkforceBrainScreen } from "../../src/features/dealer-ai/screens/DealerWorkforceBrainScreen";

export default function DealerWorkforce() {
  const staff = [
    {
      name: "Sarah Mitchell",
      role: "Sales Executive",
      performance: 8.4,
      productivity: 7.9,
      efficiency: 7.2,
      leadConversion: 32,
      salesConversion: 18,
      riskContribution: 2.1,
      profitContribution: 54000,
      workload: 7.1,
    },
    {
      name: "James Carter",
      role: "Finance Manager",
      performance: 7.1,
      productivity: 6.8,
      efficiency: 6.4,
      leadConversion: 22,
      salesConversion: 14,
      riskContribution: 3.8,
      profitContribution: 41000,
      workload: 6.2,
    },
    {
      name: "Emily Davis",
      role: "CRM Specialist",
      performance: 6.2,
      productivity: 5.9,
      efficiency: 5.4,
      leadConversion: 18,
      salesConversion: 9,
      riskContribution: 4.9,
      profitContribution: 28000,
      workload: 5.1,
    },
  ];

  const data = staff.map(s => {
    const score =
      s.performance * 0.3 +
      s.productivity * 0.2 +
      s.efficiency * 0.2 +
      (s.leadConversion / 10) * 0.1 +
      (s.salesConversion / 10) * 0.1 -
      s.riskContribution * 0.1;

    const workforceBand =
      score > 7 ? "HIGH" : score > 4.5 ? "MEDIUM" : "LOW";

    const workforceAdjustment =
      workforceBand === "HIGH"
        ? 5000
        : workforceBand === "MEDIUM"
        ? 1500
        : -3000;

    const recommendation =
      workforceBand === "HIGH"
        ? "High‑value staff — increase responsibility and reward."
        : workforceBand === "MEDIUM"
        ? "Moderate‑value staff — provide training and support."
        : "Low‑value staff — restructure workload or replace.";

    return {
      ...s,
      workforceBand,
      workforceAdjustment,
      recommendation,
    };
  });

  return <DealerWorkforceBrainScreen data={data} />;
}
