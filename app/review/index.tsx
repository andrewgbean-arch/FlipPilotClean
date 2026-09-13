import { View, Text, StyleSheet } from "react-native";

export default function ReviewScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FlipPilot Reviews</Text>
      <Text style={styles.subtitle}>Rate your experience</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    color: "#FFD700",
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: "#AAB4C3",
    fontSize: 16,
    marginTop: 10,
  },
});
