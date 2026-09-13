import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

interface AnimatedHeroHeaderProps {
  title: string;
}

export default function AnimatedHeroHeader({ title }: AnimatedHeroHeaderProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: slide }],
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
      }}
    >
      <Text
        style={{
          fontSize: 32,
          fontWeight: "900",
        }}
      >
        {title}
      </Text>
    </Animated.View>
  );
}

