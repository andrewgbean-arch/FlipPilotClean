import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { ChatCircleDots } from "phosphor-react-native";

/**
 * A red message icon that pulses, to say "something new is waiting". Opacity
 * only, on the native driver, so it costs the JavaScript thread nothing.
 */
export default function FlashingMessageIcon({ size = 24, color }: { size?: number; color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }} accessibilityLabel="New message">
      <ChatCircleDots size={size} color={color} weight="fill" />
    </Animated.View>
  );
}
