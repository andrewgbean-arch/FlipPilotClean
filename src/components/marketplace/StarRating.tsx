import React from "react";
import { View, Text, Pressable } from "react-native";
import { Star } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";

/**
 * Stars for a rating that exists. A seller with no reviews gets words, not a
 * row of empty stars and not a flattering default — "No reviews yet" is the
 * honest thing to show, and a buyer can read it for what it is.
 */
export default function StarRating({
  stars,
  count,
  size = 18,
  onPick,
}: {
  stars: number | null;
  count?: number;
  size?: number;
  /** Provided when the stars are being chosen rather than displayed. */
  onPick?: (stars: number) => void;
}) {
  const theme = useTheme();

  if (stars == null && !onPick) {
    return (
      <Text style={{ color: theme.muted, fontSize: 14 }}>
        No reviews yet
      </Text>
    );
  }

  const filledTo = stars ?? 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= Math.round(filledTo);
          const star = (
            <Star
              size={size}
              weight={filled ? "fill" : "regular"}
              color={filled ? theme.gold : theme.muted}
            />
          );

          return onPick ? (
            <Pressable
              key={n}
              onPress={() => onPick(n)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${n} ${n === 1 ? "star" : "stars"}`}
            >
              {star}
            </Pressable>
          ) : (
            <View key={n}>{star}</View>
          );
        })}
      </View>

      {stars != null && (
        <Text style={{ color: theme.text, fontSize: 14 }}>
          {stars.toFixed(1)}
          {count != null ? ` · ${count} ${count === 1 ? "review" : "reviews"}` : ""}
        </Text>
      )}
    </View>
  );
}
