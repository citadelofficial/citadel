import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TutorialCoachMarkProps {
  visible: boolean;
  step: number;
  totalSteps: number;
  targetRect: TargetRect | null;
  title: string;
  description: string;
  buttonLabel: string;
  onNext: () => void;
  onSkip: () => void;
  position: 'above' | 'below';
}

const CUTOUT_PADDING = 8;
const CUTOUT_RADIUS = 16;
const TOOLTIP_WIDTH = SCREEN_WIDTH - 48;

export function TutorialCoachMark({
  visible,
  step,
  totalSteps,
  targetRect,
  title,
  description,
  buttonLabel,
  onNext,
  onSkip,
  position,
}: TutorialCoachMarkProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(position === 'below' ? -16 : 16)).current;
  const tooltipScale = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && targetRect) {
      fadeAnim.setValue(0);
      tooltipSlide.setValue(position === 'below' ? -16 : 16);
      tooltipScale.setValue(0.92);
      pulseAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(tooltipSlide, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }),
        Animated.spring(tooltipScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }),
      ]).start();

      // Pulsing glow loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible, step, targetRect, position]);

  if (!visible || !targetRect) return null;

  const cutout = {
    x: targetRect.x - CUTOUT_PADDING,
    y: targetRect.y - CUTOUT_PADDING,
    width: targetRect.width + CUTOUT_PADDING * 2,
    height: targetRect.height + CUTOUT_PADDING * 2,
  };

  // Tooltip positioning
  const tooltipLeft = Math.max(
    24,
    Math.min(
      cutout.x + cutout.width / 2 - TOOLTIP_WIDTH / 2,
      SCREEN_WIDTH - TOOLTIP_WIDTH - 24
    )
  );

  const tooltipTop =
    position === 'below'
      ? cutout.y + cutout.height + 16
      : cutout.y - 16; // Will use transform for above

  // Arrow position relative to tooltip
  const arrowLeft = Math.max(
    24,
    Math.min(
      cutout.x + cutout.width / 2 - tooltipLeft - 8,
      TOOLTIP_WIDTH - 40
    )
  );

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.9],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999, opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* Dark overlay — 4 rectangles around the cutout */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Top */}
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.overlayPart, { top: 0, left: 0, right: 0, height: cutout.y }]}
          onPress={onSkip}
        />
        {/* Bottom */}
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.overlayPart,
            {
              top: cutout.y + cutout.height,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
          onPress={onSkip}
        />
        {/* Left */}
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.overlayPart,
            {
              top: cutout.y,
              left: 0,
              width: cutout.x,
              height: cutout.height,
            },
          ]}
          onPress={onSkip}
        />
        {/* Right */}
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.overlayPart,
            {
              top: cutout.y,
              left: cutout.x + cutout.width,
              right: 0,
              height: cutout.height,
            },
          ]}
          onPress={onSkip}
        />
      </View>

      {/* Pulsing highlight border around target */}
      <Animated.View
        style={[
          styles.pulsingBorder,
          {
            top: cutout.y,
            left: cutout.x,
            width: cutout.width,
            height: cutout.height,
            borderRadius: CUTOUT_RADIUS,
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
        pointerEvents="none"
      />

      {/* Tooltip bubble */}
      <Animated.View
        style={[
          styles.tooltip,
          {
            left: tooltipLeft,
            width: TOOLTIP_WIDTH,
            ...(position === 'below'
              ? { top: tooltipTop }
              : { bottom: SCREEN_HEIGHT - cutout.y + 16 }),
            transform: [{ translateY: tooltipSlide }, { scale: tooltipScale }],
          },
        ]}
      >
        {/* Arrow pointing to target */}
        {position === 'below' && (
          <View
            style={[
              styles.arrowUp,
              { left: arrowLeft },
            ]}
          />
        )}

        {/* Step counter */}
        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {step} of {totalSteps}
            </Text>
          </View>
          <TouchableOpacity onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Text style={styles.tooltipTitle}>{title}</Text>
        <Text style={styles.tooltipDesc}>{description}</Text>

        {/* Step dots + Next button */}
        <View style={styles.bottomRow}>
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i + 1 === step && styles.dotActive,
                  i + 1 < step && styles.dotDone,
                ]}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.8}>
            <Text style={styles.nextBtnText}>{buttonLabel}</Text>
            <Ionicons
              name={step === totalSteps ? 'checkmark' : 'arrow-forward'}
              size={14}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* Arrow pointing up when tooltip is above */}
        {position === 'above' && (
          <View
            style={[
              styles.arrowDown,
              { left: arrowLeft },
            ]}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayPart: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  pulsingBorder: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F0E0D0',
  },
  arrowUp: {
    position: 'absolute',
    top: -8,
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#F0E0D0',
    transform: [{ rotate: '45deg' }],
  },
  arrowDown: {
    position: 'absolute',
    bottom: -8,
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#F0E0D0',
    transform: [{ rotate: '45deg' }],
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    backgroundColor: `${colors.maroon}12`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${colors.maroon}20`,
  },
  stepBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.maroon,
    letterSpacing: 0.3,
  },
  skipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
  },
  tooltipTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  tooltipDesc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: colors.maroon,
    width: 20,
  },
  dotDone: {
    backgroundColor: `${colors.maroon}60`,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.maroon,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: colors.maroon,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  nextBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: 'white',
  },
});
