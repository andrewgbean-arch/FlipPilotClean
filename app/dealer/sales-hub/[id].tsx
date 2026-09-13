import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { useVehicleHistory } from "../../../src/features/vehicles/context/VehicleHistoryContext";
import LoadingVehicle from "../../../src/components/core/LoadingVehicle";

export default function SalesHub() {
  const { id } = useLocalSearchParams();
  const { vehicles } = useVehicleHistory();

  const vehicle = vehicles.find((v: any) => v.id === id);

  if (!vehicle) return <LoadingVehicle />;

  return (
    <ScrollView style={{ padding: 16 }}>
      {/* Sales modules go here */}
    </ScrollView>
  );
}
