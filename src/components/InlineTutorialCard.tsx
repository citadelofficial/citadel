import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
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

const STEP_ICONS: Record<number, { name: string; color: string; bg: string }> = {
  1: { name: 'add-circle', color: '#2563eb', bg: '#DBEAFE' },
  2: { name: 'book', color: colors.maroon, bg: '#FDE8E0' },
  3: { name: 'folder-open', color: '#d97706', bg: '#FEF3C7' },
  4: { name: 'document-text', color: '#7c3aed', bg: '#EDE9FE' },
  5: { name: 'camera', color: '#059669', bg: '#D1FAE5' },
  6: { name: 'people', color: '#db2777', bg: '#FCE7F3' },
  7: { name: 'checkmark-done', color: '#059669', bg: '#D1FAE5' },
};

export function InlineTutorialCard({
  step,
  totalSteps,
  title,
  body,
  onDismiss,
  onPrevious,
  onNext,
  dismissLabel = 'Skip Tutorial',
  previousLabel = 'Back',
  nextLabel = 'Next',
}: Props) {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    slideAnim.setValue(20);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();
  }, [step]);

  // Gentle pulse on the Next button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const stepInfo = STEP_ICONS[step] || STEP_ICONS[1];
  const progress = step / totalSteps;

  return (
    <Animated.View style={[
      styles.card,
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      },
    ]}>
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: stepInfo.color }]} />

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: stepInfo.bg }]}>
          <Ionicons name={stepInfo.name as any} size={20} color={stepInfo.color} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBadge}>
              <Ionicons name="compass" size={10} color={colors.maroon} />
              <Text style={styles.eyebrow}>Guided Setup</Text>
            </View>
            <Text style={styles.stepCounter}>
              {step}/{totalSteps}
            </Text>
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={8} style={styles.dismissButton}>
          <Ionicons name="close" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <Text style={styles.body}>{body}</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: stepInfo.color }]} />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {onPrevious ? (
          <TouchableOpacity onPress={onPrevious} style={styles.secondaryButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
            <Text style={styles.secondaryButtonText}>{previousLabel}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onDismiss} style={styles.skipButton} activeOpacity={0.7}>
            <Text style={styles.skipButtonText}>{dismissLabel}</Text>
          </TouchableOpacity>
        )}
        {onNext && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              onPress={onNext}
              style={[styles.primaryButton, { backgroundColor: stepInfo.color }]}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>{nextLabel}</Text>
              <Ionicons name="arrow-forward" size={14} color="white" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 22,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#F0E0D0',
    overflow: 'hidden',
    shadowColor: colors.maroon,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.maroon,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stepCounter: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  title: {
    marginTop: 3,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  dismissButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: 10,
    marginHorizontal: 18,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#F0E0D0',
    marginTop: 14,
    marginHorizontal: 18,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F5F0EB',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  skipButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: 'white',
  },
});
