import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import type { FriendData, ClassData } from '../types';

interface SchoolMember {
  id: string;
  name: string;
  username: string;
  grade: string;
  avatarUrl: string | null;
}

interface Props {
  schoolName: string;
  onBack: () => void;
  onPersonOpen: (person: FriendData) => void;
  classes: ClassData[];
  currentUserId: string | null;
  onAddClass?: (classData: ClassData) => void;
  onCourseOpen?: (classId: string) => void;
}

export function SchoolScreen({ schoolName, onBack, onPersonOpen, classes, currentUserId, onAddClass, onCourseOpen }: Props) {
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Entrance animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Run all entrance animations in parallel to eliminate lag
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(contentSlide, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
  }, [headerFade, headerSlide, contentFade, contentSlide]);

  // Fetch all members at this school
  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        // Run two separate queries to avoid PostgREST .or() parsing issues
        // with school names that contain spaces
        const allProfiles: any[] = [];

        // Query 1: Match on the old `school` string column
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, display_name, grade, avatar_url')
            .eq('school', schoolName);
          if (data) allProfiles.push(...data);
        } catch {}

        // Query 2: Match on the new `schools` JSONB array column
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, display_name, grade, avatar_url')
            .contains('schools', [schoolName]);
          if (data) allProfiles.push(...data);
        } catch {}

        // Deduplicate by id
        const seen = new Set<string>();
        const mapped: SchoolMember[] = [];
        for (const p of allProfiles) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          mapped.push({
            id: p.id,
            name: p.display_name || p.username || 'User',
            username: p.username || '',
            grade: p.grade || '',
            avatarUrl: p.avatar_url || null,
          });
        }
        setMembers(mapped);
      } catch (err) {
        console.error('Error fetching school members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [schoolName, currentUserId]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  // School classes (discovered from all members' class_codes)
  const [schoolClasses, setSchoolClasses] = useState<{title: string; block: string; code: string; memberCount: number; teacher?: string; classData?: ClassData}[]>([]);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [expandedClassTitle, setExpandedClassTitle] = useState<string | null>(null);
  const [schoolImage, setSchoolImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fetch school image from schools_meta
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('schools_meta')
          .select('image_url')
          .eq('school_name', schoolName)
          .maybeSingle();
        if (data?.image_url) setSchoolImage(data.image_url);
      } catch (e) {
        console.log('School image fetch error:', e);
      }
    })();
  }, [schoolName]);

  // Fetch school-wide classes from multiple sources
  useEffect(() => {
    (async () => {
      try {
        const classMap: Record<string, { title: string; block: string; code: string; color: string; count: number; teacher?: string; fullClassData?: ClassData }> = {};

        // Source 1: profiles.class_codes for members at this school
        // Query using both schools array and school string
        try {
          const profilesWithCodes: any[] = [];

          try {
            const { data: arrayData } = await supabase
              .from('profiles')
              .select('class_codes')
              .contains('schools', [schoolName])
              .not('class_codes', 'is', null);
            if (arrayData) profilesWithCodes.push(...arrayData);
          } catch {}

          try {
            const { data: singleData } = await supabase
              .from('profiles')
              .select('class_codes')
              .eq('school', schoolName)
              .not('class_codes', 'is', null);
            if (singleData) profilesWithCodes.push(...singleData);
          } catch {}

          for (const profile of profilesWithCodes) {
            const codes = profile.class_codes;
            if (codes && typeof codes === 'object') {
              for (const [code, info] of Object.entries(codes as Record<string, any>)) {
                // Include if class has no school field OR if class school matches this school
                const classSchool = info.school || '';
                if (classSchool && classSchool.toLowerCase() !== schoolName.toLowerCase()) continue;
                if (!classMap[code]) {
                  classMap[code] = { title: info.title || 'Untitled', block: info.block || '', code, color: info.color || '', count: 0, teacher: info.teacher || '' };
                }
                classMap[code].count++;
              }
            }
          }
        } catch {
          // class_codes column may not exist
        }

        // Source 2: class_code_registry table (classes with school field in class_data)
        try {
          const { data: registryData } = await supabase
            .from('class_code_registry')
            .select('class_code, class_data, owner_id');

          if (registryData) {
            for (const row of registryData) {
              const classData = row.class_data as any;
              if (!classData) continue;
              const classSchool = classData.school || '';
              if (classSchool.toLowerCase() !== schoolName.toLowerCase()) continue;
              const code = row.class_code;
              if (!classMap[code]) {
                classMap[code] = { title: classData.title || 'Untitled', block: classData.block || '', code, color: classData.color || '', count: 0, teacher: classData.teacher || '', fullClassData: classData as ClassData };
              }
              classMap[code].count++;
            }
          }
        } catch {
          // Registry table may not exist
        }

        // Source 3: Also include the user's own local classes that belong to this school
        for (const cls of classes) {
          if (cls.school && cls.school.toLowerCase() === schoolName.toLowerCase()) {
            const code = cls.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (!classMap[code]) {
              classMap[code] = { title: cls.title, block: cls.block, code, color: cls.color, count: 0, teacher: cls.teacher || '' };
            }
            // Ensure at least 1 for the current user
            if (classMap[code].count === 0) classMap[code].count = 1;
          }
        }

        setSchoolClasses(Object.values(classMap).map(c => ({
          title: c.title, block: c.block, code: c.code, memberCount: c.count, teacher: c.teacher, classData: c.fullClassData,
        })));
      } catch (e) {
        console.log('School classes fetch error:', e);
      }
    })();
  }, [schoolName, classes]);

  const filteredClasses = useMemo(() => {
    const q = classSearchQuery.trim().toLowerCase();
    if (!q) return schoolClasses;
    return schoolClasses.filter(c => c.title.toLowerCase().includes(q));
  }, [schoolClasses, classSearchQuery]);

  // Group classes by title for accordion view
  const groupedClasses = useMemo(() => {
    const groups: Record<string, typeof filteredClasses> = {};
    for (const cls of filteredClasses) {
      const key = cls.title.trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(cls);
    }
    // Sort groups alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredClasses]);

  const handleUploadSchoolImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingImage(true);
    try {
      const fileName = `school_${schoolName.replace(/\s/g, '_')}_${Date.now()}.jpg`;
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from('school-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        // Fallback: store the local URI
        setSchoolImage(result.assets[0].uri);
        await supabase.from('schools_meta').upsert({
          school_name: schoolName,
          image_url: result.assets[0].uri,
          updated_at: new Date().toISOString(),
        });
      } else {
        const { data: urlData } = supabase.storage.from('school-images').getPublicUrl(data.path);
        setSchoolImage(urlData.publicUrl);
        await supabase.from('schools_meta').upsert({
          school_name: schoolName,
          image_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.log('School image upload error:', e);
      setSchoolImage(result.assets[0].uri);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMemberPress = (member: SchoolMember) => {
    const friendData: FriendData = {
      id: member.id,
      name: member.name,
      color: '#E0E7FF',
      status: 'offline',
      grade: member.grade,
      school: schoolName,
      avatarUrl: member.avatarUrl,
    };
    onPersonOpen(friendData);
  };

  // Color palette for member avatars
  const avatarColors = ['#E0E7FF', '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE', '#FFEDD5'];

  // Generate and share invite code
  const handleInvite = async () => {
    try {
      // Generate a short 6-char alphanumeric code from the school name
      let hash = 0;
      for (let i = 0; i < schoolName.length; i++) {
        const char = schoolName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
      let code = '';
      let h = Math.abs(hash);
      for (let i = 0; i < 6; i++) {
        code += chars[h % chars.length];
        h = Math.floor(h / chars.length);
      }

      // Store the code mapping in schools_meta
      try {
        await supabase.from('schools_meta').upsert({
          school_name: schoolName,
          invite_code: code,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.log('Error saving invite code:', e);
      }

      await Share.share({
        message: `Join me at ${schoolName} on Citadel! Use this invite code when you sign up:\n\n${code}\n\nDownload Citadel to get started!`,
      });
    } catch (err) {
      // User cancelled share
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
          <View style={styles.topRow}>
            <AnimatedPressable onPress={onBack} style={styles.backBtn} scaleDown={0.88}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </AnimatedPressable>
            <Text style={styles.pageTitle}>School</Text>
            <View style={{ width: 42 }} />
          </View>

          {/* School Hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="school" size={36} color="white" />
              </View>
              <TouchableOpacity
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
                }}
                onPress={handleUploadSchoolImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={18} color="white" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.heroName}>{schoolName}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="people" size={14} color={colors.maroon} />
                <Text style={styles.heroBadgeText}>
                  {loading ? '...' : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                </Text>
              </View>
              {schoolClasses.length > 0 && (
                <View style={styles.heroBadge}>
                  <Ionicons name="book" size={14} color={colors.maroon} />
                  <Text style={styles.heroBadgeText}>
                    {schoolClasses.length} {schoolClasses.length === 1 ? 'class' : 'classes'}
                  </Text>
                </View>
              )}
            </View>

            {/* Invite Button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 20,
                marginTop: 14,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.3)',
              }}
              onPress={handleInvite}
              activeOpacity={0.7}
            >
              <Ionicons name="paper-plane" size={16} color="white" />
              <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: 'white' }}>Invite Members</Text>
            </TouchableOpacity>
          </View>

          {/* School Photo Card (separate from hero) */}
          {schoolImage && (
            <View style={styles.schoolImageCard}>
              <Image
                source={{ uri: schoolImage }}
                style={styles.schoolImageThumbnail}
                resizeMode="cover"
              />
              <View style={styles.schoolImageOverlay}>
                <Ionicons name="image" size={14} color="white" />
                <Text style={{ fontSize: 12, fontFamily: fonts.semiBold, color: 'white' }}>School Photo</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Content */}
        <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentSlide }] }}>

          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Members */}
          <Text style={styles.sectionTitle}>Members</Text>
          <View style={styles.card}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={colors.maroon} />
                <Text style={styles.loadingText}>Loading members...</Text>
              </View>
            ) : filteredMembers.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="people-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No members found' : 'No other members yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Invite friends from your school to join Citadel!'}
                </Text>
              </View>
            ) : (
              filteredMembers.filter(m => m.id !== currentUserId).map((member, index) => (
                <View key={member.id}>
                  {index > 0 && <View style={styles.separator} />}
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => handleMemberPress(member)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
                      {member.avatarUrl ? (
                        <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatarImage} />
                      ) : (
                        <Ionicons name="person" size={18} color="#6366f1" />
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberMeta}>
                        {member.username ? `@${member.username}` : ''}
                        {member.username && member.grade ? ' • ' : ''}
                        {member.grade || ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* School Classes */}
          <Text style={styles.sectionTitle}>Classes at {schoolName}</Text>
          <View style={[styles.searchBox, { marginBottom: 12 }]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search classes..."
              placeholderTextColor={colors.textTertiary}
              value={classSearchQuery}
              onChangeText={setClassSearchQuery}
            />
          </View>
          {groupedClasses.length > 0 ? (
            <View style={styles.card}>
              {groupedClasses.map(([title, variants], gi) => {
                const isExpanded = expandedClassTitle === title;
                const totalMembers = variants.reduce((a, v) => a + v.memberCount, 0);
                // Check if user is in any variant of this class
                const userVariant = variants.find((v) => {
                  const norm = v.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  return classes.some((c) => c.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === norm);
                });

                // Single variant — direct action
                if (variants.length === 1) {
                  const cls = variants[0];
                  const normalizedCode = cls.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  const localClass = classes.find(
                    (c) => c.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === normalizedCode
                  );
                  const isJoined = !!localClass;

                  const handlePress = () => {
                    if (isJoined && localClass && onCourseOpen) {
                      onCourseOpen(localClass.id);
                    } else if (!isJoined && onAddClass) {
                      Alert.alert(
                        `Join ${cls.title}?`,
                        `${cls.block}${cls.teacher ? ` • ${cls.teacher}` : ''}\nThis will add "${cls.title}" to your classes.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Join Class',
                            onPress: () => {
                              const newClass: ClassData = cls.classData
                                ? { ...cls.classData, id: Date.now().toString(), school: schoolName }
                                : {
                                  id: Date.now().toString(),
                                  title: cls.title, block: cls.block, classCode: cls.code,
                                  image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=500&fit=crop',
                                  classmates: cls.memberCount + 1, documents: 0, color: colors.maroon,
                                  description: `Joined from ${schoolName}`, files: [], units: [],
                                  school: schoolName, teacher: cls.teacher,
                                };
                              onAddClass(newClass);
                              Alert.alert('Joined!', `You've been added to ${cls.title}.`);
                            },
                          },
                        ]
                      );
                    }
                  };

                  return (
                    <View key={cls.code}>
                      {gi > 0 && <View style={styles.separator} />}
                      <TouchableOpacity style={styles.classRow} onPress={handlePress} activeOpacity={0.7}>
                        <View style={[styles.classColorDot, { backgroundColor: colors.maroon }]} />
                        <View style={styles.classInfo}>
                          <Text style={styles.className}>{cls.title}</Text>
                          <Text style={styles.classDetail}>
                            {cls.block}{cls.teacher ? ` • ${cls.teacher}` : ''} • {cls.memberCount} member{cls.memberCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                        {isJoined ? (
                          <View style={styles.joinedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={styles.joinedBadgeText}>Joined</Text>
                          </View>
                        ) : (
                          <View style={styles.joinBtn}>
                            <Ionicons name="add" size={14} color="white" />
                            <Text style={styles.joinBtnText}>Join</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                }

                // Multiple variants — accordion
                return (
                  <View key={title}>
                    {gi > 0 && <View style={styles.separator} />}
                    <TouchableOpacity
                      style={styles.classRow}
                      onPress={() => setExpandedClassTitle(isExpanded ? null : title)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.classColorDot, { backgroundColor: colors.maroon }]} />
                      <View style={styles.classInfo}>
                        <Text style={styles.className}>{title}</Text>
                        <Text style={styles.classDetail}>
                          {variants.length} block{variants.length > 1 ? 's' : ''} • {totalMembers} member{totalMembers > 1 ? 's' : ''}
                        </Text>
                      </View>
                      {userVariant && (
                        <View style={[styles.joinedBadge, { marginRight: 8 }]}>
                          <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        </View>
                      )}
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.blockList}>
                        {variants.map((cls) => {
                          const normalizedCode = cls.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                          const localClass = classes.find(
                            (c) => c.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === normalizedCode
                          );
                          const isJoined = !!localClass;

                          const handleBlockPress = () => {
                            if (isJoined && localClass && onCourseOpen) {
                              onCourseOpen(localClass.id);
                            } else if (!isJoined && onAddClass) {
                              Alert.alert(
                                `Join ${cls.title}?`,
                                `${cls.block}${cls.teacher ? ` • Teacher: ${cls.teacher}` : ''}\n${cls.memberCount} member${cls.memberCount > 1 ? 's' : ''}`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Join',
                                    onPress: () => {
                                      const newClass: ClassData = cls.classData
                                        ? { ...cls.classData, id: Date.now().toString(), school: schoolName }
                                        : {
                                          id: Date.now().toString(),
                                          title: cls.title, block: cls.block, classCode: cls.code,
                                          image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=500&fit=crop',
                                          classmates: cls.memberCount + 1, documents: 0, color: colors.maroon,
                                          description: `Joined from ${schoolName}`, files: [], units: [],
                                          school: schoolName, teacher: cls.teacher,
                                        };
                                      onAddClass(newClass);
                                      Alert.alert('Joined!', `You've been added to ${cls.title} (${cls.block}).`);
                                    },
                                  },
                                ]
                              );
                            }
                          };

                          return (
                            <TouchableOpacity key={cls.code} style={styles.blockRow} onPress={handleBlockPress} activeOpacity={0.7}>
                              <View style={styles.blockDot} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.blockTitle}>{cls.block}</Text>
                                <Text style={styles.blockSub}>
                                  {cls.teacher ? `${cls.teacher} • ` : ''}{cls.memberCount} member{cls.memberCount > 1 ? 's' : ''}
                                </Text>
                              </View>
                              {isJoined ? (
                                <View style={styles.joinedBadge}>
                                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                                  <Text style={styles.joinedBadgeText}>Joined</Text>
                                </View>
                              ) : (
                                <View style={styles.joinBtn}>
                                  <Ionicons name="add" size={14} color="white" />
                                  <Text style={styles.joinBtnText}>Join</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
              <Ionicons name="book-outline" size={28} color={colors.textTertiary} />
              <Text style={{ fontSize: 14, fontFamily: fonts.medium, color: colors.textTertiary, marginTop: 8 }}>No classes found at this school yet</Text>
            </View>
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
  scrollContent: { paddingTop: 56, paddingBottom: 40 },

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 20,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 16, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0',
  },
  pageTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },

  heroCard: {
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 28,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -60,
    top: -80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroName: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: 'white',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  heroBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.maroon,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#F0E0D0',
    paddingHorizontal: 14,
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },

  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 20,
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

  loadingWrap: {
    alignItems: 'center',
    padding: 32,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  emptyWrap: {
    alignItems: 'center',
    padding: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  separator: { height: 1, backgroundColor: '#F0E0D0', marginLeft: 64 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 14,
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  memberMeta: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },

  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  classColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  classInfo: { flex: 1 },
  className: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  classDetail: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // === School Photo Card ===
  schoolImageCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    height: 140,
    position: 'relative',
  },
  schoolImageThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  schoolImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // Join badges
  joinedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  joinedBadgeText: { fontSize: 11, fontFamily: fonts.bold, color: '#059669' },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.maroon, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5,
  },
  joinBtnText: { fontSize: 11, fontFamily: fonts.bold, color: 'white' },

  // Block accordion
  blockList: {
    backgroundColor: '#FFF5ED', paddingLeft: 36, paddingRight: 16,
    paddingTop: 2, paddingBottom: 8,
  },
  blockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: 'white', borderRadius: 14, marginTop: 6,
    borderWidth: 1.5, borderColor: '#F0E0D0',
  },
  blockDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.maroon, opacity: 0.6,
  },
  blockTitle: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary },
  blockSub: { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 1 },
});
