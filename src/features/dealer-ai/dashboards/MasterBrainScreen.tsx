// src/features/dealer-ai/MasterBrainScreen.tsx
import React, { useState } from "react";
import { View } from "react-native";
import BrainModeSwitcher from "../dashboards/BrainModeSwitcher";

import { flipPilotMasterBrain, FlipPilotMode } from "../DealerIntelligenceAPI";

import DealerDashboard from "../dashboards/DealerDashboard";
import GroupDashboard from "../dashboards/GroupDashboard";
import OEMDashboard from "../dashboards/OEMDashboard";
import GlobalDashboard from "../dashboards/GlobalDashboard";
import PlanetDashboard from "../dashboards/PlanetDashboard";

type MasterBrainScreenProps = {
  data: any;
};

export default function MasterBrainScreen({ data }: MasterBrainScreenProps) {
  const [mode, setMode] = useState<FlipPilotMode>("dealer");
  const brain = flipPilotMasterBrain(mode, data);

  return (
    <View style={{ padding: 20 }}>
      <BrainModeSwitcher mode={mode} onChange={setMode} />

      {mode === "dealer" && <DealerDashboard brain={brain} />}
      {mode === "group" && <GroupDashboard brain={brain} />}
      {mode === "oem" && <OEMDashboard brain={brain} />}
      {mode === "global" && <GlobalDashboard brain={brain} />}
      {mode === "planet" && <PlanetDashboard brain={brain} />}
    </View>
  );
}
