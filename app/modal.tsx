import { router } from "expo-router";
import { StyleSheet, View, Pressable, Animated, PanResponder, Text } from "react-native";
import { useEffect, useRef } from "react";
import { BlurView } from "expo-blur";

import { useTheme } from "@/styles/ThemeContext";

export default function ModalScreen() {
  const theme = useTheme();

  const translateY = useRef(new Animated.Value(60)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 60,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.back();
    });
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
    onPanResponderMove: (_, g) => translateY.setValue(g.dy),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) closeModal();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  });

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
      </Animated.View>

      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateY }] }}>
        <BlurView intensity={50} tint="default" style={styles.card}>
          <Text style={{ marginBottom: 12, fontSize: 20, fontWeight: "700", color: theme.text }}>
            Some text
          </Text>

          <Pressable
            onPress={() => {
              closeModal();
              router.push("/");
            }}
            style={styles.button}
          >
            <Text style={{ color: "#00A8FF", fontWeight: "600" }}>
              Go to home screen
            </Text>
          </Pressable>

          <Pressable onPress={closeModal} style={[styles.button, { marginTop: 10 }]}>
            <Text style={{ color: "#00A8FF", fontWeight: "600" }}>
              Close
            </Text>
          </Pressable>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },
  button: {
    paddingVertical: 12,
  },
});
