import { useLocalSearchParams, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

type ScrollMemory = {
  [key: string]: number;
};

const memory: ScrollMemory = {};

export function useTabMemory() {
  const scrollRef = useRef<any>(null);

  const params = useLocalSearchParams();
  const segments = useSegments();

  // Build a stable key for this screen
  const key =
    params?.id?.toString() ||
    segments.join("/") ||
    "default";

  // Restore scroll position on mount
  useEffect(() => {
    const saved = memory[key];

    if (saved !== undefined && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: saved,
          animated: false,
        });
      }, 10);
    }
  }, [key]);

  // Save scroll position
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    memory[key] = y;
  };

  return { scrollRef, onScroll };
}
