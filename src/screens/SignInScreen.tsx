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
  Linking,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';
import { supabase } from '../lib/supabase';

interface Props {
  onSignIn: (profilePicture: string | null, displayName?: string, isNewAccount?: boolean) => void;
  onBack: () => void;
  onBeforeSignUp?: () => void;
  onGoToSignUp?: () => void;
  signInOnly?: boolean;
  userName?: string;
  userUsername?: string;
  userGrade?: string;
  userSchool?: string;
  userSchools?: string[];
}

export function SignInScreen({ onSignIn, onBack, onBeforeSignUp, onGoToSignUp, signInOnly, userName, userUsername, userGrade, userSchool, userSchools }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>(signInOnly ? 'signin' : 'signup');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState(userName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const pickImage = () => {
    Alert.alert(
      'Profile Photo',
      'How would you like to add your photo?',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAuth = async () => {
    setError(null);

    // Validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords don\'t match.');
        return;
      }
      if (!confirmedAge) {
        setError('You must be 16 years of age or older to use Citadel.');
        return;
      }
      if (!agreedToPrivacy) {
        setError('Please read and agree to the Privacy Policy.');
        return;
      }
      if (!agreedToTerms) {
        setError('Please read and agree to the Terms of Service.');
        return;
      }
    }

    if (mode === 'signin') {
      if (!agreedToTerms) {
        setError('Please read and agree to the Terms of Service to sign in.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        // Signal to App.tsx BEFORE the auth call so the tutorial flag is set
        // before onAuthStateChange fires
        onBeforeSignUp?.();

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim() || userName || '',
              username: userUsername || '',
              grade: userGrade || '',
              school: userSchool || '',
              schools: userSchools || (userSchool ? [userSchool] : []),
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Sign-up successful — onAuthStateChange in App.tsx will handle navigation
        onSignIn(profilePicture, displayName.trim() || undefined, true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        // Sign-in successful — onAuthStateChange in App.tsx will handle navigation
        onSignIn(profilePicture, undefined, false);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
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

        {!signInOnly && (
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, mode === 'signup' && styles.toggleActive]} onPress={() => { setMode('signup'); setError(null); }}>
              <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, mode === 'signin' && styles.toggleActive]} onPress={() => { setMode('signin'); setError(null); }}>
              <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextActive]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        <Animated.View
          style={{
            opacity: introOpacity,
            transform: [{ translateY: introTranslate }],
          }}
        >
          <Text style={styles.h1}>
            {mode === 'signup'
              ? `Create your account${userName ? `, ${userName}` : ''}`
              : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signup' ? 'Build your study identity in seconds.' : 'Sign in to pick up where you left off.'}
          </Text>

          {mode === 'signup' && (
            <View style={styles.photoCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.photoTitle}>Profile picture</Text>
                <View style={{ backgroundColor: '#F0E0D0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary }}>OPTIONAL</Text>
                </View>
              </View>
              <Text style={styles.photoSubtitle}>Add a photo so friends can find you — or skip for now.</Text>

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
              placeholder="Email address"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
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
                onChangeText={(t) => { setPassword(t); setError(null); }}
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
                onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                secureTextEntry
              />
            </View>
          )}

          {mode === 'signup' && (
            <View style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setConfirmedAge(!confirmedAge)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, confirmedAge && styles.checkboxChecked]}>
                  {confirmedAge && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text style={styles.checkboxLabel}>I am 16 years of age or older</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreedToPrivacy && styles.checkboxChecked]}>
                  {agreedToPrivacy && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and agree to the{' '}
                  <Text style={styles.privacyLink} onPress={() => setShowPrivacyModal(true)}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and agree to the{' '}
                  <Text style={styles.privacyLink} onPress={() => setShowTermsModal(true)}>Terms of Service</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'signin' && (
            <View style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and agree to the{' '}
                  <Text style={styles.privacyLink} onPress={() => setShowTermsModal(true)}>Terms of Service</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Privacy Policy Modal */}
          <Modal visible={showPrivacyModal} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.privacyModalContainer}>
              <View style={styles.privacyModalHeader}>
                <Text style={styles.privacyModalTitle}>Privacy Policy</Text>
                <TouchableOpacity onPress={() => setShowPrivacyModal(false)} style={styles.privacyModalClose}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.privacyModalScroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                <Text style={styles.privacyModalDate}>Last updated October 12, 2026</Text>
                <Text style={styles.privacyModalBody}>
                  Citadel helps students capture, combine, and study their class notes together. This policy covers the Citadel iOS app and mycitadel.us (together, "Citadel"). It explains what we collect, why, and the choices you have. Citadel is run by a small student team. You can reach us at my.citadel.official@gmail.com.
                </Text>
                <Text style={styles.privacyModalSub}>What We Collect</Text>
                <Text style={styles.privacyModalBody}>
                  • Account info: your name, email, username, and, if you sign in with Google, basic Google profile details.{'\n'}
                  • Your content: notes you write or import, files you upload (slides, PDFs, photos, recordings), and study material Citadel generates for you.{'\n'}
                  • Study rooms: limited connection data needed to run live audio, video, and screen sharing.{'\n'}
                  • Usage and device data: pages and features you use, time in the app, device type, operating system, and IP address. We collect this through Google Analytics for Firebase.
                </Text>
                <Text style={styles.privacyModalSub}>How We Use It</Text>
                <Text style={styles.privacyModalBody}>
                  We use your information to run Citadel. That means syncing and backing up your content, powering search and AI features, running study rooms, keeping accounts secure, answering support requests, and improving the app from aggregate usage. We send account and service emails. We send product updates only if you opt in. We never sell your personal information, and we don't use your notes for advertising.
                </Text>
                <Text style={styles.privacyModalSub}>Your Notes and Uploads</Text>
                <Text style={styles.privacyModalBody}>
                  Your content is private to you and the groups or links you choose to share it with. It is encrypted in transit and at rest. Uploads may be processed to pull out text and make them searchable. You can delete any note or upload at any time.
                </Text>
                <Text style={styles.privacyModalSub}>AI Features</Text>
                <Text style={styles.privacyModalBody}>
                  When you merge notes or generate quizzes and flashcards, the content involved is sent to our AI provider only to produce your result. We don't allow that provider to train its models on your content. AI output can be wrong, so check it before you rely on it.
                </Text>
                <Text style={styles.privacyModalSub}>Study Rooms</Text>
                <Text style={styles.privacyModalBody}>
                  Audio and video pass between participants in real time and are not recorded unless a host starts a recording. If that happens, everyone in the room is notified.
                </Text>
                <Text style={styles.privacyModalSub}>Who We Share With</Text>
                <Text style={styles.privacyModalBody}>
                  We share data only with the service providers that run Citadel: Firebase/Google (hosting, sign-in, analytics), Expo (app delivery), our AI provider, and our video provider. Each one may use your data only to provide its service to us. We may also disclose information if the law requires it or to protect users' safety.
                </Text>
                <Text style={styles.privacyModalSub}>Students and Children</Text>
                <Text style={styles.privacyModalBody}>
                  Citadel is for students 13 and older. If you're under 18, use Citadel with a parent or guardian's permission. We don't knowingly collect data from children under 13. If we learn we have, we delete it. Parents can contact us at any time to review or delete their child's data.
                </Text>
                <Text style={styles.privacyModalSub}>Keeping and Deleting Data</Text>
                <Text style={styles.privacyModalBody}>
                  We keep your content while your account is active. You can delete your account in the app under Settings. When you do, we permanently remove your data within 30 days, except limited records the law requires us to keep.
                </Text>
                <Text style={styles.privacyModalSub}>Your Rights</Text>
                <Text style={styles.privacyModalBody}>
                  You can access, correct, export, or delete your information, and you can withdraw any consent you've given. Depending on where you live, including California and the EU, you may have more rights under local law. To make a request, email my.citadel.official@gmail.com. We'll respond within 30 days.
                </Text>
                <Text style={styles.privacyModalSub}>Security</Text>
                <Text style={styles.privacyModalBody}>
                  We use reasonable technical and organizational safeguards, but no system is perfectly secure. If a breach affects your personal data, we'll notify you as the law requires.
                </Text>
                <Text style={styles.privacyModalSub}>Where Data Is Stored</Text>
                <Text style={styles.privacyModalBody}>
                  Citadel is based in the United States, and your data is processed there. If you use Citadel from outside the U.S., your data is transferred to the U.S. with the safeguards the law requires.
                </Text>
                <Text style={styles.privacyModalSub}>Changes</Text>
                <Text style={styles.privacyModalBody}>
                  If we make a significant change to this policy, we'll update the date at the top and notify you in the app or by email.
                </Text>
                <Text style={styles.privacyModalSub}>Contact</Text>
                <Text style={styles.privacyModalBody}>
                  my.citadel.official@gmail.com
                </Text>
              </ScrollView>
              <View style={{ paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12, backgroundColor: '#FFF8F2' }}>
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 0 }]}
                  onPress={() => { setAgreedToPrivacy(true); setShowPrivacyModal(false); }}
                  activeOpacity={0.88}
                >
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                  <Text style={styles.submitText}>I Agree</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Terms & Conditions Modal */}
          <Modal visible={showTermsModal} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.privacyModalContainer}>
              <View style={styles.privacyModalHeader}>
                <Text style={styles.privacyModalTitle}>Terms of Service</Text>
                <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.privacyModalClose}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.privacyModalScroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                <Text style={styles.privacyModalDate}>Last updated October 12, 2026</Text>
                <Text style={styles.privacyModalBody}>
                  These Terms cover your use of the Citadel iOS app and mycitadel.us (together, "Citadel"). By creating an account or using Citadel, you agree to them and to our Privacy Policy.
                </Text>
                <Text style={styles.privacyModalSub}>Who Can Use Citadel</Text>
                <Text style={styles.privacyModalBody}>
                  You must be at least 13. If you're under 18, a parent or guardian must agree to these Terms for you. Keep your account details accurate and your login secure. You're responsible for activity on your account.
                </Text>
                <Text style={styles.privacyModalSub}>Your Content</Text>
                <Text style={styles.privacyModalBody}>
                  You own the notes and files you add. You give Citadel a limited license to store, process, and display that content only to run the service for you and for the people you share it with, including syncing, search, AI features, and study rooms. Only upload material you have the right to share.
                </Text>
                <Text style={styles.privacyModalSub}>Acceptable Use</Text>
                <Text style={styles.privacyModalBody}>
                  Don't use Citadel to:{'\n'}
                  • Cheat or break your school's academic integrity rules{'\n'}
                  • Upload illegal, harassing, hateful, sexual, or violent content{'\n'}
                  • Share other people's personal information without their consent{'\n'}
                  • Spam, spread malware, or try to hack, disrupt, or reverse engineer Citadel{'\n'}
                  • Record or share a study room without the other participants' consent
                </Text>
                <Text style={styles.privacyModalBody}>
                  You can report content or users to my.citadel.official@gmail.com. We may remove content or suspend accounts that break these rules. If we do, we'll tell you why, and you can ask us to review the decision.
                </Text>
                <Text style={styles.privacyModalSub}>AI Features</Text>
                <Text style={styles.privacyModalBody}>
                  AI-generated study guides, quizzes, and flashcards can be inaccurate or incomplete. Check them before relying on them for coursework.
                </Text>
                <Text style={styles.privacyModalSub}>Our App</Text>
                <Text style={styles.privacyModalBody}>
                  Citadel and its name, logo, and design belong to the Citadel team. We give you a personal, non-transferable, revocable license to use the app on your devices.
                </Text>
                <Text style={styles.privacyModalSub}>Third-Party Services</Text>
                <Text style={styles.privacyModalBody}>
                  Citadel relies on services such as Google Firebase and Expo, which have their own terms. Data charges from your mobile carrier are your responsibility.
                </Text>
                <Text style={styles.privacyModalSub}>Changes and Availability</Text>
                <Text style={styles.privacyModalBody}>
                  Citadel is provided "as is." We may add, change, or remove features, and we can't promise the service will be uninterrupted or error-free. If we make a significant change to these Terms, we'll notify you, and continuing to use Citadel means you accept the change.
                </Text>
                <Text style={styles.privacyModalSub}>Ending Your Account</Text>
                <Text style={styles.privacyModalBody}>
                  You can delete your account at any time in Settings. We may suspend or end access if you seriously or repeatedly break these Terms. Where we can, we'll warn you first.
                </Text>
                <Text style={styles.privacyModalSub}>Liability</Text>
                <Text style={styles.privacyModalBody}>
                  To the fullest extent the law allows, Citadel isn't liable for indirect or incidental damages or for lost data beyond our reasonable control. Since Citadel is free, our total liability is limited to the minimum the law allows. Nothing here limits rights you have under consumer protection law.
                </Text>
                <Text style={styles.privacyModalSub}>Governing Law</Text>
                <Text style={styles.privacyModalBody}>
                  These Terms are governed by the laws of the Commonwealth of Virginia, USA, except where your local law gives you protections that can't be waived.
                </Text>
                <Text style={styles.privacyModalSub}>Apple</Text>
                <Text style={styles.privacyModalBody}>
                  If you downloaded Citadel from the App Store, these Terms are between you and Citadel, not Apple. Apple has no responsibility for the app or its support, and Apple's standard terms for apps also apply.
                </Text>
                <Text style={styles.privacyModalSub}>Contact</Text>
                <Text style={styles.privacyModalBody}>
                  my.citadel.official@gmail.com
                </Text>
              </ScrollView>
              <View style={{ paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12, backgroundColor: '#FFF8F2' }}>
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 0 }]}
                  onPress={() => { setAgreedToTerms(true); setShowTermsModal(false); }}
                  activeOpacity={0.88}
                >
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                  <Text style={styles.submitText}>I Agree</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnLoading]}
            onPress={handleAuth}
            activeOpacity={0.88}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={styles.submitText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </>
            )}
          </TouchableOpacity>

          {signInOnly && onGoToSignUp && (
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 20, paddingVertical: 8 }} onPress={onGoToSignUp}>
              <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary }}>
                Meant to sign up?{' '}
                <Text style={{ fontFamily: fonts.bold, color: colors.maroon }}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          )}
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: '#dc2626' },
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
  submitBtnLoading: {
    opacity: 0.8,
  },
  submitText: { fontSize: 16, fontFamily: fonts.bold, color: 'white' },

  // Consent checkboxes
  consentSection: { marginTop: 4, marginBottom: 6 },
  checkboxRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    backgroundColor: 'white',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  privacyLink: {
    color: colors.maroon,
    fontFamily: fonts.bold,
    textDecorationLine: 'underline' as const,
  },

  // Privacy Policy Modal
  privacyModalContainer: { flex: 1, backgroundColor: '#FFF8F2' },
  privacyModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
  },
  privacyModalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary },
  privacyModalClose: {
    width: 36, height: 36, borderRadius: 14,
    backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  privacyModalScroll: { flex: 1 },
  privacyModalDate: {
    fontSize: 12, fontFamily: fonts.medium, color: colors.textTertiary,
    textAlign: 'center' as const, marginTop: 16, marginBottom: 12,
  },
  privacyModalSub: {
    fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary,
    marginTop: 18, marginBottom: 6,
  },
  privacyModalBody: {
    fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary,
    lineHeight: 21, marginBottom: 4,
  },
});
