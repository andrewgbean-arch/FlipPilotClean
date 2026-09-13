import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import type { Theme } from "../../styles/theme";



interface Props {
  onPress: () => void;
  theme: Theme;
}

export default function AIBubble({ onPress, theme }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        style={[styles.bubble, { backgroundColor: theme.gold }]}
      >
        <View style={styles.innerDot} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
 container: {
  position: "absolute",
  bottom: 140,       // ⭐ finally above your floating tab
  right: 20,
  zIndex: 999999,
  elevation: 999999,
},

  bubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  innerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "white",
  },
});
