import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function IntroScreen() {
  const router = useRouter();

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the logo
  const pulse = useRef(new Animated.Value(1)).current;

  // 🔥 Make sure the splash screen hides so the intro becomes visible
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100); // small delay ensures intro is visible

    return () => clearTimeout(timeout);
  }, []);

  // Fade-out effect
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 800,
      delay: 2600,
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(tabs)/home');
    });
  }, []);

  // Pulse effect
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

      {/* Top text */}
      <Text style={styles.topText}>Welcome to FlipPilot</Text>

      {/* Logo */}
      <Animated.Image
        source={require('../assets/images/logoPulse.png')}
        style={[styles.logo, { transform: [{ scale: pulse }] }]}
        resizeMode="contain"
      />

      {/* Bottom text */}
      <Text style={styles.bottomText}>Powered by Smart AI Tools</Text>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
  },

  topText: {
    position: 'absolute',
    top: '12%',
    fontSize: 22,
    fontWeight: '600',
    color: '#FFD700',   // GOLD
    letterSpacing: 0.5,
  },

  bottomText: {
    position: 'absolute',
    bottom: '10%',
    fontSize: 18,
    fontWeight: '400',
    color: '#FFD700',   // GOLD
    letterSpacing: 0.5,
  },

  logo: {
    width: 360,
    height: 360,
  },
});
