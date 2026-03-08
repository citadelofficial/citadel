import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

export function SplashScreen() {
  // Shield drop-in with spring overshoot
  const shieldY = useRef(new Animated.Value(-60)).current;
  const shieldScale = useRef(new Animated.Value(0.3)).current;
  const shieldOpacity = useRef(new Animated.Value(0)).current;

  // Title & tagline
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(14)).current;

  // Glow pulse
  const glowPulse = useRef(new Animated.Value(0)).current;

  // Dots bounce
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // === Phase 1: Shield drops in with spring ===
    const shieldEntrance = Animated.parallel([
      Animated.spring(shieldY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 8,
        bounciness: 18,
      }),
      Animated.spring(shieldScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
        bounciness: 14,
      }),
      Animated.timing(shieldOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    // === Phase 2: Title slides up ===
    const titleEntrance = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(titleY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 10,
      }),
    ]);

    // === Phase 3: Line expands ===
    const lineExpand = Animated.spring(lineWidth, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
    });

    // === Phase 4: Tagline slides up ===
    const taglineEntrance = Animated.parallel([
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(taglineY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 8,
      }),
    ]);

    // === Phase 5: Dots bounce in staggered ===
    const dotsEntrance = Animated.stagger(120, [
      Animated.spring(dot1, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 18 }),
      Animated.spring(dot2, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 18 }),
      Animated.spring(dot3, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 18 }),
    ]);

    // Glow breathing loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Run sequence
    Animated.sequence([
      shieldEntrance,
      Animated.delay(100),
      titleEntrance,
      lineExpand,
      Animated.delay(50),
      taglineEntrance,
      Animated.delay(150),
      dotsEntrance,
    ]).start();

    pulse.start();
    return () => pulse.stop();
  }, [shieldY, shieldScale, shieldOpacity, titleOpacity, titleY, lineWidth, taglineOpacity, taglineY, glowPulse, dot1, dot2, dot3]);

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.04],
  });

  // Dots animate scale from 0 to 1 with spring
  const dotScale = (val: Animated.Value) => val.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Breathing glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Shield icon - springs down from above */}
      <Animated.View
        style={[
          styles.iconWrap,
          {
            opacity: shieldOpacity,
            transform: [
              { translateY: shieldY },
              { scale: shieldScale },
            ],
          },
        ]}
      >
        <Ionicons name="shield-checkmark" size={88} color="white" />
      </Animated.View>

      {/* Title slides up */}
      <Animated.Text
        style={[
          styles.title,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
          },
        ]}
      >
        Citadel
      </Animated.Text>

      {/* Decorative line expands */}
      <Animated.View
        style={[
          styles.line,
          {
            transform: [{ scaleX: lineWidth }],
          },
        ]}
      />

      {/* Tagline slides up */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineY }],
          },
        ]}
      >
        THE FORTRESS FOR YOUR LEARNING
      </Animated.Text>

      {/* Dots pop in one by one */}
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              i === 1 && styles.dotActive,
              {
                transform: [{ scale: dotScale(dot) }],
                opacity: dot,
              },
            ]}
          />
        ))}
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
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'white',
  },
  iconWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 54,
    fontFamily: fonts.bold,
    color: 'white',
    letterSpacing: -1,
  },
  line: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginTop: 14,
    borderRadius: 1,
  },
  tagline: {
    marginTop: 18,
    fontSize: 13,
    color: 'rgba(255,255,255,0.74)',
    letterSpacing: 3,
    fontFamily: fonts.medium,
  },
  dots: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: 'white',
  },
});
