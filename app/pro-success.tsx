import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export default function ProSuccess() {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    setTimeout(() => router.replace("/"), 2000);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.text, { transform: [{ scale }] }]}>
        ⭐ YOU’RE PRO! ⭐
      </Animated.Text>
      <Text style={styles.sub}>Welcome to the elite flipping tier</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFD700",
  },
  sub: {
    marginTop: 10,
    color: "#AFC6FF",
    fontSize: 16,
  },
});
