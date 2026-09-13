import * as Haptics from "expo-haptics";

export function triggerHaptic(style: "light" | "medium" | "heavy" = "medium") {
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };

  Haptics.impactAsync(map[style]);
}
