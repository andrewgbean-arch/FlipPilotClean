import React from "react";
import { StyleSheet, View, Text } from "react-native";

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
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          borderWidth: 3,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.accent }]}>
        Achievements
      </Text>

      {achievements.map((a) => (
        <Text key={a} style={[styles.text, { color: theme.text }]}>
          • {a}
        </Text>
      ))}
    </View>
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
    fontSize: 15,
    marginBottom: 4,
    fontWeight: "600",
  },
});
