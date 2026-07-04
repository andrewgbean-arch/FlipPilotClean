import { router } from "expo-router";
import { StyleSheet, View, Pressable, Animated, PanResponder } from "react-native";
import { useEffect, useRef } from "react";
import { BlurView } from "expo-blur";
import { ThemedText } from "../components/themed-text";

import { useTheme } from "../src/context/ThemeContext";

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
      router.back(); // correct Expo Router 2.x dismiss
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
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateY }] }}
      >
        <BlurView intensity={50} tint="default" style={styles.card}>
          <ThemedText type="title" style={styles.title}>
            This is a modal
          </ThemedText>

          <Pressable
            onPress={() => {
              closeModal();
              router.push("/");
            }}
            style={styles.button}
          >
            <ThemedText type="link">Go to home screen</ThemedText>
          </Pressable>

          <Pressable onPress={closeModal} style={[styles.button, { marginTop: 10 }]}>
            <ThemedText type="link">Close</ThemedText>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },
  title: {
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
  },
});
