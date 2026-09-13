import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { useVehicleHistory } from "../../../src/features/vehicles/context/VehicleHistoryContext";
import LoadingVehicle from "../../../src/components/core/LoadingVehicle";

export default function MarketingHub() {
  const { id } = useLocalSearchParams();
  const { vehicles } = useVehicleHistory();

  const vehicle = vehicles.find((v: any) => v.id === id);

  if (!vehicle) return <LoadingVehicle />;

  return (
    <ScrollView style={{ padding: 16 }}>
      {/* Marketing modules go here */}
    </ScrollView>
  );
}
