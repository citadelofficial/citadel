import React, { useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors } from '../theme';

type TabId = 'home' | 'scan' | 'people' | 'files';

interface Props {
  active: TabId;
  onHome?: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onFiles?: () => void;
}

const items: { id: TabId; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'scan', icon: 'camera', label: 'Scan' },
  { id: 'people', icon: 'people', label: 'People' },
  { id: 'files', icon: 'folder', label: 'Files' },
];

function BouncyTab({
  item,
  isActive,
  onPress,
}: {
  item: (typeof items)[number];
  isActive: boolean;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0.5, duration: 80, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      Animated.timing(glowOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive, wiggle, glowOpacity]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.82,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 16,
    }).start();
  }, [scale]);

  const rotate = wiggle.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.item,
          { transform: [{ scale }, { rotate }] },
        ]}
      >
        {/* Active glow pill behind icon */}
        <Animated.View
          style={[
            styles.activePill,
            { opacity: glowOpacity },
          ]}
        />
        <Ionicons
          name={item.icon}
          size={22}
          color={isActive ? colors.maroon : 'rgba(255,255,255,0.7)'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function BottomNav({ active, onHome, onScan, onFriends, onFiles }: Props) {
  const insets = useSafeAreaInsets();
  const barScale = useRef(new Animated.Value(0.9)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(barScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 14,
      }),
      Animated.timing(barOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [barScale, barOpacity]);

  const actions: Record<TabId, (() => void) | undefined> = {
    home: onHome,
    scan: onScan,
    people: onFriends,
    files: onFiles,
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
      <Animated.View
        style={[
          styles.barOuter,
          {
            opacity: barOpacity,
            transform: [{ scale: barScale }],
          },
        ]}
      >
        {/* Glass layers */}
        <BlurView intensity={40} tint="dark" style={styles.blurLayer} />
        <View style={styles.glassOverlay} />
        <View style={styles.innerGlow} />

        {/* Tabs */}
        <View style={styles.tabRow}>
          {items.map((item) => (
            <BouncyTab
              key={item.id}
              item={item}
              isActive={active === item.id}
              onPress={actions[item.id]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  barOuter: {
    borderRadius: 32,
    overflow: 'hidden',
    // Outer shadow — soft maroon glow
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61, 12, 17, 0.55)',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  item: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
