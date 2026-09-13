import { ActivityIndicator, View, Text } from "react-native";

export default function LoadingVehicle() {
  return (
    <View style={{ padding: 20 }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 10 }}>Loading vehicle…</Text>
    </View>
  );
}
