import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { router } from "expo-router";

const NAVY = "#0A1128";
const LOGO = require("../assets/images/logo5.png");

export default function IntroScreen() {
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // The logo is a large image and, in dev, is fetched over the network
  // from the Metro server rather than bundled — don't start the reveal
  // (or the auto-navigate timer) until it has actually finished loading,
  // otherwise the animation can complete and navigate away before the
  // image ever appears on a real device.
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    // Safety net: never strand the user on this screen if the image
    // somehow never fires onLoad/onError.
    const fallback = setTimeout(() => setImageReady(true), 4000);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!imageReady) return;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(spin, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(650),
    ]).start(() => {
      router.replace("/home");
    });
  }, [imageReady]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["-540deg", "0deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={LOGO}
        resizeMode="cover"
        onLoadEnd={() => setImageReady(true)}
        style={[
          styles.logo,
          {
            opacity,
            transform: [{ rotate }, { scale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
});
