import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';

interface Props {
  onSignIn: (profilePicture: string | null, displayName?: string) => void;
  onBack: () => void;
  userName?: string;
}

export function SignInScreen({ onSignIn, onBack, userName }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState(userName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslate = useRef(new Animated.Value(18)).current;
  const avatarPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    introOpacity.setValue(0);
    introTranslate.setValue(18);

    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(introTranslate, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode, introOpacity, introTranslate]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(avatarPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    if (mode === 'signup') pulseLoop.start();
    return () => pulseLoop.stop();
  }, [mode, avatarPulse]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const pulseScale = avatarPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16],
  });

  const pulseOpacity = avatarPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.08],
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <Ionicons name="shield-checkmark" size={24} color={colors.maroon} />
          <Text style={styles.logoText}>Citadel</Text>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity style={[styles.toggleBtn, mode === 'signup' && styles.toggleActive]} onPress={() => setMode('signup')}>
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, mode === 'signin' && styles.toggleActive]} onPress={() => setMode('signin')}>
            <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={{
            opacity: introOpacity,
            transform: [{ translateY: introTranslate }],
          }}
        >
          <Text style={styles.h1}>
            {mode === 'signup'
              ? `Create your account${userName ? `, ${userName}` : ''}`
              : `Welcome back${userName ? `, ${userName}` : ''}`}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signup' ? 'Build your study identity in seconds.' : 'Sign in to continue your workflow.'}
          </Text>

          {mode === 'signup' && (
            <View style={styles.photoCard}>
              <Text style={styles.photoTitle}>Upload a profile picture</Text>
              <Text style={styles.photoSubtitle}>A clear photo helps friends find you faster.</Text>

              <View style={styles.avatarStage}>
                <Animated.View
                  style={[
                    styles.avatarPulse,
                    {
                      transform: [{ scale: pulseScale }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />

                <TouchableOpacity onPress={pickImage} style={styles.avatarWrap} activeOpacity={0.9}>
                  {profilePicture ? (
                    <Image source={{ uri: profilePicture }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarEmpty}>
                      <Ionicons name="person" size={42} color={colors.textTertiary} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={pickImage} style={styles.photoActionBtn} activeOpacity={0.85}>
                <Ionicons name="images" size={18} color="white" />
                <Text style={styles.photoActionBtnText}>{profilePicture ? 'Change Photo' : 'Choose Photo'}</Text>
              </TouchableOpacity>

              {profilePicture && (
                <TouchableOpacity onPress={() => setProfilePicture(null)} style={styles.photoRemoveBtn}>
                  <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.photoRemoveText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="School Email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => onSignIn(profilePicture, mode === 'signup' ? displayName.trim() : undefined)}
            activeOpacity={0.88}
          >
            <Text style={styles.submitText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.socialBtn}>
            <Ionicons name="logo-apple" size={20} color="white" />
            <Text style={styles.socialBtnText}>Continue with Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.socialBtn, styles.socialBtnOutline]}>
            <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
            <Text style={[styles.socialBtnText, styles.socialBtnTextDark]}>Continue with Google</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  blobTop: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#F8E0D0',
    top: -130,
    right: -60,
  },
  blobBottom: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#FBE8DC',
    bottom: -90,
    left: -30,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 56, paddingBottom: 40 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  logoText: { fontSize: 20, fontFamily: fonts.bold, color: colors.maroon, letterSpacing: -0.5 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0E0D0',
    borderRadius: 18,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.maroon },
  toggleText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  toggleTextActive: { color: 'white' },
  h1: { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: 22 },
  photoCard: {
    backgroundColor: 'white',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    padding: 20,
    marginBottom: 22,
  },
  photoTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 4, letterSpacing: -0.3 },
  photoSubtitle: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: 14 },
  avatarStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 130,
  },
  avatarPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.maroon}33`,
  },
  avatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: `${colors.maroon}55`,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: '100%', height: '100%' },
  photoActionBtn: {
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoActionBtnText: { color: 'white', fontSize: 14, fontFamily: fonts.bold },
  photoRemoveBtn: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFF5ED',
  },
  photoRemoveText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: 7 },
  input: {
    height: 54,
    paddingHorizontal: 18,
    backgroundColor: 'white',
    borderRadius: 18,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  passwordWrap: { position: 'relative' },
  inputPassword: { paddingRight: 46 },
  eyeBtn: { position: 'absolute', right: 14, top: 16 },
  submitBtn: {
    height: 58,
    backgroundColor: colors.maroon,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.maroon,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  submitText: { fontSize: 16, fontFamily: fonts.bold, color: 'white' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F0E0D0' },
  dividerText: { fontSize: 12, color: colors.textTertiary, fontFamily: fonts.medium },
  socialBtn: {
    height: 54,
    backgroundColor: colors.textPrimary,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  socialBtnOutline: { backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0' },
  socialBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },
  socialBtnTextDark: { color: colors.textPrimary },
});
