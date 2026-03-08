import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Animated,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { AnimatedPressable } from '../components/AnimatedPressable';

type PageType = 'help' | 'terms' | 'privacy';

interface Props {
    page: PageType;
    onBack: () => void;
    supportEmail: string;
}

const PAGE_DATA: Record<PageType, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
    help: { title: 'Help & Support', icon: 'help-circle-outline' },
    terms: { title: 'Terms of Service', icon: 'document-text-outline' },
    privacy: { title: 'Privacy Policy', icon: 'shield-outline' },
};

export function InfoPageScreen({ page, onBack, supportEmail }: Props) {
    const fade = useRef(new Animated.Value(0)).current;
    const slide = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
        ]).start();
    }, [fade, slide]);

    const { title, icon } = PAGE_DATA[page];

    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                <AnimatedPressable onPress={onBack} style={styles.backBtn} scaleDown={0.88}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </AnimatedPressable>
                <Text style={styles.pageTitle}>{title}</Text>
                <View style={{ width: 42 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>

                    {/* Page Icon */}
                    <View style={styles.heroIcon}>
                        <Ionicons name={icon} size={40} color={colors.maroon} />
                    </View>

                    {page === 'help' && (
                        <>
                            <Text style={styles.heading}>How can we help?</Text>
                            <Text style={styles.paragraph}>
                                Citadel is built to make studying easier and more collaborative. If you're having any issues, we're here to help!
                            </Text>

                            <View style={styles.card}>
                                <View style={styles.faqItem}>
                                    <Text style={styles.faqQ}>How do I create a class?</Text>
                                    <Text style={styles.faqA}>Tap the "Create / Join Class" card on the home screen. Choose a template, set your block and focus area, and you're good to go!</Text>
                                </View>
                                <View style={styles.separator} />
                                <View style={styles.faqItem}>
                                    <Text style={styles.faqQ}>How do I invite classmates?</Text>
                                    <Text style={styles.faqA}>Open any class → tap "Invite" → share your class code. They can join by entering the code on their home screen.</Text>
                                </View>
                                <View style={styles.separator} />
                                <View style={styles.faqItem}>
                                    <Text style={styles.faqQ}>Can I upload notes from my phone?</Text>
                                    <Text style={styles.faqA}>Yes! Open a class → go to a unit section → tap "Add Note". You can upload from your files tab or scan directly from your camera.</Text>
                                </View>
                                <View style={styles.separator} />
                                <View style={styles.faqItem}>
                                    <Text style={styles.faqQ}>How do I add a friend?</Text>
                                    <Text style={styles.faqA}>Go to the Friends tab → tap "Discover" → browse suggested classmates and send a friend request!</Text>
                                </View>
                            </View>

                            <Text style={styles.subheading}>Still need help?</Text>
                            <Text style={styles.paragraph}>
                                Send us an email and we'll get back to you as soon as possible.
                            </Text>

                            <AnimatedPressable
                                style={styles.emailBtn}
                                onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
                                scaleDown={0.96}
                            >
                                <Ionicons name="mail" size={18} color="white" />
                                <Text style={styles.emailBtnText}>{supportEmail}</Text>
                            </AnimatedPressable>
                        </>
                    )}

                    {page === 'terms' && (
                        <>
                            <Text style={styles.heading}>Terms of Service</Text>
                            <Text style={styles.metaDate}>Last updated: March 1, 2026</Text>

                            <Text style={styles.subheading}>1. Acceptance of Terms</Text>
                            <Text style={styles.paragraph}>
                                By accessing or using the Citadel application ("App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
                            </Text>

                            <Text style={styles.subheading}>2. Description of Service</Text>
                            <Text style={styles.paragraph}>
                                Citadel provides a collaborative study platform for students to organize classes, share notes, and connect with classmates. The service may include features such as class management, file scanning, note sharing, and messaging.
                            </Text>

                            <Text style={styles.subheading}>3. User Accounts</Text>
                            <Text style={styles.paragraph}>
                                You are responsible for maintaining the confidentiality of your account. You agree to provide accurate information and to update it as necessary. You must notify us immediately of any unauthorized use of your account.
                            </Text>

                            <Text style={styles.subheading}>4. User Content</Text>
                            <Text style={styles.paragraph}>
                                You retain ownership of all content you upload to Citadel, including notes, documents, and messages. By uploading content, you grant Citadel a non-exclusive license to store and display your content to other users you've authorized.
                            </Text>

                            <Text style={styles.subheading}>5. Acceptable Use</Text>
                            <Text style={styles.paragraph}>
                                You agree not to use Citadel to share copyrighted material without permission, harass or bully other users, distribute spam or malware, or violate any applicable laws or regulations.
                            </Text>

                            <Text style={styles.subheading}>6. Limitation of Liability</Text>
                            <Text style={styles.paragraph}>
                                Citadel is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including loss of data or interruptions in service.
                            </Text>

                            <Text style={styles.subheading}>7. Contact Us</Text>
                            <Text style={styles.paragraph}>
                                For questions about these terms, please contact us at {supportEmail}.
                            </Text>
                        </>
                    )}

                    {page === 'privacy' && (
                        <>
                            <Text style={styles.heading}>Privacy Policy</Text>
                            <Text style={styles.metaDate}>Last updated: March 1, 2026</Text>

                            <Text style={styles.subheading}>1. Information We Collect</Text>
                            <Text style={styles.paragraph}>
                                We collect information you provide directly, including your name, grade, school, and study materials. We also collect usage data such as features accessed and time spent in the app.
                            </Text>

                            <Text style={styles.subheading}>2. How We Use Your Information</Text>
                            <Text style={styles.paragraph}>
                                Your information is used to provide and improve our services, personalize your experience, connect you with classmates, and send relevant notifications about your classes and study groups.
                            </Text>

                            <Text style={styles.subheading}>3. Information Sharing</Text>
                            <Text style={styles.paragraph}>
                                We do not sell your personal information. We share your profile information (name, school, and grade) only with users you've connected with as friends or classmates.
                            </Text>

                            <Text style={styles.subheading}>4. Data Security</Text>
                            <Text style={styles.paragraph}>
                                We implement industry-standard security measures to protect your data, including encryption in transit and at rest. However, no method of transmission over the internet is 100% secure.
                            </Text>

                            <Text style={styles.subheading}>5. Your Rights</Text>
                            <Text style={styles.paragraph}>
                                You can access, update, or delete your personal information at any time through your profile settings. You may also request a complete copy of your data by contacting us.
                            </Text>

                            <Text style={styles.subheading}>6. Children's Privacy</Text>
                            <Text style={styles.paragraph}>
                                Citadel is designed for students of all ages. We comply with COPPA and other applicable privacy regulations regarding children's data.
                            </Text>

                            <Text style={styles.subheading}>7. Contact Us</Text>
                            <Text style={styles.paragraph}>
                                For privacy questions or concerns, please contact us at {supportEmail}.
                            </Text>
                        </>
                    )}

                    <View style={{ height: 40 }} />
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF8F2' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    topRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 16, backgroundColor: 'white',
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0',
    },
    pageTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },

    heroIcon: {
        alignSelf: 'center', width: 72, height: 72, borderRadius: 28,
        backgroundColor: `${colors.maroon}12`, alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, marginTop: 8,
    },

    heading: {
        fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary,
        textAlign: 'center', marginBottom: 12, paddingHorizontal: 20,
    },
    subheading: {
        fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary,
        marginTop: 20, marginBottom: 6, paddingHorizontal: 24,
    },
    paragraph: {
        fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary,
        lineHeight: 22, paddingHorizontal: 24, marginBottom: 4,
    },
    metaDate: {
        fontSize: 12, fontFamily: fonts.medium, color: colors.textTertiary,
        textAlign: 'center', marginBottom: 16,
    },

    card: {
        backgroundColor: 'white', borderRadius: 20, marginHorizontal: 20,
        borderWidth: 2, borderColor: '#F0E0D0', overflow: 'hidden', marginTop: 8,
    },
    separator: { height: 1, backgroundColor: '#F0E0D0', marginLeft: 16 },

    faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
    faqQ: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 4 },
    faqA: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },

    emailBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, marginHorizontal: 24, marginTop: 16, height: 50,
        borderRadius: 18, backgroundColor: colors.maroon,
    },
    emailBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },
});
