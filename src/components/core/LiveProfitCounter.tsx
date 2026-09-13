import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle, Text } from "react-native";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface LiveProfitCounterProps {
  totalProfit: number;
  theme: {
    accent: string;
    goldDeep: string;
    black: string;
  };
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function LiveProfitCounter({
  totalProfit,
  theme,
}: LiveProfitCounterProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }),
    ]).start();
  }, [totalProfit]);

  const glow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.accent,
          shadowColor: theme.goldDeep,
          shadowOpacity: glow,
        } as ViewStyle,
      ]}
    >
      <Text style={[styles.text, { color: theme.black }]}>
        £{totalProfit.toFixed(2)}
      </Text>
    </Animated.View>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 40,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    shadowRadius: 20,
    elevation: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: "900",
  },
});
