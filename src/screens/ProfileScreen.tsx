import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    StyleSheet,
    Alert,
    Animated,
    Easing,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { friendsDirectory } from '../data/friends';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/storage';
import { normalizeSchoolName } from '../lib/schoolUtils';
import type { UserData, ClassData, FriendData } from '../types';
import { Session } from '@supabase/supabase-js';

interface Props {
    userData: UserData;
    onUpdateProfile: (updates: Partial<UserData>) => Promise<void>;
    onBack: () => void;
    onLogout: () => void;
    classes: ClassData[];
    session: Session | null;
    onPersonOpen?: (person: FriendData) => void;
    onInfoPage?: (page: 'help' | 'terms' | 'privacy') => void;
    onRateApp?: () => void;
    onShareApp?: () => void;
    onReplayTutorial?: () => void;
    onSchoolOpen?: (schoolName: string) => void;
}

// Autocomplete school editing with Supabase-sourced suggestions
function SchoolEditField({ value, onChange, onSave, saveScale, saveSpinInterp }: {
    value: string;
    onChange: (v: string) => void;
    onSave: () => void;
    saveScale: Animated.Value;
    saveSpinInterp: Animated.AnimatedInterpolation<string>;
}) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [allSchools, setAllSchools] = useState<string[]>([]);

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
                    setAllSchools(unique.sort());
                }
            } catch (e) {
                console.log('Error fetching schools:', e);
            }
        })();
    }, []);

    useEffect(() => {
        const q = value.trim().toLowerCase();
        if (!q) { setSuggestions([]); return; }
        setSuggestions(allSchools.filter(s => s.toLowerCase().includes(q)).slice(0, 5));
    }, [value, allSchools]);

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                    style={{
                        flex: 1,
                        fontSize: 15,
                        fontFamily: fonts.medium,
                        color: colors.textPrimary,
                        borderBottomWidth: 1.5,
                        borderBottomColor: colors.maroon,
                        paddingVertical: 4,
                    }}
                    value={value}
                    onChangeText={onChange}
                    autoFocus
                    placeholder="Type school name..."
                    placeholderTextColor={colors.textTertiary}
                />
                <AnimatedPressable onPress={onSave} style={{
                    width: 30, height: 30, borderRadius: 10,
                    backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
                }} scaleDown={0.75}>
                    <Animated.View style={{ transform: [{ rotate: saveSpinInterp }, { scale: saveScale }] }}>
                        <Ionicons name="checkmark" size={16} color="white" />
                    </Animated.View>
                </AnimatedPressable>
            </View>
            {suggestions.length > 0 && (
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: '#F0E0D0',
                    marginTop: 6,
                    overflow: 'hidden',
                }}>
                    {suggestions.map((s, i) => (
                        <TouchableOpacity
                            key={s}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderTopWidth: i > 0 ? 1 : 0,
                                borderTopColor: '#F0E0D0',
                                gap: 8,
                            }}
                            onPress={() => onChange(s)}
                        >
                            <Ionicons name="school-outline" size={14} color={colors.textSecondary} />
                            <Text style={{ fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary }}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

export function ProfileScreen({
    userData,
    onUpdateProfile,
    onBack,
    onLogout,
    classes,
    session,
    onPersonOpen,
    onInfoPage,
    onRateApp,
    onShareApp,
    onReplayTutorial,
    onSchoolOpen
}: Props) {
    const [editName, setEditName] = useState(userData.name || '');
    const [editUsername, setEditUsername] = useState(userData.username || '');
    const [editEmail, setEditEmail] = useState(userData.email || '');
    const [editGrade, setEditGrade] = useState(userData.grade || '');
    const [editSchool, setEditSchool] = useState('');
    const [editingField, setEditingField] = useState<string | null>(null);

    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



    // Entrance animation
    const headerFade = useRef(new Animated.Value(0)).current;
    const headerSlide = useRef(new Animated.Value(-30)).current;
    const contentFade = useRef(new Animated.Value(0)).current;
    const contentSlide = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(headerSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
            Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
        ]).start();
    }, [headerFade, headerSlide, contentFade, contentSlide]);

    // Check username uniqueness
    useEffect(() => {
        if (editingField !== 'username') {
            setUsernameStatus('idle');
            return;
        }

        if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

        const trimmed = editUsername.trim().toLowerCase();
        if (trimmed.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        if (trimmed === userData.username) {
            setUsernameStatus('available');
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
    }, [editUsername, editingField, userData.username]);

    const handlePickedImage = async (uri: string) => {
        if (session?.user?.id) {
            setUploadingAvatar(true);
            const publicUrl = await uploadAvatar(session.user.id, uri);
            setUploadingAvatar(false);

            if (publicUrl) {
                onUpdateProfile({ profilePicture: publicUrl });
            } else {
                Alert.alert('Upload Failed', 'There was an error uploading your profile picture.');
            }
        } else {
            onUpdateProfile({ profilePicture: uri });
        }
    };

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
        if (!result.canceled && result.assets[0]?.uri) {
            await handlePickedImage(result.assets[0].uri);
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
        if (!result.canceled && result.assets[0]?.uri) {
            await handlePickedImage(result.assets[0].uri);
        }
    };

    const pickProfilePicture = () => {
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

    // === Save field microinteraction ===
    const saveScale = useRef(new Animated.Value(1)).current;
    const saveRotation = useRef(new Animated.Value(0)).current;
    const [savedBanner, setSavedBanner] = useState(false);
    const bannerSlide = useRef(new Animated.Value(-50)).current;
    const bannerOpacity = useRef(new Animated.Value(0)).current;

    const saveField = useCallback(async (field: string) => {
        if (field === 'username') {
            if (editUsername.trim().length < 3 || usernameStatus === 'taken' || usernameStatus === 'checking') {
                return; // Block saving
            }
        }

        const updates: Partial<UserData> = {};
        if (field === 'name') updates.name = editName.trim();
        if (field === 'username') updates.username = editUsername.trim().toLowerCase();
        if (field === 'email') updates.email = editEmail.trim().toLowerCase();
        if (field === 'grade') updates.grade = editGrade.trim();
        if (field === 'school') {
            const newSchool = normalizeSchoolName(editSchool);
            // Replace the school being edited, or add if new
            const existingSchools = userData.schools || [];
            if (!existingSchools.includes(newSchool) && newSchool) {
                updates.schools = [...existingSchools, newSchool];
                if (!userData.primarySchool) updates.primarySchool = newSchool;
            }
        }

        setEditingField(null);
        await onUpdateProfile(updates);

        // Save button fold-in: scale pop + rotation
        saveScale.setValue(0.3);
        saveRotation.setValue(0);
        Animated.parallel([
            Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }),
            Animated.timing(saveRotation, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();

        // Saved banner slide down
        setSavedBanner(true);
        bannerSlide.setValue(-40);
        bannerOpacity.setValue(0);
        Animated.parallel([
            Animated.spring(bannerSlide, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 10 }),
            Animated.timing(bannerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
                Animated.timing(bannerSlide, { toValue: -30, duration: 250, useNativeDriver: true }),
            ]).start(() => setSavedBanner(false));
        }, 1600);
    }, [editName, editUsername, editEmail, editGrade, editSchool, usernameStatus, onUpdateProfile, saveScale, saveRotation, bannerSlide, bannerOpacity]);

    const saveSpinInterp = saveRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleLogout = () => {
        Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: onLogout },
        ]);
    };

    // Fetch real schoolmates from Supabase
    const [schoolmates, setSchoolmates] = useState<{id: string; name: string; color: string; status: 'online' | 'studying' | 'offline'; school?: string; avatarUrl?: string | null}[]>([]);
    useEffect(() => {
        if (!userData.schools || userData.schools.length === 0 || !session?.user?.id) return;
        (async () => {
            try {
                // Query schoolmates across all schools
                const { data } = await supabase
                    .from('profiles')
                    .select('id, username, display_name, school, avatar_url')
                    .in('school', userData.schools)
                    .neq('id', session.user.id)
                    .limit(10);
                if (data) {
                    setSchoolmates(data.map((p: any) => ({
                        id: p.id,
                        name: p.display_name || p.username || 'User',
                        color: '#E0E7FF',
                        status: 'offline' as const,
                        school: p.school || '',
                        avatarUrl: p.avatar_url || null,
                    })));
                }
            } catch (e) {
                console.log('Error fetching schoolmates:', e);
            }
        })();
    }, [userData.schools, session?.user?.id]);

    const totalDocs = classes.reduce((a, c) => a + c.documents, 0);
    const totalFiles = classes.reduce((a, c) => a + c.files.length, 0);

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

                    {/* Avatar & Basic Info */}
                    <View style={styles.avatarSection}>
                        <TouchableOpacity style={styles.avatarWrap} onPress={pickProfilePicture} disabled={uploadingAvatar}>
                            {userData.profilePicture ? (
                                <Image source={{ uri: userData.profilePicture }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Ionicons name="person" size={44} color="white" />
                                </View>
                            )}
                            {uploadingAvatar ? (
                                <View style={styles.avatarLoadingOverlay}>
                                    <ActivityIndicator size="small" color="white" />
                                </View>
                            ) : (
                                <View style={styles.cameraBadge}>
                                    <Ionicons name="camera" size={14} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.displayName}>{userData.name || 'Student'}</Text>
                        <Text style={styles.displaySub}>
                            {userData.username ? `${userData.username} • ` : ''}{userData.primarySchool || 'Add your school'}
                        </Text>
                    </View>

                    {/* Quick Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{classes.length}</Text>
                            <Text style={styles.statLabel}>Classes</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{totalDocs}</Text>
                            <Text style={styles.statLabel}>Documents</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{totalFiles}</Text>
                            <Text style={styles.statLabel}>Files</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{friendsDirectory.length}</Text>
                            <Text style={styles.statLabel}>Friends</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Content */}
                <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentSlide }] }}>

                    {/* Profile Info Section */}
                    <Text style={styles.sectionTitle}>Personal Info</Text>
                    <View style={styles.card}>

                        {/* Name */}
                        <TouchableOpacity style={styles.infoRow} onPress={() => setEditingField('name')}>
                            <View style={styles.infoIcon}><Ionicons name="person-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Name</Text>
                                {editingField === 'name' ? (
                                    <View style={styles.editRow}>
                                        <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} autoFocus />
                                        <AnimatedPressable onPress={() => saveField('name')} style={styles.saveSmall} scaleDown={0.75}>
                                            <Animated.View style={{ transform: [{ rotate: saveSpinInterp }, { scale: saveScale }] }}>
                                                <Ionicons name="checkmark" size={16} color="white" />
                                            </Animated.View>
                                        </AnimatedPressable>
                                    </View>
                                ) : (
                                    <Text style={styles.infoValue}>{userData.name || 'Not set'}</Text>
                                )}
                            </View>
                            {editingField !== 'name' && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* Username */}
                        <TouchableOpacity style={styles.infoRow} onPress={() => setEditingField('username')}>
                            <View style={styles.infoIcon}><Ionicons name="at-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Username</Text>
                                {editingField === 'username' ? (
                                    <View style={styles.editRowContainer}>
                                        <View style={styles.editRow}>
                                            <TextInput
                                                style={styles.editInput}
                                                value={editUsername}
                                                onChangeText={(t) => setEditUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                autoFocus
                                            />
                                            {usernameStatus === 'checking' && (
                                                <ActivityIndicator size="small" color={colors.maroon} style={{ marginRight: 8 }} />
                                            )}
                                            {usernameStatus === 'taken' && (
                                                <Ionicons name="close-circle" size={20} color="#dc2626" style={{ marginRight: 8 }} />
                                            )}
                                            <AnimatedPressable
                                                onPress={() => saveField('username')}
                                                style={[styles.saveSmall, (usernameStatus === 'taken' || usernameStatus === 'checking' || editUsername.trim().length < 3) && { backgroundColor: '#ccc' }]}
                                                scaleDown={0.75}
                                            >
                                                <Animated.View style={{ transform: [{ rotate: saveSpinInterp }, { scale: saveScale }] }}>
                                                    <Ionicons name="checkmark" size={16} color="white" />
                                                </Animated.View>
                                            </AnimatedPressable>
                                        </View>
                                        {usernameStatus === 'taken' && <Text style={styles.editErrorHint}>Username is taken.</Text>}
                                    </View>
                                ) : (
                                    <Text style={styles.infoValue}>{userData.username ? `@${userData.username}` : 'Not set'}</Text>
                                )}
                            </View>
                            {editingField !== 'username' && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* Email */}
                        <TouchableOpacity style={styles.infoRow} onPress={() => setEditingField('email')}>
                            <View style={styles.infoIcon}><Ionicons name="mail-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Email</Text>
                                {editingField === 'email' ? (
                                    <View style={styles.editRow}>
                                        <TextInput style={styles.editInput} value={editEmail} onChangeText={setEditEmail} autoCapitalize="none" keyboardType="email-address" autoFocus />
                                        <AnimatedPressable onPress={() => saveField('email')} style={styles.saveSmall} scaleDown={0.75}>
                                            <Animated.View style={{ transform: [{ rotate: saveSpinInterp }, { scale: saveScale }] }}>
                                                <Ionicons name="checkmark" size={16} color="white" />
                                            </Animated.View>
                                        </AnimatedPressable>
                                    </View>
                                ) : (
                                    <Text style={styles.infoValue}>{userData.email || 'Not set'}</Text>
                                )}
                            </View>
                            {editingField !== 'email' && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* Grade */}
                        <TouchableOpacity style={styles.infoRow} onPress={() => setEditingField('grade')}>
                            <View style={styles.infoIcon}><Ionicons name="school-outline" size={18} color={colors.maroon} /></View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Grade / Year</Text>
                                {editingField === 'grade' ? (
                                    <View style={styles.editRow}>
                                        <TextInput style={styles.editInput} value={editGrade} onChangeText={setEditGrade} autoFocus />
                                        <AnimatedPressable onPress={() => saveField('grade')} style={styles.saveSmall} scaleDown={0.75}>
                                            <Animated.View style={{ transform: [{ rotate: saveSpinInterp }, { scale: saveScale }] }}>
                                                <Ionicons name="checkmark" size={16} color="white" />
                                            </Animated.View>
                                        </AnimatedPressable>
                                    </View>
                                ) : (
                                    <Text style={styles.infoValue}>{userData.grade || 'Not set'}</Text>
                                )}
                            </View>
                            {editingField !== 'grade' && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        {/* Schools (Multi-School) */}
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="business-outline" size={18} color={colors.maroon} /></View>
                            <View style={[styles.infoContent, { flex: 1 }]}>
                                <Text style={styles.infoLabel}>Schools</Text>
                                {userData.schools && userData.schools.length > 0 ? (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        {userData.schools.map((s, i) => (
                                            <TouchableOpacity
                                                key={s}
                                                onLongPress={() => {
                                                    Alert.alert(s, 'What would you like to do?', [
                                                        { text: 'Set as Primary', onPress: () => onUpdateProfile({ primarySchool: s, schools: [s, ...userData.schools.filter(x => x !== s)] }) },
                                                        { text: 'Remove', style: 'destructive', onPress: () => {
                                                            const newSchools = userData.schools.filter(x => x !== s);
                                                            onUpdateProfile({
                                                                schools: newSchools,
                                                                primarySchool: newSchools[0] || '',
                                                            });
                                                        }},
                                                        { text: 'Cancel', style: 'cancel' },
                                                    ]);
                                                }}
                                                onPress={() => onSchoolOpen?.(s)}
                                                style={{
                                                    flexDirection: 'row', alignItems: 'center', gap: 6,
                                                    backgroundColor: s === userData.primarySchool ? `${colors.maroon}14` : '#F3F4F6',
                                                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
                                                    borderWidth: 1.5, borderColor: s === userData.primarySchool ? colors.maroon : '#E5E7EB',
                                                }}
                                            >
                                                <Ionicons name="school" size={13} color={s === userData.primarySchool ? colors.maroon : '#6B7280'} />
                                                <Text style={{ fontSize: 13, fontFamily: fonts.semiBold, color: s === userData.primarySchool ? colors.maroon : '#374151' }}>{s}</Text>
                                                {s === userData.primarySchool && (
                                                    <View style={{ backgroundColor: colors.maroon, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                                                        <Text style={{ fontSize: 8, fontFamily: fonts.bold, color: 'white' }}>PRIMARY</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.infoValue}>No schools added</Text>
                                )}
                                {/* Add school button */}
                                <TouchableOpacity
                                    onPress={() => setEditingField('school')}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
                                >
                                    <Ionicons name="add-circle-outline" size={18} color={colors.maroon} />
                                    <Text style={{ fontSize: 13, fontFamily: fonts.semiBold, color: colors.maroon }}>Add School</Text>
                                </TouchableOpacity>
                                {editingField === 'school' && (
                                    <View style={{ marginTop: 8 }}>
                                        <SchoolEditField
                                            value={editSchool}
                                            onChange={setEditSchool}
                                            onSave={() => saveField('school')}
                                            saveScale={saveScale}
                                            saveSpinInterp={saveSpinInterp}
                                        />
                                    </View>
                                )}
                                <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 6 }}>Long press a school to set as primary or remove</Text>
                            </View>
                        </View>
                    </View>

                    {/* People at your schools — Redesigned */}
                    {userData.schools && userData.schools.length > 0 ? (
                        <>
                            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Your Schools</Text>
                            {userData.schools.map((schoolName) => {
                                const membersAtSchool = schoolmates.filter(p => p.school === schoolName);
                                return (
                                    <TouchableOpacity
                                        key={schoolName}
                                        style={{
                                            backgroundColor: 'white', borderRadius: 20, padding: 16,
                                            marginHorizontal: 24, marginBottom: 10,
                                            borderWidth: 1.5, borderColor: schoolName === userData.primarySchool ? colors.maroon : '#F0E0D0',
                                            flexDirection: 'row', alignItems: 'center', gap: 14,
                                        }}
                                        onPress={() => onSchoolOpen?.(schoolName)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{
                                            width: 48, height: 48, borderRadius: 16,
                                            backgroundColor: schoolName === userData.primarySchool ? `${colors.maroon}18` : '#F3F4F6',
                                            alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Ionicons name="school" size={22} color={schoolName === userData.primarySchool ? colors.maroon : '#6B7280'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 2 }}>{schoolName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                {membersAtSchool.slice(0, 3).map((m, idx) => (
                                                    <View key={m.id} style={{
                                                        width: 22, height: 22, borderRadius: 11,
                                                        backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center',
                                                        marginLeft: idx > 0 ? -8 : 0, borderWidth: 2, borderColor: 'white',
                                                        overflow: 'hidden',
                                                    }}>
                                                        {m.avatarUrl ? (
                                                            <Image source={{ uri: m.avatarUrl }} style={{ width: 22, height: 22, borderRadius: 11 }} />
                                                        ) : (
                                                            <Ionicons name="person" size={10} color="#6366f1" />
                                                        )}
                                                    </View>
                                                ))}
                                                <Text style={{ fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary }}>
                                                    {membersAtSchool.length > 0 ? `${membersAtSchool.length} member${membersAtSchool.length > 1 ? 's' : ''}` : 'No members yet'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    ) : null}

                    {/* Settings */}
                    <Text style={styles.sectionTitle}>Settings</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.menuRow} onPress={onReplayTutorial}>
                            <View style={styles.infoIcon}><Ionicons name="play-circle-outline" size={18} color={colors.maroon} /></View>
                            <Text style={styles.menuLabel}>Replay Tutorial</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* More Options */}
                    <Text style={styles.sectionTitle}>More</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.menuRow} onPress={() => onInfoPage?.('help')}>
                            <View style={styles.infoIcon}><Ionicons name="help-circle-outline" size={18} color={colors.maroon} /></View>
                            <Text style={styles.menuLabel}>Help & Support</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.menuRow} onPress={() => onInfoPage?.('terms')}>
                            <View style={styles.infoIcon}><Ionicons name="document-text-outline" size={18} color={colors.maroon} /></View>
                            <Text style={styles.menuLabel}>Terms of Service</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.menuRow} onPress={() => onInfoPage?.('privacy')}>
                            <View style={styles.infoIcon}><Ionicons name="shield-outline" size={18} color={colors.maroon} /></View>
                            <Text style={styles.menuLabel}>Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.menuRow} onPress={onRateApp}>
                            <View style={styles.infoIcon}><Ionicons name="star-outline" size={18} color={colors.maroon} /></View>
                            <Text style={styles.menuLabel}>Rate Citadel</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.menuRow} onPress={onShareApp}>
                            <View style={styles.infoIcon}><Ionicons name="share-social-outline" size={18} color={colors.maroon} /></View>
                            <Text style={styles.menuLabel}>Share with Friends</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Log Out */}
                    <AnimatedPressable style={styles.logoutBtn} onPress={handleLogout} scaleDown={0.96}>
                        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </AnimatedPressable>

                    {/* Version */}
                    <Text style={styles.versionText}>Citadel v1.0.0</Text>

                </Animated.View>
            </ScrollView>

            {/* Saved banner */}
            {savedBanner && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 54,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        zIndex: 999,
                        opacity: bannerOpacity,
                        transform: [{ translateY: bannerSlide }],
                    }}
                >
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#059669',
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 16,
                        gap: 8,
                        shadowColor: '#059669',
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 2 },
                    }}>
                        <Ionicons name="checkmark-circle" size={18} color="white" />
                        <Text style={{ color: 'white', fontFamily: fonts.bold, fontSize: 13 }}>Saved!</Text>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF8F2' },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: 56, paddingBottom: 60 },

    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: 16,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#F0E0D0',
    },
    pageTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },

    avatarSection: { alignItems: 'center', marginBottom: 12 },
    avatarWrap: { width: 96, height: 96, borderRadius: 36, marginBottom: 14 },
    avatar: { width: 96, height: 96, borderRadius: 36 },
    avatarPlaceholder: {
        width: 96,
        height: 96,
        borderRadius: 36,
        backgroundColor: colors.maroon,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLoadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 36,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.maroon,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFF8F2',
    },
    displayName: { fontSize: 24, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
    displaySub: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4 },

    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 24,
        marginHorizontal: 20,
        paddingVertical: 18,
        borderWidth: 2,
        borderColor: '#F0E0D0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },
    statLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: '#F0E0D0' },

    sectionTitle: {
        fontSize: 14,
        fontFamily: fonts.bold,
        color: colors.textSecondary,
        letterSpacing: 0.5,
        marginTop: 24,
        marginBottom: 10,
        paddingHorizontal: 24,
    },

    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        marginHorizontal: 20,
        borderWidth: 2,
        borderColor: '#F0E0D0',
        overflow: 'hidden',
    },

    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: `${colors.maroon}10`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary },
    infoValue: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary, marginTop: 2 },

    editRowContainer: {
        flexDirection: 'column',
    },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    editInput: {
        flex: 1,
        height: 38,
        borderRadius: 14,
        backgroundColor: '#FFF5ED',
        paddingHorizontal: 12,
        fontSize: 14,
        fontFamily: fonts.medium,
        color: colors.textPrimary,
        borderWidth: 2,
        borderColor: '#F0E0D0',
    },
    editErrorHint: {
        fontSize: 11,
        color: '#dc2626',
        marginTop: 4,
    },
    saveSmall: {
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: colors.maroon,
        alignItems: 'center',
        justifyContent: 'center',
    },

    separator: { height: 1, backgroundColor: '#F0E0D0', marginLeft: 64 },

    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    personAvatar: {
        width: 36,
        height: 36,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    personInfo: { flex: 1 },
    personName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
    personStatus: { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 },

    emptySchool: { alignItems: 'center', padding: 24, gap: 6 },
    emptySchoolText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
    emptySchoolSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },



    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuLabel: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary, marginLeft: 12 },

    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginTop: 28,
        height: 52,
        borderRadius: 20,
        backgroundColor: '#fef2f2',
        borderWidth: 2,
        borderColor: '#fecaca',
    },
    logoutText: { fontSize: 15, fontFamily: fonts.bold, color: '#dc2626' },

    versionText: {
        textAlign: 'center',
        fontSize: 12,
        fontFamily: fonts.regular,
        color: colors.textTertiary,
        marginTop: 16,
        marginBottom: 30,
    },
});
