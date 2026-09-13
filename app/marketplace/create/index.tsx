import { View, Text, Pressable } from "react-native";
import { useTheme } from "../../../src/styles/ThemeContext";
import { router } from "expo-router";

export default function CreateListingIndex() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: "900", color: theme.text, marginBottom: 20 }}>
        Create Listing
      </Text>

      <Pressable
        onPress={() => router.push("/marketplace/create/new")}
        style={{
          backgroundColor: theme.accent,
          padding: 16,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: theme.background, fontWeight: "700", fontSize: 18 }}>
          Start New Listing
        </Text>
      </Pressable>
    </View>
  );
}


