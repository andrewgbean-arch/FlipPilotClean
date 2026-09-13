import { Stack } from "expo-router";

export default function VehicleLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: "transparent",
        },
      }}
    />
  );
}
