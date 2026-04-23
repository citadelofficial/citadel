import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    StyleSheet,
    Animated,
    Share,
    Alert,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { AnimatedPressable } from '../components/AnimatedPressable';
import type { FriendData, ClassData } from '../types';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface Props {
    person: FriendData;
    onBack: () => void;
    onChat: () => void;
    classes: ClassData[];
    isFriend: boolean;
    onAddFriend: (personId: string) => void;
    onRemoveFriend: (personId: string) => void;
    onSchoolOpen?: (schoolName: string) => void;
    onSendClassInvite?: (toUserId: string, classes: ClassData[]) => void;
    session?: Session | null;
}

export function PersonProfileScreen({ person, onBack, onChat, classes, isFriend, onAddFriend, onRemoveFriend, onSchoolOpen, onSendClassInvite, session }: Props) {
    const headerFade = useRef(new Animated.Value(0)).current;
    const headerSlide = useRef(new Animated.Value(-30)).current;
    const contentFade = useRef(new Animated.Value(0)).current;
    const contentSlide = useRef(new Animated.Value(20)).current;
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());

    // Live profile data — fetched from Supabase on mount to ensure freshness
    const [livePerson, setLivePerson] = useState<FriendData>(person);

    useEffect(() => {
        // Fetch the latest profile data from Supabase
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, display_name, school, grade, avatar_url')
                    .eq('id', person.id)
                    .maybeSingle();

                if (data && !error) {
                    setLivePerson(prev => ({
                        ...prev,
                        name: data.display_name || data.username || prev.name,
                        school: data.school || prev.school,
                        grade: data.grade || prev.grade,
                        avatarUrl: data.avatar_url || prev.avatarUrl,
                    }));
                }
            } catch (err) {
                console.log('Error fetching live profile:', err);
            }
        })();
    }, [person.id]);

    const firstName = livePerson.name.split(' ')[0];

    const toggleClass = (id: string) => {
        setSelectedClassIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSendInvite = async () => {
        const selected = classes.filter(c => selectedClassIds.has(c.id));
        if (selected.length === 0) {
            Alert.alert('Select Classes', 'Pick at least one class to invite to.');
            return;
        }
        setShowInviteModal(false);
        if (onSendClassInvite) {
            onSendClassInvite(person.id, selected);
            Alert.alert('Invite Sent!', `${firstName} will see your class invite${selected.length > 1 ? 's' : ''} in their notifications.`);
        } else {
            // Fallback to Share sheet if handler not provided
            const classList = selected.map(c => `• ${c.title} (${c.block}) — Code: ${c.classCode}`).join('\n');
            try {
                await Share.share({
                    message: `Hey ${firstName}! I'd love for you to join ${selected.length === 1 ? 'my class' : 'my classes'} on Citadel:\n\n${classList}\n\nOpen Citadel → tap "Join Existing Class" → enter the code above to join!`,
                });
            } catch {}
        }
        setSelectedClassIds(new Set());
    };

    const openInviteModal = () => {
        if (classes.length === 0) {
            Alert.alert('No Classes', 'You don\'t have any classes to invite to yet.');
            return;
        }
        setSelectedClassIds(new Set());
        setShowInviteModal(true);
    };

    useEffect(() => {
        Animated.parallel([
            Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(headerSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
            Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
        ]).start();
    }, [headerFade, headerSlide, contentFade, contentSlide]);



    // Find shared classes by checking if person.name is in classmateNames
    const sharedClasses = useMemo(() => {
        return classes.filter(cls =>
            cls.classmateNames?.some(n => n.toLowerCase() === person.name.toLowerCase()) ||
            (person.course && cls.title.toLowerCase().includes(person.course.toLowerCase().replace('ap ', '')))
        );
    }, [classes, person]);

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
                        <View style={[styles.avatarCircle, { backgroundColor: livePerson.color, overflow: 'hidden' }]}>
                            {livePerson.avatarUrl ? (
                                <Image source={{ uri: livePerson.avatarUrl }} style={{ width: 96, height: 96, borderRadius: 36 }} />
                            ) : (
                                <Ionicons name="person" size={44} color={colors.maroon} />
                            )}
                        </View>
                        <Text style={styles.displayName}>{livePerson.name}</Text>
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
                                onRemoveFriend(livePerson.id);
                            } else {
                                onAddFriend(livePerson.id);
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
                                <Text style={styles.infoValue}>{livePerson.name}</Text>
                            </View>
                        </View>

                        <View style={styles.separator} />

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="school-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Grade</Text>
                                <Text style={styles.infoValue}>{livePerson.grade || 'Not shared'}</Text>
                            </View>
                        </View>

                        <View style={styles.separator} />

                        <TouchableOpacity
                            style={styles.infoRow}
                            onPress={() => livePerson.school && onSchoolOpen?.(livePerson.school)}
                            activeOpacity={livePerson.school ? 0.7 : 1}
                        >
                            <View style={styles.infoIcon}><Ionicons name="business-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>School</Text>
                                <Text style={[styles.infoValue, livePerson.school && { color: colors.maroon }]}>{livePerson.school || 'Not shared'}</Text>
                            </View>
                            {livePerson.school ? <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} /> : null}
                        </TouchableOpacity>

                        {livePerson.course ? (
                            <>
                                <View style={styles.separator} />
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIcon}><Ionicons name="book-outline" size={18} color={colors.maroon} /></View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Studying</Text>
                                        <Text style={styles.infoValue}>{livePerson.course}</Text>
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
                                <TouchableOpacity
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        marginTop: 8,
                                        backgroundColor: colors.maroon,
                                        paddingHorizontal: 18,
                                        paddingVertical: 10,
                                        borderRadius: 14,
                                    }}
                                    onPress={openInviteModal}
                                >
                                    <Ionicons name="paper-plane" size={14} color="white" />
                                    <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: 'white' }}>Invite {firstName} to Your Classes</Text>
                                </TouchableOpacity>
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
                                <Text style={styles.infoValue}>Last seen recently</Text>
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

            {/* Invite to Classes Modal */}
            <Modal visible={showInviteModal} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{
                        backgroundColor: '#FFF8F2',
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingTop: 20,
                        paddingBottom: 40,
                        paddingHorizontal: 24,
                        maxHeight: '70%',
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <Text style={{ fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 }}>
                                Invite {firstName}
                            </Text>
                            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                                <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 16 }}>
                            Which classes do you want to invite {firstName} to?
                        </Text>
                        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                            {classes.map((cls) => {
                                const isSelected = selectedClassIds.has(cls.id);
                                return (
                                    <TouchableOpacity
                                        key={cls.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: isSelected ? `${colors.maroon}12` : 'white',
                                            borderRadius: 18,
                                            padding: 14,
                                            marginBottom: 8,
                                            borderWidth: 2,
                                            borderColor: isSelected ? colors.maroon : '#F0E0D0',
                                        }}
                                        onPress={() => toggleClass(cls.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.classColorDot, { backgroundColor: cls.color, marginRight: 12 }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary }}>{cls.title}</Text>
                                            <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 }}>{cls.block}</Text>
                                        </View>
                                        <View style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 13,
                                            borderWidth: 2,
                                            borderColor: isSelected ? colors.maroon : '#D0C0B0',
                                            backgroundColor: isSelected ? colors.maroon : 'transparent',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                backgroundColor: selectedClassIds.size > 0 ? colors.maroon : '#D0C0B0',
                                borderRadius: 18,
                                paddingVertical: 16,
                                marginTop: 16,
                            }}
                            onPress={handleSendInvite}
                            disabled={selectedClassIds.size === 0}
                        >
                            <Ionicons name="paper-plane" size={16} color="white" />
                            <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: 'white' }}>
                                Send Invite{selectedClassIds.size > 0 ? ` (${selectedClassIds.size} ${selectedClassIds.size === 1 ? 'class' : 'classes'})` : ''}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
