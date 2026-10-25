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
                            <Text style={styles.metaDate}>Last updated October 12, 2026</Text>

                            <Text style={styles.paragraph}>
                                These Terms cover your use of the Citadel iOS app and mycitadel.us (together, "Citadel"). By creating an account or using Citadel, you agree to them and to our Privacy Policy.
                            </Text>

                            <Text style={styles.subheading}>Who Can Use Citadel</Text>
                            <Text style={styles.paragraph}>
                                You must be at least 13. If you're under 18, a parent or guardian must agree to these Terms for you. Keep your account details accurate and your login secure. You're responsible for activity on your account.
                            </Text>

                            <Text style={styles.subheading}>Your Content</Text>
                            <Text style={styles.paragraph}>
                                You own the notes and files you add. You give Citadel a limited license to store, process, and display that content only to run the service for you and for the people you share it with, including syncing, search, AI features, and study rooms. Only upload material you have the right to share.
                            </Text>

                            <Text style={styles.subheading}>Acceptable Use</Text>
                            <Text style={styles.paragraph}>
                                Don't use Citadel to:
                            </Text>
                            <Text style={styles.bulletItem}>•  Cheat or break your school's academic integrity rules</Text>
                            <Text style={styles.bulletItem}>•  Upload illegal, harassing, hateful, sexual, or violent content</Text>
                            <Text style={styles.bulletItem}>•  Share other people's personal information without their consent</Text>
                            <Text style={styles.bulletItem}>•  Spam, spread malware, or try to hack, disrupt, or reverse engineer Citadel</Text>
                            <Text style={styles.bulletItem}>•  Record or share a study room without the other participants' consent</Text>
                            <Text style={styles.paragraph}>
                                You can report content or users to {supportEmail}. We may remove content or suspend accounts that break these rules. If we do, we'll tell you why, and you can ask us to review the decision.
                            </Text>

                            <Text style={styles.subheading}>AI Features</Text>
                            <Text style={styles.paragraph}>
                                AI-generated study guides, quizzes, and flashcards can be inaccurate or incomplete. Check them before relying on them for coursework.
                            </Text>

                            <Text style={styles.subheading}>Our App</Text>
                            <Text style={styles.paragraph}>
                                Citadel and its name, logo, and design belong to the Citadel team. We give you a personal, non-transferable, revocable license to use the app on your devices.
                            </Text>

                            <Text style={styles.subheading}>Third-Party Services</Text>
                            <Text style={styles.paragraph}>
                                Citadel relies on services such as Google Firebase and Expo, which have their own terms. Data charges from your mobile carrier are your responsibility.
                            </Text>

                            <Text style={styles.subheading}>Changes and Availability</Text>
                            <Text style={styles.paragraph}>
                                Citadel is provided "as is." We may add, change, or remove features, and we can't promise the service will be uninterrupted or error-free. If we make a significant change to these Terms, we'll notify you, and continuing to use Citadel means you accept the change.
                            </Text>

                            <Text style={styles.subheading}>Ending Your Account</Text>
                            <Text style={styles.paragraph}>
                                You can delete your account at any time in Settings. We may suspend or end access if you seriously or repeatedly break these Terms. Where we can, we'll warn you first.
                            </Text>

                            <Text style={styles.subheading}>Liability</Text>
                            <Text style={styles.paragraph}>
                                To the fullest extent the law allows, Citadel isn't liable for indirect or incidental damages or for lost data beyond our reasonable control. Since Citadel is free, our total liability is limited to the minimum the law allows. Nothing here limits rights you have under consumer protection law.
                            </Text>

                            <Text style={styles.subheading}>Governing Law</Text>
                            <Text style={styles.paragraph}>
                                These Terms are governed by the laws of the Commonwealth of Virginia, USA, except where your local law gives you protections that can't be waived.
                            </Text>

                            <Text style={styles.subheading}>Apple</Text>
                            <Text style={styles.paragraph}>
                                If you downloaded Citadel from the App Store, these Terms are between you and Citadel, not Apple. Apple has no responsibility for the app or its support, and Apple's standard terms for apps also apply.
                            </Text>

                            <Text style={styles.subheading}>Contact</Text>
                            <Text style={styles.paragraph}>
                                {supportEmail}
                            </Text>
                        </>
                    )}

                    {page === 'privacy' && (
                        <>
                            <Text style={styles.heading}>Privacy Policy</Text>
                            <Text style={styles.metaDate}>Last updated October 12, 2026</Text>

                            <Text style={styles.paragraph}>
                                Citadel helps students capture, combine, and study their class notes together. This policy covers the Citadel iOS app and mycitadel.us (together, "Citadel"). It explains what we collect, why, and the choices you have. Citadel is run by a small student team. You can reach us at {supportEmail}.
                            </Text>

                            <Text style={styles.subheading}>What We Collect</Text>
                            <Text style={styles.bulletItem}>•  Account info: your name, email, username, and, if you sign in with Google, basic Google profile details.</Text>
                            <Text style={styles.bulletItem}>•  Your content: notes you write or import, files you upload (slides, PDFs, photos, recordings), and study material Citadel generates for you.</Text>
                            <Text style={styles.bulletItem}>•  Study rooms: limited connection data needed to run live audio, video, and screen sharing.</Text>
                            <Text style={styles.bulletItem}>•  Usage and device data: pages and features you use, time in the app, device type, operating system, and IP address. We collect this through Google Analytics for Firebase.</Text>

                            <Text style={styles.subheading}>How We Use It</Text>
                            <Text style={styles.paragraph}>
                                We use your information to run Citadel. That means syncing and backing up your content, powering search and AI features, running study rooms, keeping accounts secure, answering support requests, and improving the app from aggregate usage. We send account and service emails. We send product updates only if you opt in. We never sell your personal information, and we don't use your notes for advertising.
                            </Text>

                            <Text style={styles.subheading}>Your Notes and Uploads</Text>
                            <Text style={styles.paragraph}>
                                Your content is private to you and the groups or links you choose to share it with. It is encrypted in transit and at rest. Uploads may be processed to pull out text and make them searchable. You can delete any note or upload at any time.
                            </Text>

                            <Text style={styles.subheading}>AI Features</Text>
                            <Text style={styles.paragraph}>
                                When you merge notes or generate quizzes and flashcards, the content involved is sent to our AI provider only to produce your result. We don't allow that provider to train its models on your content. AI output can be wrong, so check it before you rely on it.
                            </Text>

                            <Text style={styles.subheading}>Study Rooms</Text>
                            <Text style={styles.paragraph}>
                                Audio and video pass between participants in real time and are not recorded unless a host starts a recording. If that happens, everyone in the room is notified.
                            </Text>

                            <Text style={styles.subheading}>Who We Share With</Text>
                            <Text style={styles.paragraph}>
                                We share data only with the service providers that run Citadel: Firebase/Google (hosting, sign-in, analytics), Expo (app delivery), our AI provider, and our video provider. Each one may use your data only to provide its service to us. We may also disclose information if the law requires it or to protect users' safety.
                            </Text>

                            <Text style={styles.subheading}>Students and Children</Text>
                            <Text style={styles.paragraph}>
                                Citadel is for students 13 and older. If you're under 18, use Citadel with a parent or guardian's permission. We don't knowingly collect data from children under 13. If we learn we have, we delete it. Parents can contact us at any time to review or delete their child's data.
                            </Text>

                            <Text style={styles.subheading}>Keeping and Deleting Data</Text>
                            <Text style={styles.paragraph}>
                                We keep your content while your account is active. You can delete your account in the app under Settings. When you do, we permanently remove your data within 30 days, except limited records the law requires us to keep.
                            </Text>

                            <Text style={styles.subheading}>Your Rights</Text>
                            <Text style={styles.paragraph}>
                                You can access, correct, export, or delete your information, and you can withdraw any consent you've given. Depending on where you live, including California and the EU, you may have more rights under local law. To make a request, email {supportEmail}. We'll respond within 30 days.
                            </Text>

                            <Text style={styles.subheading}>Security</Text>
                            <Text style={styles.paragraph}>
                                We use reasonable technical and organizational safeguards, but no system is perfectly secure. If a breach affects your personal data, we'll notify you as the law requires.
                            </Text>

                            <Text style={styles.subheading}>Where Data Is Stored</Text>
                            <Text style={styles.paragraph}>
                                Citadel is based in the United States, and your data is processed there. If you use Citadel from outside the U.S., your data is transferred to the U.S. with the safeguards the law requires.
                            </Text>

                            <Text style={styles.subheading}>Changes</Text>
                            <Text style={styles.paragraph}>
                                If we make a significant change to this policy, we'll update the date at the top and notify you in the app or by email.
                            </Text>

                            <Text style={styles.subheading}>Contact</Text>
                            <Text style={styles.paragraph}>
                                {supportEmail}
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
    bulletItem: {
        fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary,
        lineHeight: 22, paddingHorizontal: 32, marginBottom: 4,
    },
    linkText: {
        color: colors.maroon, textDecorationLine: 'underline' as const,
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
