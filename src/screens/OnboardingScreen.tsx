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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme';
import { supabase } from '../lib/supabase';
import { normalizeSchoolName, findBestMatch, capitalizeSchoolName } from '../lib/schoolUtils';

interface Props {
  onGetStarted: (userData: { name: string; username: string; grade: string; schools: string[] }) => void;
  onSignIn?: () => void;
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

// Schools will be fetched dynamically from Supabase

const TOTAL_STEPS = 4;

export function OnboardingScreen({ onGetStarted, onSignIn }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [customSchools, setCustomSchools] = useState<string[]>([]);
  const [dbSchools, setDbSchools] = useState<string[]>([]);
  const [hasTypedSchool, setHasTypedSchool] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // "Did you mean?" state
  const [suggestedMatch, setSuggestedMatch] = useState<{ match: string; score: number } | null>(null);

  // Fetch existing schools from profiles
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('school')
          .not('school', 'is', null)
          .not('school', 'eq', '');
        if (data) {
          const unique = [...new Set(data.map((r: any) => r.school as string).filter(Boolean))];
          setDbSchools(unique.sort());
        }
      } catch (e) {
        console.log('Error fetching schools:', e);
      }
    })();
  }, []);

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

  const allSchools = useMemo(() => [...new Set([...dbSchools, ...customSchools])], [dbSchools, customSchools]);

  const filteredSchools = useMemo(() => {
    const query = school.trim().toLowerCase();

    if (!query) return allSchools.slice(0, 6);

    return allSchools.filter((s) => s.toLowerCase().includes(query)).slice(0, 8);
  }, [school, allSchools]);

  const exactSchoolMatch = useMemo(
    () => allSchools.some((s) => s.toLowerCase() === school.trim().toLowerCase()),
    [allSchools, school]
  );

  const canAddNewSchool = school.trim().length > 1 && !exactSchoolMatch;

  const goNext = () => {
    if (step === TOTAL_STEPS) {
      onGetStarted({ name: name.trim(), username: username.trim().toLowerCase(), grade, schools: selectedSchools });
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
    if (step === 4) return selectedSchools.length > 0;
    return false;
  };

  const addSchoolToList = (schoolName: string) => {
    const normalized = normalizeSchoolName(schoolName);
    if (!normalized) return;
    if (!selectedSchools.some(s => s.toLowerCase() === normalized.toLowerCase())) {
      setSelectedSchools(prev => [...prev, normalized]);
    }
    setSchool('');
    setHasTypedSchool(false);
    setSuggestedMatch(null);
  };

  const removeSchoolFromList = (schoolName: string) => {
    setSelectedSchools(prev => prev.filter(s => s !== schoolName));
  };

  const addCustomSchool = () => {
    const normalized = normalizeSchoolName(school);
    if (!normalized) return;
    if (!allSchools.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      setCustomSchools((prev) => [...prev, normalized]);
    }
    addSchoolToList(normalized);
  };

  // Handle selecting an existing school from suggestions
  const handleSelectExistingSchool = (schoolName: string) => {
    addSchoolToList(schoolName);
  };

  // Handle school input change with "Did you mean?" matching
  const handleSchoolInputChange = (text: string) => {
    setSchool(text);
    setHasTypedSchool(true);

    // Check for fuzzy match
    const trimmed = text.trim();
    if (trimmed.length >= 3) {
      const match = findBestMatch(trimmed, allSchools);
      setSuggestedMatch(match);
    } else {
      setSuggestedMatch(null);
    }
  };

  const applyInviteCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    // Guard against excessively large payloads
    if (code.length > 500) {
      Alert.alert('Invalid Code', 'That invite code is too long.');
      return;
    }

    // Try looking up as a short invite code in schools_meta (optional table)
    try {
      const { data } = await supabase
        .from('schools_meta')
        .select('school_name')
        .eq('invite_code', code)
        .maybeSingle();
      if (data?.school_name) {
        addSchoolToList(data.school_name);
        setInviteCode('');
        Alert.alert('School Added!', `You've been invited to ${data.school_name}. Welcome!`);
        return;
      }
    } catch {
      // Table may not exist, fall through to legacy decode
    }

    // Fallback: try decoding as legacy base64 code
    try {
      const padded = code + '='.repeat((4 - (code.length % 4)) % 4);
      const decoded = atob(padded);
      // Sanitize: limit length, strip control characters
      const sanitized = decoded.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 200);
      if (sanitized && sanitized.length > 0) {
        addSchoolToList(sanitized);
        setInviteCode('');
        Alert.alert('School Added!', `You've been invited to ${sanitized}. Welcome!`);
      } else {
        Alert.alert('Invalid Code', 'That invite code doesn\'t seem to be valid.');
      }
    } catch {
      Alert.alert('Invalid Code', 'That invite code doesn\'t seem to be valid.');
    }
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
                  <Ionicons name="shield-checkmark" size={14} color={colors.maroon} />
                  <Text style={styles.heroBadgeText}>Built for Students</Text>
                </View>

                <Text style={styles.heroNoticeTitle}>Your academic life,{"\n"}all in one place.</Text>
                <Text style={styles.heroNoticeBody}>
                  Citadel helps you organize classes, connect with classmates, and stay on top of your studies — all from one app.
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
              <View style={styles.inputWithCheck}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
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
              <Text style={styles.p}>Add one or more schools. Include your city to help others find the right one (e.g. "Lincoln High School, Dallas").</Text>

              {/* Selected schools chips */}
              {selectedSchools.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {selectedSchools.map((s, i) => (
                    <View key={s} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: i === 0 ? `${colors.maroon}18` : '#EEF2FF',
                      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8,
                      borderWidth: 1.5, borderColor: i === 0 ? colors.maroon : '#C7D2FE',
                    }}>
                      <Ionicons name="school" size={14} color={i === 0 ? colors.maroon : '#6366f1'} />
                      <Text style={{ fontSize: 13, fontFamily: fonts.semiBold, color: i === 0 ? colors.maroon : '#4338CA' }}>{s}</Text>
                      {i === 0 && <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.maroon, marginLeft: 2 }}>PRIMARY</Text>}
                      <TouchableOpacity onPress={() => removeSchoolFromList(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color={i === 0 ? colors.maroon : '#6366f1'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.label}>School Name</Text>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="e.g. Lincoln High School, Dallas"
                  placeholderTextColor={colors.textTertiary}
                  value={school}
                  onChangeText={handleSchoolInputChange}
                  autoCapitalize="words"
                />
                {school.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSchool('');
                      setHasTypedSchool(false);
                      setSuggestedMatch(null);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* "Did you mean?" suggestion banner */}
              {suggestedMatch && school.trim().length >= 3 && (
                <View style={styles.didYouMeanBanner}>
                  <Ionicons name="help-circle" size={18} color={colors.maroon} />
                  <Text style={styles.didYouMeanText}>
                    Did you mean <Text style={{ fontFamily: fonts.bold }}>{suggestedMatch.match}</Text>?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.didYouMeanYes}
                      onPress={() => {
                        setSuggestedMatch(null);
                        handleSelectExistingSchool(suggestedMatch.match);
                      }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: 'white' }}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.didYouMeanNo}
                      onPress={() => setSuggestedMatch(null)}
                    >
                      <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary }}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Suggestions list */}
              {(hasTypedSchool || school.trim().length > 0) && (filteredSchools.length > 0 || canAddNewSchool) && (
                <View style={styles.suggestionsWrap}>
                  {filteredSchools.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectExistingSchool(item)}
                    >
                      <Ionicons name="school-outline" size={16} color={colors.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionText}>{item}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}

                  {canAddNewSchool && (
                    <TouchableOpacity style={styles.addSchoolItem} onPress={addCustomSchool}>
                      <Ionicons name="add-circle" size={18} color={colors.maroon} />
                      <Text style={styles.addSchoolText}>Add a new school: "{normalizeSchoolName(school.trim())}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {selectedSchools.length > 0 && (
                <View style={styles.checkWrapSchool}>
                  <Ionicons name="checkmark-circle" size={22} color="#059669" />
                  <Text style={styles.checkSchoolText}>{selectedSchools.length} school{selectedSchools.length > 1 ? 's' : ''} added</Text>
                </View>
              )}

              {/* Invite Code */}
              <View style={{
                marginTop: 20,
                paddingTop: 18,
                borderTopWidth: 1,
                borderTopColor: '#F0E0D0',
              }}>
                <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: 4 }}>
                  Have an invite code?
                </Text>
                <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, marginBottom: 8 }}>
                  If someone shared a code with you, paste it here. Otherwise, just skip this.
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <View style={[styles.searchInputWrap, { flex: 1, marginBottom: 0 }]}>
                    <Ionicons name="mail-open-outline" size={18} color={colors.textTertiary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Paste invite code"
                      placeholderTextColor={colors.textTertiary}
                      value={inviteCode}
                      onChangeText={setInviteCode}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      height: 48,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      backgroundColor: inviteCode.trim() ? colors.maroon : '#E8D5C4',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={applyInviteCode}
                    disabled={!inviteCode.trim()}
                  >
                    <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: inviteCode.trim() ? 'white' : colors.textTertiary }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>

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
              {step === TOTAL_STEPS ? 'Join Citadel' : step === 0 ? 'Get Started' : 'Continue'}
            </Text>
            <Ionicons
              name={step === TOTAL_STEPS ? 'shield-checkmark' : 'arrow-forward'}
              size={20}
              color={canProceed() ? 'white' : colors.textTertiary}
            />
          </TouchableOpacity>
        </Animated.View>
        {step === 0 && onSignIn && (
          <TouchableOpacity style={{ alignItems: 'center', marginTop: 14 }} onPress={onSignIn}>
            <Text style={{ fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary }}>
              Already have an account? <Text style={{ fontFamily: fonts.bold, color: colors.maroon }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        )}
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
  inputWithCheck: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkWrap: { justifyContent: 'center', alignItems: 'center' },

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
  // Removed: schoolTag styles (High School/College/University pills removed)
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

  // "Did you mean?" banner
  didYouMeanBanner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: `${colors.maroon}0C`,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: `${colors.maroon}25`,
  },
  didYouMeanText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  didYouMeanYes: {
    backgroundColor: colors.maroon,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  didYouMeanNo: {
    backgroundColor: '#F0E0D0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  // School confirmation card
  confirmCard: {
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  confirmIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.maroon}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  confirmLocation: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  confirmYes: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.maroon,
    borderRadius: 14,
    paddingVertical: 12,
  },
  confirmNo: {
    flex: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E0D0',
    borderRadius: 14,
    paddingVertical: 12,
  },

  // Suggestion location sub-text
  suggestionLocation: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Location prompt overlay
  locationOverlay: {
    marginTop: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  locationCard: {
    backgroundColor: '#FFF8F2',
    borderRadius: 22,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.maroon,
  },
});
