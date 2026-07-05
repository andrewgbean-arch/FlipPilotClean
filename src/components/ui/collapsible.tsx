import * as Haptics from "expo-haptics";
import { PropsWithChildren, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import ThemedText from "../ThemedText";
import ThemedView from "../ThemedView";
import { useTheme } from "../../hooks/use-theme";


export function Collapsible({
  children,
  title,
  onOpen,
  scrollTo,
}: PropsWithChildren & {
  title: string;
  onOpen?: () => void;
  scrollTo?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();

  // Core animation values
  const rotation = useSharedValue(0);
  const glow = useSharedValue(0);
  const bg = useSharedValue(0);
  const height = useSharedValue(0);
  const tilt = useSharedValue(0);
  const drag = useSharedValue(0);

  // Particle system
  const particleX = useSharedValue(0);
  const particleY = useSharedValue(0);
  const particleOpacity = useSharedValue(0);

  const contentRef = useRef<View>(null);

  const toggle = (manual = true) => {
    const next = !isOpen;
    setIsOpen(next);

    if (next && onOpen) onOpen();
    if (next && scrollTo) scrollTo();

    if (manual) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    glow.value = withTiming(next ? 1 : 0, { duration: 300 });
    bg.value = withTiming(next ? 1 : 0, { duration: 300 });

    tilt.value = withTiming(8, { duration: 120 }, () => {
      tilt.value = withTiming(0, { duration: 120 });
    });

    if (contentRef.current) {
      contentRef.current.measure((x, y, w, h) => {
        height.value = withSpring(next ? h : 0, { damping: 18 });
      });
    }

    rotation.value = withTiming(180, { duration: 300 }, () => {
      rotation.value = withTiming(0, { duration: 300 });
    });
  };

  const onGesture = (event: any) => {
    drag.value = event.translationY;

    const speed = Math.abs(event.velocityY) / 300;
    const elastic = speed * 120;
    rotation.value = withTiming(elastic, { duration: 80 });

    particleX.value = withTiming(event.translationX / 10, { duration: 80 });
    particleY.value = withTiming(event.translationY / 10, { duration: 80 });

    particleOpacity.value = withTiming(1, { duration: 120 });

    if (drag.value > 40 && isOpen) {
      runOnJS(toggle)(false);
      drag.value = 0;
    }
  };

  const onGestureEnd = () => {
    drag.value = withDecay({ velocity: 0 });

    particleOpacity.value = withTiming(0, { duration: 300 });

    rotation.value = withTiming(0, { duration: 300 });
  };

  const reactorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: theme.accent,
    shadowOpacity: glow.value,
    shadowRadius: glow.value * 20,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      bg.value,
      [0, 1],
      ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)"]
    ),
    borderColor: theme.accent,
    borderWidth: bg.value,
  }));

  const heightStyle = useAnimatedStyle(() => ({
    height: height.value + drag.value,
    overflow: "hidden",
  }));

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${tilt.value}deg` },
      { rotateY: `${tilt.value / 2}deg` },
    ],
  }));

  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
    transform: [
      { translateX: particleX.value },
      { translateY: particleY.value },
    ],
  }));

  return (
    <ThemedView style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.heading,
          pressed && styles.pressedHeading,
        ]}
        onPress={() => toggle(true)}
      >
        <Animated.View style={[styles.button, glowStyle, tiltStyle]}>
          <Animated.View style={[styles.reactorOuter, reactorStyle]}>
            <View style={styles.reactorInner} />
          </Animated.View>
        </Animated.View>

        <ThemedText style={styles.titleText}>{title}</ThemedText>
      </Pressable>

      <PanGestureHandler onGestureEvent={onGesture} onEnded={onGestureEnd}>
        <Animated.View style={heightStyle}>
          <Animated.View
            style={[styles.content, bgStyle]}
            ref={contentRef}
            onLayout={() => {}}
          >
            <Animated.View style={[styles.particle, particleStyle]} />

            {children}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  pressedHeading: {
    opacity: 0.7,
  },
  button: {
    width: 16,
    height: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  reactorOuter: {
    width: 22,
    height: 22,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
  },
  reactorInner: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#00A8FF",
  },

  titleText: {
    fontSize: 15,
    fontWeight: "700",
  },
  content: {
    borderRadius: 10,
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },

  particle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});
