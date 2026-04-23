import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  userName?: string;
}

/* ─── Confetti Particle ─── */
function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const fall = useRef(new Animated.Value(-20)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fall, {
          toValue: SCREEN_HEIGHT + 40,
          duration: 3000 + Math.random() * 2000,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(sway, { toValue: 30, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(sway, { toValue: -30, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.timing(rotate, { toValue: 1, duration: 1200 + Math.random() * 800, useNativeDriver: true })
        ),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const size = 8 + Math.random() * 8;
  const isCircle = Math.random() > 0.5;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: isCircle ? size : size * 0.5,
        borderRadius: isCircle ? size / 2 : 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY: fall }, { translateX: sway }, { rotate: spin }],
      }}
    />
  );
}

/* ─── Floating Glow Orb ─── */
function FloatingOrb({ color, size, x, y, delay }: { color: string; size: number; x: number; y: number; delay: number }) {
  const float = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 1000, delay, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 3000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 3000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: fadeIn,
        transform: [{ translateY }],
      }}
    />
  );
}

/* ─── Pulsing Icon Badge ─── */
function PulsingIcon({ icon, color, bgColor, size = 80 }: { icon: string; color: string; bgColor: string; size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.3, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          width: size + 30,
          height: size + 30,
          borderRadius: (size + 30) / 2,
          backgroundColor: bgColor,
          opacity: glow,
          position: 'absolute',
        }}
      />
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pulse }],
        }}
      >
        <Ionicons name={icon as any} size={size * 0.45} color={color} />
      </Animated.View>
    </View>
  );
}

