import { useTheme } from "../../context/ThemeContext";

import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();

  // Fallbacks using your theme system
  const secondary = theme.background;
  const muted = theme.text + "99"; // soft muted text

  // Animated values for each tab
  const scales = useRef(
    state.routes.map((_, i) => new Animated.Value(state.index === i ? 1 : 0.9))
  ).current;

  // Animate when tab changes
  useEffect(() => {
    scales.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: state.index === i ? 1 : 0.9,
        useNativeDriver: true,
        friction: 6,
      }).start();
    });
  }, [state.index]);

  return (
    <View
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: secondary,
        borderRadius: 16,
        flexDirection: "row",
        paddingVertical: 10,

        // Simple shadow replacement
        shadowColor: theme.accent,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];

        const onPress = () => {
          Haptics.selectionAsync();
          navigation.navigate(route.name);
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={{ flex: 1 }}>
            <Animated.View
              style={{
                transform: [{ scale: scales[index] }],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* ICON */}
              {options.tabBarIcon &&
                options.tabBarIcon({
                  focused,
                  color: focused ? theme.accent : muted,
                  size: 26,
                })}

              {/* LABEL */}
              <Text
                style={{
                  marginTop: 4,
                  color: focused ? theme.accent : muted,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {typeof options.tabBarLabel === "function"
                  ? options.tabBarLabel({
                      focused,
                      color: focused ? theme.accent : muted,
                      position: "below-icon",
                      children: "",
                    })
                  : options.tabBarLabel ?? route.name}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}
