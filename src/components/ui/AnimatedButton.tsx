import React, { useRef } from "react";
import { Animated, Pressable, ViewStyle, Text } from "react-native";

interface AnimatedButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export default function AnimatedButton({ children, onPress, style }: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  const defaultStyle: ViewStyle = {
    backgroundColor: "#1A1A1A",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFD700",
    marginBottom: 12,
    shadowColor: "#FFD700",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },

    // ⭐ FIX: respect parent grid width
    width: "100%",
  };

  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress}>
      <Animated.View style={[defaultStyle, style, { transform: [{ scale }] }]}>
        {typeof children === "string" ? (
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Animated.View>
    </Pressable>
  );
}
