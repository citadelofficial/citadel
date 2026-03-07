import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0.5)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    intro.start();
    pulse.start();

    return () => pulse.stop();
  }, [glowPulse, logoOpacity, logoScale]);

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.05],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={88} color="white" />
        </View>
        <Text style={styles.title}>Citadel</Text>
        <View style={styles.line} />
        <Text style={styles.tagline}>THE FORTRESS FOR YOUR LEARNING</Text>
      </Animated.View>

      <View style={styles.dots}>
        <Animated.View style={[styles.dot, styles.dotActive, { opacity: logoOpacity }]} />
        <Animated.View style={[styles.dot, { opacity: glowOpacity }]} />
        <Animated.View style={[styles.dot, { opacity: logoOpacity }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'white',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  iconWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 1,
  },
  line: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 12,
  },
  tagline: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(255,255,255,0.74)',
    letterSpacing: 2,
    fontWeight: '300',
  },
  dots: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: 'white',
  },
});
