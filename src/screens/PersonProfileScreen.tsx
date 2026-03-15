import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { AnimatedPressable } from '../components/AnimatedPressable';
import type { FriendData, ClassData } from '../types';

interface Props {
    person: FriendData;
    onBack: () => void;
    onChat: () => void;
    classes: ClassData[];
    isFriend: boolean;
    onAddFriend: (personId: string) => void;
    onRemoveFriend: (personId: string) => void;
}

export function PersonProfileScreen({ person, onBack, onChat, classes, isFriend, onAddFriend, onRemoveFriend }: Props) {
    const headerFade = useRef(new Animated.Value(0)).current;
    const headerSlide = useRef(new Animated.Value(-30)).current;
    const contentFade = useRef(new Animated.Value(0)).current;
    const contentSlide = useRef(new Animated.Value(20)).current;
    const [friendActionLoading, setFriendActionLoading] = useState(false);

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(headerFade, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.spring(headerSlide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
            ]),
            Animated.parallel([
                Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
            ]),
        ]).start();
    }, [headerFade, headerSlide, contentFade, contentSlide]);

    const statusLabel = person.status === 'online' ? 'Online now' : person.status === 'studying' ? 'Studying' : 'Offline';
    const statusColor = person.status === 'online' ? '#059669' : person.status === 'studying' ? '#d97706' : '#6b7280';

    // Find shared classes by checking if person.name is in classmateNames
    const sharedClasses = useMemo(() => {
        return classes.filter(cls =>
            cls.classmateNames?.some(n => n.toLowerCase() === person.name.toLowerCase()) ||
            (person.course && cls.title.toLowerCase().includes(person.course.toLowerCase().replace('ap ', '')))
        );
    }, [classes, person]);

    const firstName = person.name.split(' ')[0];

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
                    <View style={styles.topRow}>
                        <AnimatedPressable onPress={onBack} style={styles.backBtn} scaleDown={0.88}>
                            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                        </AnimatedPressable>
                        <Text style={styles.pageTitle}>Profile</Text>
                        <View style={{ width: 42 }} />
                    </View>

                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <View style={[styles.avatarCircle, { backgroundColor: person.color }]}>
                            <Ionicons name="person" size={44} color={colors.maroon} />
                        </View>
                        <Text style={styles.displayName}>{person.name}</Text>
                        <View style={styles.statusBadge}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.actionsRow}>
                        <AnimatedPressable style={styles.actionBtn} onPress={onChat} scaleDown={0.92}>
                            <Ionicons name="chatbubble" size={18} color="white" />
                            <Text style={styles.actionBtnText}>Message</Text>
                        </AnimatedPressable>
                        <AnimatedPressable style={[styles.actionBtn, styles.actionBtnOutline, isFriend && styles.actionBtnDanger]} onPress={() => {
                            if (friendActionLoading) return;
                            setFriendActionLoading(true);
                            if (isFriend) {
                                onRemoveFriend(person.id);
                            } else {
                                onAddFriend(person.id);
                            }
                            setTimeout(() => setFriendActionLoading(false), 600);
                        }} scaleDown={0.92}>
                            <Ionicons name={isFriend ? 'person-remove' : 'person-add'} size={18} color={isFriend ? '#b91c1c' : colors.maroon} />
                            <Text style={[styles.actionBtnText, { color: isFriend ? '#b91c1c' : colors.maroon }]}>{isFriend ? 'Remove Friend' : 'Add Friend'}</Text>
                        </AnimatedPressable>
                    </View>
                </Animated.View>

                {/* Content */}
                <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentSlide }] }}>

                    {/* About */}
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="person-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Full Name</Text>
                                <Text style={styles.infoValue}>{person.name}</Text>
                            </View>
                        </View>

                        <View style={styles.separator} />

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="school-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Grade</Text>
                                <Text style={styles.infoValue}>{person.grade || 'Not shared'}</Text>
                            </View>
                        </View>

                        <View style={styles.separator} />

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="business-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>School</Text>
                                <Text style={styles.infoValue}>{person.school || 'Not shared'}</Text>
                            </View>
                        </View>

                        {person.course ? (
                            <>
                                <View style={styles.separator} />
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIcon}><Ionicons name="book-outline" size={18} color={colors.maroon} /></View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Studying</Text>
                                        <Text style={styles.infoValue}>{person.course}</Text>
                                    </View>
                                </View>
                            </>
                        ) : null}
                    </View>

                    {/* Shared Classes */}
                    <Text style={styles.sectionTitle}>Classes With {firstName}</Text>
                    <View style={styles.card}>
                        {sharedClasses.length > 0 ? (
                            sharedClasses.map((cls, i) => (
                                <View key={cls.id}>
                                    {i > 0 && <View style={styles.separator} />}
                                    <View style={styles.classRow}>
                                        <View style={[styles.classColorDot, { backgroundColor: cls.color }]} />
                                        <View style={styles.classInfo}>
                                            <Text style={styles.className}>{cls.title}</Text>
                                            <Text style={styles.classDetail}>{cls.block} • {cls.classmates} classmates</Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyRow}>
                                <Ionicons name="book-outline" size={24} color={colors.textTertiary} />
                                <Text style={styles.emptyText}>No shared classes yet</Text>
                                <Text style={styles.emptySub}>Invite {firstName} to join your classes!</Text>
                            </View>
                        )}
                    </View>

                    {/* Activity */}
                    <Text style={styles.sectionTitle}>Activity</Text>
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="time-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Last Active</Text>
                                <Text style={styles.infoValue}>
                                    {person.status === 'online' ? 'Active now' : person.status === 'studying' ? 'Studying right now' : 'Last seen recently'}
                                </Text>
                            </View>
                        </View>

                        {person.lastMessage ? (
                            <>
                                <View style={styles.separator} />
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIcon}><Ionicons name="chatbubble-outline" size={18} color={colors.maroon} /></View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Last Message</Text>
                                        <Text style={styles.infoValue} numberOfLines={2}>"{person.lastMessage}"</Text>
                                    </View>
                                </View>
                            </>
                        ) : null}
                    </View>

                    <View style={{ height: 40 }} />
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF8F2' },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: 56, paddingBottom: 40 },

    topRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, marginBottom: 24,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 16, backgroundColor: 'white',
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0',
    },
    pageTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },

    avatarSection: { alignItems: 'center', marginBottom: 20 },
    avatarCircle: {
        width: 96, height: 96, borderRadius: 36,
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    displayName: { fontSize: 24, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },

    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 14, borderWidth: 2, borderColor: '#F0E0D0', marginTop: 8,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 12, fontFamily: fonts.semiBold },

    actionsRow: {
        flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 8,
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: 48, borderRadius: 18, backgroundColor: colors.maroon,
    },
    actionBtnOutline: {
        backgroundColor: 'white', borderWidth: 2, borderColor: colors.maroon,
    },
    actionBtnDanger: {
        borderColor: '#b91c1c',
    },
    actionBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },

    sectionTitle: {
        fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary,
        letterSpacing: 0.5, marginTop: 24, marginBottom: 10, paddingHorizontal: 24,
    },

    card: {
        backgroundColor: 'white', borderRadius: 20, marginHorizontal: 20,
        borderWidth: 2, borderColor: '#F0E0D0', overflow: 'hidden',
    },

    infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    infoIcon: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: `${colors.maroon}10`,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary },
    infoValue: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary, marginTop: 2 },

    separator: { height: 1, backgroundColor: '#F0E0D0', marginLeft: 64 },

    classRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    classColorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
    classInfo: { flex: 1 },
    className: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
    classDetail: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 },

    emptyRow: { alignItems: 'center', padding: 24, gap: 6 },
    emptyText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
    emptySub: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
});
