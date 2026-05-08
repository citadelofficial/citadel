import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

interface Props {
  step: number;
  totalSteps: number;
  title: string;
  body: string;
  onDismiss: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  dismissLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
}

const STEP_ICONS: Record<number, keyof typeof Ionicons.glyphMap> = {
  1: 'add-circle',
  2: 'book',
  3: 'folder-open',
  4: 'document-text',
  5: 'camera',
  6: 'people',
  7: 'checkmark-done',
};

export function InlineTutorialCard({
  step,
  totalSteps,
  title,
  body,
  onDismiss,
  onPrevious,
  onNext,
  dismissLabel = 'Skip',
  previousLabel = 'Back',
  nextLabel = 'Next',
}: Props) {
  const slideAnim = useRef(new Animated.Value(16)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(16);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const icon = STEP_ICONS[step] || 'compass';
  const progressPercent = `${Math.max(0, Math.min(100, (step / totalSteps) * 100))}%` as `${number}%`;

  return (
    <Animated.View style={[
      styles.card,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
    ]}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.maroon} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.stepLabel}>Guided setup • Step {step} of {totalSteps}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
        >
          <Ionicons name="close" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.body}>{body}</Text>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressPercent }]} />
        </View>
        <Text style={styles.progressText}>{Math.round((step / totalSteps) * 100)}%</Text>
      </View>

      <View style={styles.footer}>
        {onPrevious ? (
          <TouchableOpacity
            onPress={onPrevious}
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={previousLabel}
          >
            <Ionicons name="chevron-back" size={13} color={colors.textSecondary} />
            <Text style={styles.secondaryBtnText}>{previousLabel}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.skipBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
          >
            <Text style={styles.skipBtnText}>{dismissLabel}</Text>
          </TouchableOpacity>
        )}

        {onNext && (
          <TouchableOpacity
            onPress={onNext}
            style={styles.primaryBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
          >
            <Text style={styles.primaryBtnText}>{nextLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.warmBorder,
    overflow: 'hidden',
    padding: 16,
    shadowColor: colors.maroon,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warmBorder,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.maroon,
  },
  progressText: {
    width: 36,
    textAlign: 'right',
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  skipBtn: {
    height: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.maroon,
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: 'white',
  },
});
