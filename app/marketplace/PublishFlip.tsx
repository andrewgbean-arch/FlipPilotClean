import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

/**
 * This screen used to be its own car-shaped listing form: it asked every seller
 * for a mileage, whatever they were selling, and had no category or photos.
 * Selling now goes through one flow that asks what the category actually needs,
 * so this route just hands over to it with Motors already chosen.
 */
export default function PublishFlip() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marketplace/create/new?category=motors");
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1128", justifyContent: "center" }}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );
}
