import React from "react";
import { View, Text } from "react-native";

interface EnhancementData {
  brightnessBoost?: boolean;
  sharpened?: boolean;
  backgroundCleaned?: boolean;
  noiseReduced?: boolean;
  autoCropped?: boolean;
  bestPhotoScore?: number;
}

interface Props {
  data?: EnhancementData;
  theme: {
    goldDeep: string;
    muted: string;
  };
}

export default function EnhancementBadges({ data, theme }: Props) {
  if (!data) return null;

  return (
    <View style={{ marginTop: 6 }}>
      {data.brightnessBoost && (
        <Text style={{ color: theme.goldDeep, fontSize: 12 }}>Brightness Boost</Text>
      )}
      {data.sharpened && (
        <Text style={{ color: theme.goldDeep, fontSize: 12 }}>Sharpened</Text>
      )}
      {data.backgroundCleaned && (
        <Text style={{ color: theme.goldDeep, fontSize: 12 }}>Background Cleaned</Text>
      )}
      {data.noiseReduced && (
        <Text style={{ color: theme.goldDeep, fontSize: 12 }}>Noise Reduced</Text>
      )}
      {data.autoCropped && (
        <Text style={{ color: theme.goldDeep, fontSize: 12 }}>Auto‑Cropped</Text>
      )}

      <Text style={{ color: theme.muted, fontSize: 12 }}>
        Best Photo Score: {data.bestPhotoScore}/100
      </Text>
    </View>
  );
}
