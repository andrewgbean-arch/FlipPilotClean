import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { triggerHaptic } from "@/components/ui/haptics";
import { useRouter } from "expo-router";

// ⭐ Types for props
type DealerQuickToolsProps = {
  theme: {
    accent: string;
    background: string;
    card: string;
    text: string;
    secondary: string;
  };
};

export default function DealerQuickTools({ theme }: DealerQuickToolsProps) {
  const router = useRouter();

  const tools = [
    "Add Vehicle",
    "Scan Plate",
    "Refresh MOT",
    "View Stock",
    "View Sales",
    "Dealer Analytics",
    "Dealer Intelligence",
    "Dealer Risk Hub", // ⭐ NEW — Dealer Mode V6
    "Dealer Sales Hub",

  ];

  const handlePress = (tool: string) => {
    triggerHaptic();

    switch (tool) {
      case "Dealer Intelligence":
        router.push("/dealer-intelligence");
        break;

      case "Dealer Risk Hub":
        router.push("/dealer-risk");
        break;

      case "Dealer Analytics":
        router.push("/analytics");
        break;

      case "View Stock":
        router.push("/listings");
        break;

      case "View Sales":
        router.push("/sales");
        break;

      case "Add Vehicle":
        router.push("/add-vehicle");
        break;

      case "Scan Plate":
        router.push("/ai-camera");
        break;

      case "Refresh MOT":
        router.push("/mot-alerts");
        break;
        case "Dealer Sales Hub":
       router.push("/dealer-sales");
       break;


      default:
        break;
    }
  };

  return (
    <View
      style={{
        marginTop: 20,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {tools.map((t) => (
        <TouchableOpacity
          key={t}
          onPress={() => handlePress(t)}
          style={{
            width: "48%",
            padding: 16,
            borderRadius: 12,
            backgroundColor: theme.accent,
          }}
        >
          <Text
            style={{
              color: theme.background,
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
