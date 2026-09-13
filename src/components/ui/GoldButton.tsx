import React, { useRef, useEffect } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
  View,
} from "react-native";
import { useTheme } from "../../styles/ThemeContext";


interface GoldButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function GoldButton({ children, onPress, style }: GoldButtonProps) {
  const theme = useTheme();

  // shimmer animation value
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const shine = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          borderColor: theme.goldDeep,
          shadowColor: theme.goldDeep,
          shadowOpacity: shine,
        },
        style,
      ]}
    >
      {/* SAFE JS GRADIENT */}
      <View style={styles.safeGradient}>
        {/* shimmer overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmerOverlay,
            {
              opacity: shimmer.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.35],
              }),
            },
          ]}
        />

        <Pressable style={styles.button} onPress={onPress}>
          <Text style={[styles.text, { color: theme.black }]}>
            {children}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 3,
    borderRadius: 16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    overflow: "hidden",
  },

  safeGradient: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E6C200", // base gold
    shadowColor: "#FFD700",
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  shimmerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    borderRadius: 14,
  },

  button: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  text: {
    fontSize: 20,
    fontWeight: "900",
    flexWrap: "nowrap",
    textAlign: "center",
  },
});
