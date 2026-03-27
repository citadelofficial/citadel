import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
}

export function SchoolScreen({ schoolName, onBack, onPersonOpen, classes, currentUserId }: Props) {
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Entrance animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

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

  // Fetch all members at this school
  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, grade, avatar_url')
          .eq('school', schoolName);

        if (data && !error) {
          const mapped: SchoolMember[] = data
            .filter((p: any) => p.id !== currentUserId)
            .map((p: any) => ({
              id: p.id,
              name: p.display_name || p.username || 'User',
              username: p.username || '',
              grade: p.grade || '',
              avatarUrl: p.avatar_url || null,
            }));
          setMembers(mapped);
        }
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

  const schoolClasses = useMemo(() => {
    return classes;
  }, [classes]);

  const handleMemberPress = (member: SchoolMember) => {
    const friendData: FriendData = {
      id: member.id,
      name: member.name,
      color: '#E0E7FF',
      status: 'offline',
      grade: member.grade,
      school: schoolName,
    };
    onPersonOpen(friendData);
  };

  // Color palette for member avatars
  const avatarColors = ['#E0E7FF', '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE', '#FFEDD5'];

  // Generate and share invite code
  const handleInvite = async () => {
    try {
      // Encode school name as a simple invite code
      const inviteCode = btoa(schoolName).replace(/=/g, '');
      await Share.share({
        message: `Join me at ${schoolName} on Citadel! Use this invite code when you sign up:\n\n${inviteCode}\n\nDownload Citadel to get started!`,
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
            <View style={styles.heroIconWrap}>
              <Ionicons name="school" size={36} color="white" />
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
              filteredMembers.map((member, index) => (
                <View key={member.id}>
                  {index > 0 && <View style={styles.separator} />}
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => handleMemberPress(member)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
                      <Ionicons name="person" size={18} color="#6366f1" />
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

          {/* Your Classes */}
          {schoolClasses.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Classes</Text>
              <View style={styles.card}>
                {schoolClasses.map((cls, i) => (
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
                ))}
              </View>
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
});
