import React from "react";
import { StyleSheet } from "react-native";
import ThemedView from "./ThemedView";
import ThemedText from "./ThemedText";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface AchievementsCardProps {
  theme: any;
  achievements: string[];
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function AchievementsCard({
  theme,
  achievements,
}: AchievementsCardProps) {
  if (!achievements || achievements.length === 0) return null;

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          borderWidth: 3,
        },
      ]}
    >
      <ThemedText style={[styles.title, { color: theme.accent }]}>
        Achievements
      </ThemedText>

      {achievements.map((a) => (
        <ThemedText key={a} style={styles.text}>
          • {a}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    width: "92%",
    alignSelf: "center",
    padding: 18,
    borderRadius: 20,
    marginTop: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  text: {
    color: "white",
    fontSize: 15,
    marginBottom: 4,
  },
});