/* ─── Interactive Tap Card ─── */
function TapToRevealCard({ emoji, label, revealText, accentColor }: { emoji: string; label: string; revealText: string; accentColor: string }) {
  const [revealed, setRevealed] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const handleTap = () => {
    if (revealed) return;
    setRevealed(true);
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.spring(bounceAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
    ]).start();
    Animated.timing(flipAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const bgOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] });

  return (
    <TouchableOpacity onPress={handleTap} activeOpacity={0.85}>
      <Animated.View
        style={[
          styles.tapCard,
          {
            borderColor: revealed ? accentColor : 'rgba(255,255,255,0.2)',
            transform: [{ scale: bounceAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: accentColor, opacity: bgOpacity, borderRadius: 16 },
          ]}
        />
        <Text style={styles.tapCardEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.tapCardLabel}>{label}</Text>
          {revealed ? (
            <Text style={styles.tapCardReveal}>{revealText}</Text>
          ) : (
            <Text style={[styles.tapCardHint, { color: accentColor }]}>Tap to discover →</Text>
          )}
        </View>
        {revealed && (
          <Ionicons name="checkmark-circle" size={22} color={accentColor} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ─── Mini Feature Demo Badge ─── */
function FeatureBadge({ icon, label, color }: { icon: string; label: string; color: string }) {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 14 }).start();
  }, []);

  return (
    <Animated.View style={[styles.featureBadge, { transform: [{ scale: pop }] }]}>
      <View style={[styles.featureBadgeIcon, { backgroundColor: `${color}25` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.featureBadgeLabel}>{label}</Text>
    </Animated.View>
  );
}

/* ─── Page Definitions ─── */
const CONFETTI_COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#A855F7', '#2563EB', '#059669', '#F97316', '#EC4899'];

const PAGES = [
  {
    id: 'welcome',
    gradient: ['#1a0a2e', '#3D0C11'],
    title: 'Welcome to Citadel',
    subtitle: 'Your study command center',
    hasConfetti: true,
  },
  {
    id: 'home',
    gradient: ['#0f172a', '#1e3a5f'],
    accentColor: '#3b82f6',
    icon: 'home',
    title: 'Your Home Base',
    subtitle: 'Everything starts here',
    description: 'See all your classes at a glance. Tap into any class to view notes, assignments, and shared materials from classmates.',
    tips: [
      { emoji: '📚', label: 'Class Cards', reveal: 'Each card shows your class, block, and number of classmates sharing notes.' },
      { emoji: '⚡', label: 'Quick Actions', reveal: 'Long-press any class to quickly delete it or share its code.' },
      { emoji: '🔗', label: 'Join Classes', reveal: 'Tap "Create / Join" to start a new class or enter a friend\'s code.' },
    ],
  },
  {
    id: 'scan',
    gradient: ['#052e16', '#14532d'],
    accentColor: '#22c55e',
    icon: 'camera',
    title: 'Smart Capture',
    subtitle: 'Scan anything, instantly',
    description: 'Point your camera at notes, whiteboards, or worksheets. Citadel captures and organizes them for you automatically.',
    tips: [
      { emoji: '📸', label: 'Camera Scan', reveal: 'Aim at any page — the app detects edges and enhances contrast automatically.' },
      { emoji: '📂', label: 'Auto-Organize', reveal: 'Choose which class to save to before scanning, and it\'s filed away instantly.' },
      { emoji: '🗂️', label: 'From Gallery', reveal: 'Already have a photo? Upload directly from your camera roll.' },
    ],
  },
  {
    id: 'friends',
    gradient: ['#2e1065', '#4c1d95'],
    accentColor: '#a855f7',
    icon: 'people',
    title: 'Friends & Social',
    subtitle: 'Study better together',
    description: 'Connect with classmates, share notes, and build your study network. Learning is more fun with friends!',
    tips: [
      { emoji: '👋', label: 'Add Friends', reveal: 'Search by username or discover classmates from your school.' },
      { emoji: '💬', label: 'Chat', reveal: 'Message friends directly to coordinate study sessions.' },
      { emoji: '🔍', label: 'Discover', reveal: 'Browse the Discover tab to find students at your school!' },
    ],
  },
  {
    id: 'files',
    gradient: ['#431407', '#78350f'],
    accentColor: '#f59e0b',
    icon: 'folder-open',
    title: 'Files & Notes',
    subtitle: 'Your digital backpack',
    description: 'Every scan, every note, every document — organized by class. Search, rename, and share anything from one place.',
    tips: [
      { emoji: '📁', label: 'Organized', reveal: 'Files are automatically grouped by the class you assigned them to.' },
      { emoji: '✏️', label: 'Rename & Edit', reveal: 'Tap any file to rename, move between classes, or share with friends.' },
      { emoji: '🔎', label: 'Quick Find', reveal: 'Use the search bar to find any note across all your classes.' },
    ],
  },
  {
    id: 'ready',
    gradient: ['#3D0C11', '#1a0a2e'],
    title: "You're all set!",
    subtitle: 'Time to conquer your classes',
    hasConfetti: true,
  },
];

const TOTAL_PAGES = PAGES.length;

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export function TutorialModal({ visible, onClose, userName }: Props) {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setCurrentPage(0);
      progressAnim.setValue(0);
      fadeIn.setValue(0);
      contentSlide.setValue(30);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 8 }),
      ]).start();
    }
  }, [visible]);

  // Animate progress bar
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: currentPage / (TOTAL_PAGES - 1),
      useNativeDriver: false,
      speed: 14,
      bounciness: 6,
    }).start();
  }, [currentPage]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (page !== currentPage && page >= 0 && page < TOTAL_PAGES) {
      setCurrentPage(page);
    }
  }, [currentPage]);

  const goToPage = (page: number) => {
    scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
    setCurrentPage(page);
  };

  const goNext = () => {
    if (currentPage === TOTAL_PAGES - 1) {
      onClose();
      setTimeout(() => {
        setCurrentPage(0);
      }, 300);
      return;
    }
    goToPage(currentPage + 1);
  };

  const goBack = () => {
    if (currentPage > 0) goToPage(currentPage - 1);
  };

  const handleSkip = () => {
    onClose();
    setTimeout(() => setCurrentPage(0), 300);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const page = PAGES[currentPage];
  const isFirst = currentPage === 0;
  const isLast = currentPage === TOTAL_PAGES - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip} statusBarTranslucent>
      <Animated.View style={[styles.fullScreen, { opacity: fadeIn }]}>
        {/* Gradient Background — simulated with overlaying views */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: page.gradient[0] }]} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: page.gradient[1], opacity: 0.6 }]} />

        {/* Floating orbs for ambiance */}
        <FloatingOrb color="rgba(255,255,255,0.04)" size={200} x={-50} y={100} delay={0} />
        <FloatingOrb color="rgba(255,255,255,0.03)" size={300} x={SCREEN_WIDTH - 100} y={SCREEN_HEIGHT - 400} delay={500} />
        <FloatingOrb color="rgba(255,255,255,0.05)" size={150} x={SCREEN_WIDTH / 2 - 75} y={60} delay={200} />

        {/* ─── Top Bar ─── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.topRow}>
            <View style={styles.stepIndicator}>
              <Ionicons name="book-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.stepText}>
                {currentPage + 1} / {TOTAL_PAGES}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Swipeable Pages ─── */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          style={styles.scrollView}
        >
          {PAGES.map((pg, idx) => (
            <View key={pg.id} style={styles.page}>
              {/* Confetti for welcome and ready pages */}
              {pg.hasConfetti && currentPage === idx && (
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <ConfettiParticle
                      key={i}
                      delay={i * 80}
                      color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                      startX={Math.random() * SCREEN_WIDTH}
                    />
                  ))}
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.pageContent,
                  { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 120 },
                ]}
              >
                {/* ─── WELCOME PAGE ─── */}
                {pg.id === 'welcome' && (
                  <>
                    <View style={styles.welcomeEmoji}>
                      <Text style={{ fontSize: 60 }}>🏰</Text>
                    </View>
                    <Text style={styles.welcomeTitle}>
                      {userName ? `Hey ${userName}!` : 'Welcome!'}
                    </Text>
                    <Text style={styles.welcomeSubtitle}>{pg.subtitle}</Text>
                    <Text style={styles.welcomeDesc}>
                      Let's take a quick tour so you can get the most out of Citadel. It'll only take a minute!
                    </Text>

                    <View style={styles.welcomeFeatures}>
                      <FeatureBadge icon="home" label="Home" color="#3b82f6" />
                      <FeatureBadge icon="camera" label="Scan" color="#22c55e" />
                      <FeatureBadge icon="people" label="Social" color="#a855f7" />
                      <FeatureBadge icon="folder-open" label="Files" color="#f59e0b" />
                    </View>

                    <View style={styles.swipeHint}>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.swipeHintText}>Swipe or tap Next to begin</Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                  </>
                )}

                {/* ─── FEATURE PAGES ─── */}
                {pg.icon && pg.tips && (
                  <>
                    <PulsingIcon
                      icon={pg.icon}
                      color={pg.accentColor!}
                      bgColor={`${pg.accentColor}30`}
                    />

                    <Text style={styles.pageTitle}>{pg.title}</Text>
                    <Text style={[styles.pageSubtitle, { color: pg.accentColor }]}>{pg.subtitle}</Text>
                    <Text style={styles.pageDescription}>{pg.description}</Text>

                    <View style={styles.tipsSection}>
                      <View style={styles.tipsSectionHeader}>
                        <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.tipsSectionTitle}>Tap to explore</Text>
                      </View>
                      {pg.tips.map((tip, i) => (
                        <TapToRevealCard
                          key={i}
                          emoji={tip.emoji}
                          label={tip.label}
                          revealText={tip.reveal}
                          accentColor={pg.accentColor!}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* ─── READY PAGE ─── */}
                {pg.id === 'ready' && (
                  <>
                    <View style={styles.welcomeEmoji}>
                      <Text style={{ fontSize: 60 }}>🚀</Text>
                    </View>
                    <Text style={styles.welcomeTitle}>{pg.title}</Text>
                    <Text style={styles.welcomeSubtitle}>{pg.subtitle}</Text>
                    <Text style={styles.welcomeDesc}>
                      You've learned everything you need. Now go create your first class, scan some notes, and invite your friends!
                    </Text>

                    <View style={styles.readyChecklist}>
                      {[
                        { icon: 'checkmark-circle', text: 'Explore the home screen', color: '#3b82f6' },
                        { icon: 'checkmark-circle', text: 'Scan your first notes', color: '#22c55e' },
                        { icon: 'checkmark-circle', text: 'Add a classmate', color: '#a855f7' },
                        { icon: 'checkmark-circle', text: 'Organize your files', color: '#f59e0b' },
                      ].map((item, i) => (
                        <View key={i} style={styles.checklistItem}>
                          <Ionicons name={item.icon as any} size={20} color={item.color} />
                          <Text style={styles.checklistText}>{item.text}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        {/* ─── Bottom Navigation ─── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          {/* Page dots */}
          <View style={styles.dotsRow}>
            {PAGES.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => goToPage(i)} activeOpacity={0.7}>
                <View
                  style={[
                    styles.dot,
                    i === currentPage && styles.dotActive,
                    i < currentPage && styles.dotCompleted,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.navRow}>
            {currentPage > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 90 }} />
            )}

            <TouchableOpacity
              style={[
                styles.nextBtn,
                isLast && styles.nextBtnFinish,
              ]}
              onPress={goNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextText, isLast && { color: '#1a0a2e' }]}>
                {isFirst ? "Let's Go" : isLast ? "Start Exploring!" : 'Next'}
              </Text>
              <Ionicons
                name={isLast ? 'rocket' : 'arrow-forward'}
                size={16}
                color={isLast ? '#1a0a2e' : 'white'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  pageContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  /* ── Top Bar ── */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.5)',
  },

  /* ── Welcome Page ── */
  welcomeEmoji: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  welcomeTitle: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  welcomeDesc: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: 32,
  },
  welcomeFeatures: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  swipeHintText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.35)',
  },

  /* ── Feature Pages ── */
  pageTitle: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: 'white',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pageDescription: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
    marginBottom: 28,
  },
  tipsSection: {
    width: '100%',
    gap: 10,
  },
  tipsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tipsSectionTitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ── Tap Cards ── */
  tapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  tapCardEmoji: {
    fontSize: 28,
  },
  tapCardLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: 'white',
    marginBottom: 2,
  },
  tapCardHint: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  tapCardReveal: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 19,
  },

  /* ── Feature Badges ── */
  featureBadge: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 80,
  },
  featureBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBadgeLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },

  /* ── Ready Page Checklist ── */
  readyChecklist: {
    width: '100%',
    maxWidth: 300,
    gap: 14,
    marginTop: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  checklistText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.8)',
  },

  /* ── Bottom Bar ── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 28,
    backgroundColor: 'white',
  },
  dotCompleted: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: 'rgba(255,255,255,0.8)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  nextBtnFinish: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  nextText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: 'white',
  },
});
