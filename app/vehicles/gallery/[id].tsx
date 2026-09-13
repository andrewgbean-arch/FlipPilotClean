import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";
import VehicleGalleryScreen from "@/features/vehicles/ui/VehicleGalleryScreen";

export default function GalleryRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const theme = useTheme();
  const { vehicles, updateVehicle } = useVehicleHistory();

  const vehicleId = Array.isArray(id) ? id[0] : id;
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicle) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: theme.white }}>Vehicle not found</Text>
      </View>
    );
  }

  return <VehicleGalleryScreen vehicle={vehicle} updateVehicle={updateVehicle} theme={theme} />;
}
