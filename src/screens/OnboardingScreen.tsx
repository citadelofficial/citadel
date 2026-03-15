import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme';
import { supabase } from '../lib/supabase';

interface Props {
  onGetStarted: (userData: { name: string; username: string; grade: string; school: string }) => void;
}

const grades = [
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade (Freshman)',
  '10th Grade (Sophomore)',
  '11th Grade (Junior)',
  '12th Grade (Senior)',
  'College Freshman',
  'College Sophomore',
  'College Junior',
  'College Senior',
  'Graduate Student',
];

const loudounSchools = [
  'Briar Woods High School',
  'Broad Run High School',
  'Dominion High School',
  'Freedom High School',
  'Heritage High School',
  'Independence High School',
  'John Champe High School',
  'Lightridge High School',
  'Loudoun County High School',
  'Loudoun Valley High School',
  'Park View High School',
  'Potomac Falls High School',
  'Riverside High School',
  'Rock Ridge High School',
  'Stone Bridge High School',
  'Tuscarora High School',
  'Woodgrove High School',
  'Academies of Loudoun',
];

const TOTAL_STEPS = 4;

export function OnboardingScreen({ onGetStarted }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [customSchools, setCustomSchools] = useState<string[]>([]);
  const [hasTypedSchool, setHasTypedSchool] = useState(false);

  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(16)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const featureAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    contentOpacity.setValue(0);
    contentTranslate.setValue(16);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (step !== 3) {
      setShowGradePicker(false);
    }
  }, [step, contentOpacity, contentTranslate]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [heroPulse]);

  useEffect(() => {
    if (step !== 0) return;

    featureAnims.forEach((anim) => anim.setValue(0));
    Animated.stagger(
      110,
      featureAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [step, featureAnims]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, {
          toValue: 1.03,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaScale, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    if (canProceed()) {
      pulse.start();
    } else {
      ctaScale.setValue(1);
    }

    return () => pulse.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, name, username, usernameStatus, grade, school, ctaScale]);

  // Debounced username uniqueness check
  useEffect(() => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', trimmed)
          .maybeSingle();

        if (error) {
          console.error('Username check error:', error.message);
          setUsernameStatus('idle');
          return;
        }

        setUsernameStatus(data ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [username]);

  const allSchools = useMemo(() => [...loudounSchools, ...customSchools], [customSchools]);

  const filteredSchools = useMemo(() => {
    const query = school.trim().toLowerCase();

    if (!query) return loudounSchools.slice(0, 6);

    return allSchools.filter((s) => s.toLowerCase().includes(query)).slice(0, 8);
  }, [school, allSchools]);

  const exactSchoolMatch = useMemo(
    () => allSchools.some((s) => s.toLowerCase() === school.trim().toLowerCase()),
    [allSchools, school]
  );

  const canAddNewSchool = school.trim().length > 1 && !exactSchoolMatch;

  const goNext = () => {
    if (step === TOTAL_STEPS) {
      onGetStarted({ name: name.trim(), username: username.trim().toLowerCase(), grade, school: school.trim() });
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return username.trim().length >= 3 && usernameStatus === 'available';
    if (step === 3) return grade.length > 0;
    if (step === 4) return school.trim().length > 1;
    return false;
  };

  const addCustomSchool = () => {
    const trimmed = school.trim();
    if (!trimmed) return;

    if (!allSchools.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSchools((prev) => [...prev, trimmed]);
    }

    setSchool(trimmed);
    setHasTypedSchool(true);
  };

  const heroPulseScale = heroPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const heroPulseOpacity = heroPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.08],
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <View style={styles.logoRow}>
          <Ionicons name="shield-checkmark" size={26} color={colors.maroon} />
          <Text style={styles.logoText}>Citadel</Text>
        </View>

        <View style={styles.progressWrap}>
          <Text style={styles.progressText}>{step}/{TOTAL_STEPS}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.stepContent,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          {step === 0 && (
            <View>
              <View style={styles.heroCard}>
                <Animated.View
                  style={[
                    styles.heroGlow,
                    {
                      transform: [{ scale: heroPulseScale }],
                      opacity: heroPulseOpacity,
                    },
                  ]}
                />

                <View style={styles.heroBadge}>
                  <Ionicons name="sparkles" size={14} color={colors.maroon} />
                  <Text style={styles.heroBadgeText}>Demo Notice</Text>
                </View>

                <Text style={styles.heroNoticeTitle}>Thank you for trying out this demo app!</Text>
                <Text style={styles.heroNoticeBody}>
                  Notice: The app is not done by any means. None of the AI features are integrated yet, and all
                  classes/notes/units are just examples. Try it out and let us know what you think!
                </Text>
                <Text style={styles.heroNoticeBody}>
                  Throughout the next couple of months we will be improving this app and making it functional and
                  useful to students! We'd appreciate any ideas, comments or concerns you have - just let us know!
                </Text>
              </View>

              {[
                {
                  icon: 'scan',
                  title: 'Smart Capture',
                  text: 'Scan notes, whiteboards, and worksheets with one tap.',
                  color: '#2563eb',
                },
                {
                  icon: 'people',
                  title: 'Study Crew',
                  text: 'Share class materials and build sessions with friends.',
                  color: '#059669',
                },
                {
                  icon: 'trophy',
                  title: 'Exam Momentum',
                  text: 'Track progress and stay focused on what matters next.',
                  color: '#b45309',
                },
              ].map((feature, index) => (
                <Animated.View
                  key={feature.title}
                  style={[
                    styles.featureCard,
                    {
                      opacity: featureAnims[index],
                      transform: [
                        {
                          translateY: featureAnims[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [14, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                    <Ionicons name={feature.icon as keyof typeof Ionicons.glyphMap} size={18} color={feature.color} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {step === 1 && (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="person-circle" size={34} color={colors.maroon} />
              </View>
              <Text style={styles.h2}>What should we call you?</Text>
              <Text style={styles.p}>Your workspace gets personalized from the start.</Text>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Type your name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              {name.trim().length > 0 && (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={26} color="#059669" />
                </View>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="at" size={34} color={colors.maroon} />
              </View>
              <Text style={styles.h2}>Choose a username</Text>
              <Text style={styles.p}>This is how others find and recognize you on Citadel.</Text>
              <Text style={styles.label}>Username</Text>
              <View style={styles.usernameInputWrap}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  placeholder="your_username"
                  placeholderTextColor={colors.textTertiary}
                  value={username}
                  onChangeText={(text) => setUsername(text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameStatus === 'checking' && (
                  <ActivityIndicator size="small" color={colors.maroon} style={styles.usernameStatusIcon} />
                )}
                {usernameStatus === 'available' && (
                  <Ionicons name="checkmark-circle" size={22} color="#059669" style={styles.usernameStatusIcon} />
                )}
                {usernameStatus === 'taken' && (
                  <Ionicons name="close-circle" size={22} color="#dc2626" style={styles.usernameStatusIcon} />
                )}
              </View>
              {usernameStatus === 'taken' && (
                <Text style={styles.usernameTakenText}>This username is already taken. Try another!</Text>
              )}
              {usernameStatus === 'available' && (
                <Text style={styles.usernameAvailText}>Username is available!</Text>
              )}
              {username.trim().length > 0 && username.trim().length < 3 && (
                <Text style={styles.usernameHintText}>Username must be at least 3 characters</Text>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="ribbon" size={30} color={colors.maroon} />
              </View>
              <Text style={styles.h2}>What level are you in{name.trim() ? `, ${name.trim()}` : ''}?</Text>
              <Text style={styles.p}>This helps us tailor your classes and recommendations.</Text>
              <Text style={styles.label}>Grade or Year</Text>

              <TouchableOpacity style={styles.input} onPress={() => setShowGradePicker(!showGradePicker)}>
                <Text style={[styles.inputText, !grade && styles.inputPlaceholder]}>{grade || 'Select your level'}</Text>
                <Ionicons name={showGradePicker ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>

              {showGradePicker && (
                <ScrollView style={styles.picker} nestedScrollEnabled>
                  {grades.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={styles.pickerItem}
                      onPress={() => {
                        setGrade(g);
                        setShowGradePicker(false);
                      }}
                    >
                      <Text style={[styles.pickerText, grade === g && styles.pickerTextActive]}>{g}</Text>
                      {grade === g && <Ionicons name="checkmark" size={18} color={colors.maroon} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="school" size={30} color={colors.maroon} />
              </View>
              <Text style={styles.h2}>Where do you study?</Text>
              <Text style={styles.p}>Search your high school or college. If it is missing, add it instantly.</Text>

              <View style={styles.schoolTagRow}>
                <View style={styles.schoolTag}><Text style={styles.schoolTagText}>High School</Text></View>
                <View style={styles.schoolTag}><Text style={styles.schoolTagText}>College</Text></View>
                <View style={styles.schoolTag}><Text style={styles.schoolTagText}>University</Text></View>
              </View>

              <Text style={styles.label}>School Name</Text>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search school name"
                  placeholderTextColor={colors.textTertiary}
                  value={school}
                  onChangeText={(text) => {
                    setSchool(text);
                    setHasTypedSchool(true);
                  }}
                />
                {school.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSchool('');
                      setHasTypedSchool(false);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {(hasTypedSchool || school.trim().length > 0) && (filteredSchools.length > 0 || canAddNewSchool) && (
                <View style={styles.suggestionsWrap}>
                  {filteredSchools.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setSchool(item);
                        setHasTypedSchool(true);
                      }}
                    >
                      <Ionicons name="school-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}

                  {canAddNewSchool && (
                    <TouchableOpacity style={styles.addSchoolItem} onPress={addCustomSchool}>
                      <Ionicons name="add-circle" size={18} color={colors.maroon} />
                      <Text style={styles.addSchoolText}>Add a new school: "{school.trim()}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {school.trim().length > 0 && (
                <View style={styles.checkWrapSchool}>
                  <Ionicons name="checkmark-circle" size={22} color="#059669" />
                  <Text style={styles.checkSchoolText}>School saved</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Animated.View style={{ transform: [{ scale: canProceed() ? ctaScale : 1 }] }}>
          <TouchableOpacity
            style={[styles.btn, canProceed() ? styles.btnPrimary : styles.btnDisabled]}
            onPress={goNext}
            disabled={!canProceed()}
          >
            <Text style={[styles.btnText, canProceed() ? styles.btnTextWhite : styles.btnTextDisabled]}>
              {step === TOTAL_STEPS ? 'Join Citadel' : step === 0 ? 'Begin Setup' : 'Continue'}
            </Text>
            <Ionicons
              name={step === TOTAL_STEPS ? 'shield-checkmark' : 'arrow-forward'}
              size={20}
              color={canProceed() ? 'white' : colors.textTertiary}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  backBtnPlaceholder: { width: 42, height: 42 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { fontSize: 20, fontFamily: fonts.bold, color: colors.maroon, letterSpacing: -0.5 },
  progressWrap: { width: 86, alignItems: 'flex-end' },
  progressText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textSecondary, marginBottom: 5 },
  progressTrack: {
    width: '100%',
    height: 7,
    borderRadius: 999,
    backgroundColor: '#F0E0D0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.maroon,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  stepContent: { marginTop: spacing.md },
  heroCard: {
    borderRadius: 32,
    padding: 26,
    backgroundColor: colors.maroon,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    right: -40,
    top: -80,
    backgroundColor: 'white',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 18,
  },
  heroBadgeText: { fontSize: 11, color: colors.maroon, fontFamily: fonts.bold },
  heroNoticeTitle: { fontSize: 28, lineHeight: 34, fontFamily: fonts.bold, color: 'white', marginBottom: 10, letterSpacing: -0.5 },
  heroNoticeBody: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.9)', fontFamily: fonts.regular, marginBottom: 8 },
  featureCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: { flex: 1 },
  featureTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 2, letterSpacing: -0.3 },
  featureText: { fontSize: 13, lineHeight: 18, color: colors.textSecondary, fontFamily: fonts.regular },
  card: {
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 24,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: `${colors.maroon}14`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  h2: { fontSize: 26, lineHeight: 31, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.5 },
  p: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: 20 },
  label: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    height: 56,
    paddingHorizontal: 18,
    backgroundColor: '#FFF5ED',
    borderRadius: 18,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  inputText: { color: colors.textPrimary, fontFamily: fonts.medium },
  inputPlaceholder: { color: colors.textTertiary },
  checkWrap: { position: 'absolute', right: 24, bottom: 24 },

  // Username step
  usernameInputWrap: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    borderWidth: 2,
    borderColor: '#F0E0D0',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameAt: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.maroon,
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  usernameStatusIcon: {
    marginLeft: 8,
  },
  usernameTakenText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#dc2626',
  },
  usernameAvailText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#059669',
  },
  usernameHintText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },

  picker: {
    maxHeight: 235,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    marginTop: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF5ED',
  },
  pickerText: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium },
  pickerTextActive: { fontFamily: fonts.bold, color: colors.maroon },
  schoolTagRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  schoolTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFF5ED',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  schoolTagText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.semiBold },
  searchInputWrap: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    borderWidth: 2,
    borderColor: '#F0E0D0',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  suggestionsWrap: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF5ED',
  },
  suggestionText: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium, flex: 1 },
  addSchoolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFF5ED',
  },
  addSchoolText: { fontSize: 13, color: colors.maroon, fontFamily: fonts.bold },
  checkWrapSchool: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkSchoolText: { fontSize: 13, color: '#047857', fontFamily: fonts.semiBold },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, paddingBottom: 40 },
  btn: {
    height: 58,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  btnDisabled: { backgroundColor: '#E5E5E5' },
  btnText: { fontSize: 16, fontFamily: fonts.bold },
  btnTextWhite: { color: 'white' },
  btnTextDisabled: { color: colors.textTertiary },
});
