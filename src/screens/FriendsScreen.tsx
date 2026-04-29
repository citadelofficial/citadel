import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Modal,
  Alert,
  Animated,
  LayoutAnimation,
  UIManager,
  Easing,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { InlineTutorialCard } from '../components/InlineTutorialCard';
import { colors, fonts } from '../theme';
import type { FriendData, ClassData, ClassInvite } from '../types';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { supabase } from '../lib/supabase';

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  from_display_name: string;
  from_school?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  direction: 'incoming' | 'outgoing';
  to_username?: string;
  to_display_name?: string;
}

interface Props {
  onHome: () => void;
  onScan: () => void;
  onFiles: () => void;
  profilePicture: string | null;
  userName: string;
  userUsername: string;
  onPersonOpen?: (person: FriendData) => void;
  onProfileOpen?: () => void;
  friends: FriendData[];
  friendRequests: FriendRequest[];
  onSendRequest: (username: string) => Promise<{ success: boolean; message: string }>;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  onCancelRequest?: (requestId: string) => void;
  classes: ClassData[];
  userSchool?: string;
  userSchools?: string[];
  onSchoolOpen?: (schoolName: string) => void;
  classInvites?: ClassInvite[];
  onAcceptClassInvite?: (inviteId: string) => void;
  onDeclineClassInvite?: (inviteId: string) => void;
  onRefreshFriends?: () => Promise<void>;
  tutorialStep?: number;
  onTutorialNext?: () => void;
  onTutorialBack?: () => void;
  onTutorialSkip?: () => void;
  onTutorialFinish?: () => void;
}

type Tab = 'friends' | 'requests' | 'invites' | 'sessions' | 'discover';

interface StudySession {
  id: string;
  title: string;
  course: string;
  time: string;
  location?: string;
  participants: string[];
  attendees: string[];
  attendee_names: string[];
  rsvped: boolean;
  createdByMe: boolean;
}

interface Message {
  id: number;
  dbId?: string | number;  // Supabase row ID for deletion
  from: 'me' | 'them';
  text: string;
  time: string;
  createdAt?: string;  // ISO timestamp for fallback delete
}

function currentTimeLabel() {
  const now = new Date();
  return `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
}



const TUTORIAL_TOTAL_STEPS = 7;

// ==================== DISCOVER SECTION ====================
interface DiscoverProps {
  userSchool?: string;
  userSchools?: string[];
  onSchoolOpen?: (schoolName: string) => void;
  onPersonOpen?: (person: FriendData) => void;
  onSendRequest: (username: string) => Promise<{ success: boolean; message: string }>;
  onInvitePeople: () => void;
  showFeedback: (text: string, color: string) => void;
  friends: FriendData[];
  userUsername: string;
  tutorialStep?: number;
}

function DiscoverSection({
  userSchool,
  userSchools,
  onSchoolOpen,
  onPersonOpen,
  onSendRequest,
  onInvitePeople,
  showFeedback,
  friends,
  userUsername,
  tutorialStep = 0,
}: DiscoverProps) {
  const [schoolmates, setSchoolmates] = useState<{ id: string; name: string; username: string; grade: string; school: string; avatarUrl: string | null }[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const allSchools = userSchools && userSchools.length > 0 ? userSchools : (userSchool ? [userSchool] : []);
    if (allSchools.length === 0) return;
    setLoadingDiscover(true);
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        // Query profiles matching ANY of user's schools
        const orConditions = allSchools.map(s => `school.eq.${s}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, grade, school, schools, avatar_url')
          .or(orConditions)
          .neq('id', userId || '')
          .limit(30);

        if (data) {
          const friendIds = new Set(friends.map(f => f.id));
          // Also include people whose schools array overlaps
          const allSchoolsLower = allSchools.map(s => s.toLowerCase());
          const filtered = data.filter((p: any) => {
            if (friendIds.has(p.id)) return false;
            // Check primary school match or schools array overlap
            const personSchools: string[] = Array.isArray(p.schools) ? p.schools : (p.school ? [p.school] : []);
            return personSchools.some((s: string) => allSchoolsLower.includes(s.toLowerCase()));
          });
          setSchoolmates(filtered.map((p: any) => ({
            id: p.id,
            name: p.display_name || p.username || 'User',
            username: p.username || '',
            grade: p.grade || '',
            school: p.school || '',
            avatarUrl: p.avatar_url || null,
          })));
        }
      } catch (e) {
        console.log('Error fetching discover:', e);
      } finally {
        setLoadingDiscover(false);
      }
    })();
  }, [userSchool, userSchools, friends]);

  const handleAddFromDiscover = async (person: { id: string; username: string; name: string }) => {
    if (!person.username) return;
    setAddingIds(prev => new Set(prev).add(person.id));
    const result = await onSendRequest(person.username);
    setAddingIds(prev => { const next = new Set(prev); next.delete(person.id); return next; });
    if (result.success) {
      showFeedback(`Request sent to ${person.name}!`, '#166534');
    } else {
      showFeedback(result.message, '#991b1b');
    }
  };

  const avatarColors = ['#E0E7FF', '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE', '#FFEDD5'];

  return (
    <View style={styles.section}>
      <AnimatedPressable
        style={[
          styles.discoverInviteButton,
          tutorialStep === 7 && styles.discoverInviteButtonTutorial,
        ]}
        onPress={onInvitePeople}
        scaleDown={0.98}
      >
        <View style={styles.discoverInviteIcon}>
          <Ionicons name="share-social-outline" size={20} color={colors.maroon} />
        </View>
        <View style={styles.discoverInviteTextWrap}>
          <Text style={styles.discoverInviteTitle}>Invite People to Your School</Text>
          <Text style={styles.discoverInviteSub}>
            Open the share sheet and send an invite people can use to join your school network.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </AnimatedPressable>

      {/* School link */}
      {userSchool ? (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 16,
            borderWidth: 2,
            borderColor: '#F0E0D0',
            marginBottom: 16,
          }}
          onPress={() => onSchoolOpen?.(userSchool)}
          activeOpacity={0.7}
        >
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: `${colors.maroon}14`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}>
            <Ionicons name="school" size={22} color={colors.maroon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary }}>Your School</Text>
            <Text style={{ fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary, marginTop: 2 }}>{userSchool}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      ) : null}

      {/* Schoolmates to discover */}
      {loadingDiscover ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color={colors.maroon} />
          <Text style={[styles.emptyCardSub, { marginTop: 8 }]}>Finding classmates...</Text>
        </View>
      ) : schoolmates.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>People at Your School</Text>
          {schoolmates.map((person, index) => (
            <View
              key={person.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'white',
                borderRadius: 18,
                padding: 14,
                borderWidth: 2,
                borderColor: '#F0E0D0',
                marginBottom: 10,
              }}
            >
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => onPersonOpen?.({
                  id: person.id,
                  name: person.name,
                  color: avatarColors[index % avatarColors.length],
                  status: 'offline',
                  grade: person.grade,
                  school: person.school,
                  avatarUrl: person.avatarUrl,
                })}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: avatarColors[index % avatarColors.length],
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                  overflow: 'hidden',
                }}>
                  {person.avatarUrl ? (
                    <Image source={{ uri: person.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 14 }} />
                  ) : (
                    <Ionicons name="person" size={18} color="#6366f1" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary }}>{person.name}</Text>
                  <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 1 }}>
                    {person.username ? `@${person.username}` : ''}{person.grade ? ` • ${person.grade}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.maroon,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  gap: 4,
                }}
                onPress={() => handleAddFromDiscover(person)}
                disabled={addingIds.has(person.id)}
              >
                {addingIds.has(person.id) ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={14} color="white" />
                    <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: 'white' }}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconLarge}>
            <Ionicons name="compass-outline" size={36} color={colors.maroon} />
          </View>
          <Text style={styles.emptyCardTitle}>
            {userSchool ? 'No new classmates to discover' : 'Discover classmates'}
          </Text>
          <Text style={styles.emptyCardSub}>
            {userSchool
              ? 'All your schoolmates are already in your friends list!'
              : 'Set your school in your profile to discover classmates and share your school invite with new people.'}
          </Text>
          <View style={styles.usernameShareCard}>
            <Text style={styles.usernameShareLabel}>Your Username</Text>
            <Text style={styles.usernameShareValue}>@{userUsername || 'not set'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function FriendsScreen({
  onHome, onScan, onFiles, profilePicture, userName, userUsername,
  onPersonOpen, onProfileOpen, friends, friendRequests,
  onSendRequest, onAcceptRequest, onDeclineRequest, onCancelRequest, classes,
  userSchool, userSchools, onSchoolOpen,
  classInvites = [], onAcceptClassInvite, onDeclineClassInvite,
  onRefreshFriends,
  tutorialStep = 0,
  onTutorialNext = () => { },
  onTutorialBack = () => { },
  onTutorialSkip = () => { },
  onTutorialFinish = () => { },
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendSearchUsername, setFriendSearchUsername] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const tabsScrollRef = useRef<ScrollView>(null);



  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, Message[]>>({});

  // Sessions
  const [upcomingSessions, setUpcomingSessions] = useState<StudySession[]>([]);
  const [sessionEditor, setSessionEditor] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [sessionDraftTitle, setSessionDraftTitle] = useState('');
  const [sessionDraftCourse, setSessionDraftCourse] = useState('');
  const [sessionDraftTime, setSessionDraftTime] = useState('');
  const [sessionDraftLocation, setSessionDraftLocation] = useState('');
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const fetchSessions = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await supabase.from('study_sessions').select('*');
      
      if (error) {
        console.log('Error fetching sessions:', error);
        return;
      }
      
      if (data) {
        // Only show sessions for classes the user is in, or sessions they created
        const userClassTitles = classes.map(c => c.title.toLowerCase());
        const filteredData = data.filter((session: any) =>
          session.user_id === userId || userClassTitles.includes((session.course || '').toLowerCase())
        );
        const formattedSessions: StudySession[] = filteredData.map((session: any) => ({
          id: session.id?.toString() || `session-${Date.now()}-${Math.random()}`,
          title: session.title,
          course: session.course,
          time: session.time,
          location: session.location || '',
          participants: session.participants || [],
          attendees: session.attendees || [],
          attendee_names: session.attendee_names || session.participants || [],
          rsvped: (session.attendees || []).includes(userId),
          createdByMe: session.user_id === userId,
        }));
        setUpcomingSessions(formattedSessions);
      }
    } catch (e) {
      console.log(e);
    }
  };

  // Refresh friends data on mount to get latest profile pictures/info
  useEffect(() => {
    onRefreshFriends?.();
  }, []);

  // Load sessions on mount AND when tab is clicked
  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab]);

  const formatSessionTime = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} • ${h12}:${mins} ${ampm}`;
  };

  // Feedback toast
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [feedbackColor, setFeedbackColor] = useState('#166534');
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackY = useRef(new Animated.Value(-8)).current;
  const tutorialGuide =
    tutorialStep === 6
      ? {
        step: 6,
        title: 'Meet your people',
        body: 'Chat with friends, manage requests, and discover classmates — all in one place. Tap the Discover tab to find your school network.',
      }
      : tutorialStep === 7
        ? {
          step: 7,
          title: 'Grow your network',
          body: 'Almost done! Use the Invite button below to share Citadel with friends at your school. You\'re all set after this!',
        }
        : null;

  // Message send swoosh animation
  const messageSwoosh = useRef(new Animated.Value(0)).current;
  const messageSwooshOpacity = useRef(new Animated.Value(0)).current;
  const [justSentMessageId, setJustSentMessageId] = useState<number | null>(null);


  // Request reveal animation
  const requestReveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (activeTab !== 'requests') return;
    requestReveal.setValue(0);
    Animated.timing(requestReveal, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [activeTab, requestReveal, friendRequests.length]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);



  const showFeedback = useCallback((text: string, color: string) => {
    setFeedbackText(text);
    setFeedbackColor(color);
    feedbackOpacity.setValue(0);
    feedbackY.setValue(-8);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(feedbackY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
      Animated.delay(1400),
      Animated.parallel([
        Animated.timing(feedbackOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(feedbackY, { toValue: -8, duration: 220, useNativeDriver: true }),
      ]),
    ]).start(() => setFeedbackText(null));
  }, [feedbackOpacity, feedbackY]);

  useEffect(() => {
    if (tutorialStep === 7 && activeTab !== 'discover') {
      setActiveTab('discover');
    }
  }, [activeTab, tutorialStep]);

  useEffect(() => {
    if (tutorialStep !== 6 && tutorialStep !== 7) return;
    const timer = setTimeout(() => {
      tabsScrollRef.current?.scrollToEnd({ animated: true });
    }, 240);
    return () => clearTimeout(timer);
  }, [activeTab, tutorialStep]);

  const openAddFriendModal = () => {
    setShowAddFriendModal(true);
    setSendResult(null);
    setFriendSearchUsername('');
  };

  const shareSchoolInvite = useCallback(async () => {
    try {
      await Share.share({
        title: userSchool ? `Join ${userSchool} on Citadel` : 'Join me on Citadel',
        message: userSchool
          ? `Join me on Citadel and set your school to ${userSchool} so we can share notes, scans, and study sessions together.\n\nMy username: @${userUsername || 'citadel-user'}`
          : `Join me on Citadel so we can share notes, scans, and study sessions together.\n\nMy username: @${userUsername || 'citadel-user'}`,
      });
    } catch {
      // Ignore share sheet cancellation
    }

    if (tutorialStep === 7) {
      onTutorialFinish();
    }
  }, [onTutorialFinish, tutorialStep, userSchool, userUsername]);

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeChatFriend = friends.find((f) => f.id === activeChatId) || null;

  const sendMessage = async () => {
    const text = draftMessage.trim();
    if (!text || !activeChatId) return;
    messageSwoosh.setValue(40);
    messageSwooshOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(messageSwoosh, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }),
      Animated.timing(messageSwooshOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const msgId = Date.now();
    const createdAt = new Date().toISOString();
    const newMsg: Message = { id: msgId, from: 'me' as const, text, time: currentTimeLabel(), createdAt };
    setJustSentMessageId(msgId);
    setMessagesByFriend((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), newMsg],
    }));
    setDraftMessage('');

    // Persist to Supabase
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        // Validate receiver UUID and sanitize message text
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(activeChatId)) return;
        const sanitizedText = text.slice(0, 5000); // Limit message length
        const { data: insertedData } = await supabase.from('messages').insert({
          sender_id: authData.user.id,
          receiver_id: activeChatId,
          text: sanitizedText,
          created_at: createdAt,
        }).select('id').single();
        // Store the Supabase row ID for potential unsend
        if (insertedData?.id) {
          setMessagesByFriend((prev) => {
            const msgs = prev[activeChatId] || [];
            return {
              ...prev,
              [activeChatId]: msgs.map((m) => m.id === msgId ? { ...m, dbId: insertedData.id } : m),
            };
          });
        }
      }
    } catch (e) {
      console.log('Message save error (table may not exist yet):', e);
    }
  };

  // Load messages from Supabase when chat opens
  useEffect(() => {
    if (!activeChatId) return;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return;

        // Validate UUIDs before interpolating into filter string to prevent PostgREST filter injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId) || !uuidRegex.test(activeChatId)) return;

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userId},receiver_id.eq.${activeChatId}),and(sender_id.eq.${activeChatId},receiver_id.eq.${userId})`)
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) {
          console.log('Messages load error (table may not exist):', error.message);
          return;
        }

        if (data && data.length > 0) {
          const loaded = data.map((m: any) => ({
            id: new Date(m.created_at).getTime(),
            dbId: m.id,
            from: m.sender_id === userId ? 'me' as const : 'them' as const,
            text: m.text,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: m.created_at,
          }));
          setMessagesByFriend((prev) => ({ ...prev, [activeChatId]: loaded }));
        }
      } catch (e) {
        console.log('Messages load error:', e);
      }
    })();
  }, [activeChatId]);

  const unsendMessage = (friendId: string, message: Message) => {
    Alert.alert(
      'Unsend Message',
      'This message will be removed for both of you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsend',
          style: 'destructive',
          onPress: async () => {
            // Remove from local state immediately
            setMessagesByFriend((prev) => ({
              ...prev,
              [friendId]: (prev[friendId] || []).filter((m) => m.id !== message.id),
            }));

            // Delete from Supabase
            try {
              const { data: authData } = await supabase.auth.getUser();
              const userId = authData?.user?.id;
              if (!userId) return;

              if (message.dbId) {
                // Try delete by row ID
                const { error } = await supabase
                  .from('messages')
                  .delete()
                  .eq('id', message.dbId);
                if (error) {
                  console.log('Delete by dbId failed, trying fallback:', error.message);
                } else {
                  return; // success
                }
              }

              // Fallback: delete by matching sender + receiver + text + time
              let fallbackQuery = supabase
                .from('messages')
                .delete()
                .eq('sender_id', userId)
                .eq('receiver_id', friendId)
                .eq('text', message.text);
              if (message.createdAt) {
                fallbackQuery = fallbackQuery.eq('created_at', message.createdAt);
              }
              const { error: fallbackError } = await fallbackQuery;

              if (fallbackError) {
                console.log('Unsend fallback error:', fallbackError.message);
              }
            } catch (e) {
              console.log('Unsend error:', e);
            }
          },
        },
      ]
    );
  };
  const handleSendFriendRequest = async () => {
    const un = friendSearchUsername.trim();
    if (!un) return;
    setSendingRequest(true);
    setSendResult(null);
    const result = await onSendRequest(un);
    setSendResult(result);
    setSendingRequest(false);
    if (result.success) {
      showFeedback(`Request sent to @${un}!`, '#166534');
      setTimeout(() => {
        setShowAddFriendModal(false);
        setFriendSearchUsername('');
        setSendResult(null);
      }, 1200);
    }
  };

  const handleAccept = (reqId: string, name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onAcceptRequest(reqId);
    showFeedback(`Accepted ${name}!`, '#166534');
  };

  const handleDecline = (reqId: string, name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onDeclineRequest(reqId);
    showFeedback(`Declined ${name}.`, '#991b1b');
  };

  const handleCancel = (reqId: string, name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onCancelRequest?.(reqId);
    showFeedback(`Cancelled request to ${name}.`, '#6B7280');
  };



  // ==================== CHAT SCREEN (REDESIGNED) ====================
  if (activeChatFriend) {
    const messages = messagesByFriend[activeChatFriend.id] || [];
    const friendFirstName = activeChatFriend.name.split(' ')[0];

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Premium Chat Header */}
        <View style={{
          paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
          backgroundColor: '#FFF8F2', borderBottomWidth: 1, borderBottomColor: '#F0E0D0',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F0E0D0' }}
              onPress={() => setActiveChatId(null)}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
              onPress={() => onPersonOpen?.(activeChatFriend)}
              activeOpacity={0.7}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 14, backgroundColor: activeChatFriend.color || '#E0E7FF',
                alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: `${colors.maroon}30`,
                overflow: 'hidden',
              }}>
                {activeChatFriend.avatarUrl ? (
                  <Image source={{ uri: activeChatFriend.avatarUrl }} style={{ width: 42, height: 42, borderRadius: 14 }} />
                ) : (
                  <Ionicons name="person" size={18} color={colors.maroon} />
                )}
              </View>
              <View>
                <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary }}>{activeChatFriend.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: fonts.medium, color: colors.textTertiary }}>
                  {activeChatFriend.school || 'Citadel member'}
                </Text>
              </View>
            </TouchableOpacity>


          </View>
        </View>

        {/* Messages */}
        <ScrollView
          style={{ flex: 1, backgroundColor: '#FEFCFA' }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 24, backgroundColor: `${colors.maroon}10`,
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.maroon} />
              </View>
              <Text style={{ fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 6 }}>
                Chat with {friendFirstName}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: fonts.regular, color: colors.textTertiary, textAlign: 'center', maxWidth: 240 }}>
                Send a message, share notes, or plan a study session together.
              </Text>
            </View>
          )}
          {messages.map((message, idx) => {
            const isMe = message.from === 'me';
            const isJustSent = message.id === justSentMessageId;
            const showTime = idx === 0 || messages[idx - 1]?.from !== message.from;

            const bubble = (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={isMe ? () => unsendMessage(activeChatFriend.id, message) : undefined}
                delayLongPress={400}
                style={{
                  maxWidth: '78%',
                  backgroundColor: isMe ? colors.maroon : 'white',
                  borderRadius: 20,
                  borderBottomRightRadius: isMe ? 6 : 20,
                  borderBottomLeftRadius: isMe ? 20 : 6,
                  paddingHorizontal: 16, paddingVertical: 11,
                  borderWidth: isMe ? 0 : 1.5, borderColor: '#F0E0D0',
                  shadowColor: isMe ? colors.maroon : '#000',
                  shadowOpacity: isMe ? 0.15 : 0.04,
                  shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                  elevation: isMe ? 3 : 1,
                }}>
                <Text style={{
                  fontSize: 15, fontFamily: fonts.regular, lineHeight: 21,
                  color: isMe ? 'white' : colors.textPrimary,
                }}>{message.text}</Text>
                <Text style={{
                  fontSize: 10, fontFamily: fonts.medium, marginTop: 4,
                  color: isMe ? 'rgba(255,255,255,0.6)' : colors.textTertiary,
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                }}>{message.time}</Text>
              </TouchableOpacity>
            );

            return (
              <View key={message.id} style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                marginBottom: showTime ? 10 : 4,
              }}>
                {isJustSent ? (
                  <Animated.View style={{ opacity: messageSwooshOpacity, transform: [{ translateX: messageSwoosh }] }}>
                    {bubble}
                  </Animated.View>
                ) : bubble}
              </View>
            );
          })}
        </ScrollView>

        {/* Polished Composer */}
        <View style={{
          paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 34,
          backgroundColor: '#FFF8F2', borderTopWidth: 1, borderTopColor: '#F0E0D0',
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: 'white', borderRadius: 24, borderWidth: 1.5, borderColor: '#F0E0D0',
            paddingHorizontal: 6, paddingVertical: 4,
          }}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={{
                flex: 1, fontSize: 15, fontFamily: fonts.regular,
                color: colors.textPrimary, paddingVertical: 8,
              }}
              value={draftMessage}
              onChangeText={setDraftMessage}
              placeholder={`Message ${friendFirstName}...`}
              placeholderTextColor={colors.textTertiary}
            />
            <AnimatedPressable
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: draftMessage.trim() ? colors.maroon : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center',
              }}
              onPress={sendMessage}
              scaleDown={0.85}
            >
              <Ionicons name="send" size={14} color={draftMessage.trim() ? 'white' : colors.textTertiary} />
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ==================== MAIN SCREEN ====================
  const pendingRequests = friendRequests.filter((r) => r.status === 'pending');
  const incomingRequests = pendingRequests.filter((r) => r.direction === 'incoming');
  const outgoingRequests = pendingRequests.filter((r) => r.direction === 'outgoing');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Connect, chat, and study together</Text>
          </View>
          <TouchableOpacity style={styles.avatarWrap} onPress={onProfileOpen}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={28} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Search + Add Friend */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <AnimatedPressable style={styles.addFriendBtn} onPress={() => openAddFriendModal()} scaleDown={0.88}>
            <Ionicons name="person-add" size={18} color="white" />
          </AnimatedPressable>
        </View>

        {/* Tabs */}
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {(['friends', 'requests', 'invites', 'sessions', 'discover'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && styles.tabActive,
                tutorialStep === 6 && tab === 'discover' && styles.tutorialTargetTab,
              ]}
              onPress={() => {
                setActiveTab(tab);
                if (tutorialStep === 6 && tab === 'discover') {
                  onTutorialNext();
                }
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab[0].toUpperCase() + tab.slice(1)}</Text>
              {tab === 'friends' && friends.length > 0 && (
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{friends.length}</Text>
                </View>
              )}
              {tab === 'requests' && pendingRequests.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: '#fef2f2' }, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, { color: '#dc2626' }, activeTab === tab && styles.tabBadgeTextActive]}>{pendingRequests.length}</Text>
                </View>
              )}
              {tab === 'invites' && classInvites.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: '#FFF5ED' }, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, { color: colors.maroon }, activeTab === tab && styles.tabBadgeTextActive]}>{classInvites.length}</Text>
                </View>
              )}
              {tab === 'sessions' && upcomingSessions.length > 0 && (
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{upcomingSessions.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tutorialGuide && (
          <InlineTutorialCard
            step={tutorialGuide.step}
            totalSteps={TUTORIAL_TOTAL_STEPS}
            title={tutorialGuide.title}
            body={tutorialGuide.body}
            onDismiss={onTutorialSkip}
            onPrevious={onTutorialBack}
            onNext={tutorialStep === 7 ? onTutorialFinish : onTutorialNext}
            nextLabel={tutorialStep === 7 ? 'Finish' : 'Next'}
          />
        )}

        {/* Feedback toast */}
        {feedbackText && (
          <Animated.View style={[styles.feedbackBanner, { backgroundColor: feedbackColor, opacity: feedbackOpacity, transform: [{ translateY: feedbackY }] }]}>
            <Ionicons name="checkmark-circle" size={14} color="white" />
            <Text style={styles.feedbackText}>{feedbackText}</Text>
          </Animated.View>
        )}

        {/* ================== FRIENDS TAB ================== */}
        {activeTab === 'friends' && (
          <View style={styles.section}>
            {friends.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconLarge}>
                  <Ionicons name="people-outline" size={36} color={colors.maroon} />
                </View>
                <Text style={styles.emptyCardTitle}>No friends yet</Text>
                <Text style={styles.emptyCardSub}>
                  Add friends by their username to start chatting, studying together, and sharing class materials!
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => openAddFriendModal()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-add" size={16} color="white" />
                  <Text style={styles.emptyActionText}>Add Your First Friend</Text>
                </TouchableOpacity>
                <View style={styles.usernameShareCard}>
                  <Text style={styles.usernameShareLabel}>Your Username</Text>
                  <Text style={styles.usernameShareValue}>@{userUsername || 'not set'}</Text>
                </View>
              </View>
            ) : (
              <>
                {/* All Friends */}
                <Text style={[styles.sectionLabel, { marginTop: 0 }]}>All Friends</Text>
                {filteredFriends.map((friend) => (
                  <TouchableOpacity key={friend.id} style={styles.friendRow} onPress={() => onPersonOpen?.(friend)} activeOpacity={0.7}>
                    <View style={[styles.friendAvatar, { backgroundColor: friend.color, overflow: 'hidden' }]}>
                      {friend.avatarUrl ? (
                        <Image source={{ uri: friend.avatarUrl }} style={{ width: 44, height: 44, borderRadius: 16 }} />
                      ) : (
                        <Ionicons name="person" size={20} color="#6366f1" />
                      )}
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.name}</Text>
                      <Text style={styles.friendStatus}>
                        {friend.school || 'Citadel member'}
                      </Text>
                    </View>
                    <View style={styles.friendActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveChatId(friend.id)}>
                        <Ionicons name="chatbubble-outline" size={18} color={colors.maroon} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {/* ================== REQUESTS TAB ================== */}
        {activeTab === 'requests' && (
          <View style={styles.section}>
            {pendingRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconLarge}>
                  <Ionicons name="mail-open-outline" size={36} color={colors.maroon} />
                </View>
                <Text style={styles.emptyCardTitle}>No pending requests</Text>
                <Text style={styles.emptyCardSub}>
                  When someone sends you a friend request, it will show up here. Share your username so classmates can find you!
                </Text>
                <View style={styles.usernameShareCard}>
                  <Text style={styles.usernameShareLabel}>Your Username</Text>
                  <Text style={styles.usernameShareValue}>@{userUsername || 'not set'}</Text>
                </View>
              </View>
            ) : (
              <>
                {/* Incoming Requests */}
                {incomingRequests.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Incoming Requests</Text>
                    {incomingRequests.map((request, index) => (
                      <Animated.View
                        key={request.id}
                        style={[styles.requestCardWrap, {
                          opacity: requestReveal,
                          transform: [{ translateY: requestReveal.interpolate({ inputRange: [0, 1], outputRange: [12 + index * 6, 0] }) }],
                        }]}
                      >
                        <View style={styles.requestCard}>
                          <Text style={styles.requestName}>{request.from_display_name}</Text>
                          <Text style={styles.requestMeta}>@{request.from_username}{request.from_school ? ` • ${request.from_school}` : ''}</Text>
                          <View style={styles.requestActions}>
                            <AnimatedPressable style={styles.requestDecline} onPress={() => handleDecline(request.id, request.from_display_name)} scaleDown={0.92}>
                              <Ionicons name="close" size={14} color={colors.textSecondary} />
                              <Text style={styles.requestDeclineText}>Decline</Text>
                            </AnimatedPressable>
                            <AnimatedPressable style={styles.requestAccept} onPress={() => handleAccept(request.id, request.from_display_name)} scaleDown={0.92}>
                              <Ionicons name="checkmark" size={14} color="white" />
                              <Text style={styles.requestAcceptText}>Accept</Text>
                            </AnimatedPressable>
                          </View>
                        </View>
                      </Animated.View>
                    ))}
                  </>
                )}

                {/* Sent Requests */}
                {outgoingRequests.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, incomingRequests.length > 0 && { marginTop: 20 }]}>Sent Requests</Text>
                    {outgoingRequests.map((request, index) => (
                      <Animated.View
                        key={request.id}
                        style={[styles.requestCardWrap, {
                          opacity: requestReveal,
                          transform: [{ translateY: requestReveal.interpolate({ inputRange: [0, 1], outputRange: [12 + index * 6, 0] }) }],
                        }]}
                      >
                        <View style={[styles.requestCard, { borderColor: '#E5E7EB' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="arrow-up-circle" size={16} color={colors.textSecondary} />
                            <Text style={styles.requestName}>{request.to_display_name || request.from_display_name}</Text>
                          </View>
                          <Text style={styles.requestMeta}>@{request.to_username || request.from_username}{request.from_school ? ` • ${request.from_school}` : ''}</Text>
                          <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 2 }}>Waiting for response…</Text>
                          <View style={styles.requestActions}>
                            <AnimatedPressable
                              style={[styles.requestDecline, { borderColor: '#E5E7EB' }]}
                              onPress={() => handleCancel(request.id, request.to_display_name || request.from_display_name)}
                              scaleDown={0.92}
                            >
                              <Ionicons name="close" size={14} color={colors.textSecondary} />
                              <Text style={styles.requestDeclineText}>Cancel</Text>
                            </AnimatedPressable>
                          </View>
                        </View>
                      </Animated.View>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* ================== SESSIONS TAB ================== */}
        {activeTab === 'sessions' && (
          <View style={styles.section}>
            <View style={styles.sessionHeaderRow}>
              <Text style={styles.sectionLabel}>Study Sessions</Text>
              <TouchableOpacity style={styles.createSessionBtn} onPress={() => {
                setSessionEditor({ mode: 'create' });
                setSessionDraftTitle('');
                setSessionDraftCourse('');
                setSessionDraftTime('');
                setSessionDraftLocation('');
              }}>
                <Ionicons name="add" size={14} color="white" />
                <Text style={styles.createSessionText}>Create</Text>
              </TouchableOpacity>
            </View>

            {upcomingSessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconLarge}>
                  <Ionicons name="people-outline" size={36} color={colors.maroon} />
                </View>
                <Text style={styles.emptyCardTitle}>No study sessions</Text>
                <Text style={styles.emptyCardSub}>
                  Create an in-person study session to meet up with classmates. Perfect for group studying and exam prep!
                </Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => {
                  setSessionEditor({ mode: 'create' });
                  setSessionDraftTitle('');
                  setSessionDraftCourse('');
                  setSessionDraftTime('');
                  setSessionDraftLocation('');
                }}>
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={styles.emptyActionText}>Create Your First Session</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingSessions.map((s) => {
                const handleRsvp = async () => {
                  try {
                    const { data: authData } = await supabase.auth.getUser();
                    const userId = authData?.user?.id;
                    if (!userId) return;
                    const nowRsvped = !s.rsvped;
                    const newAttendees = nowRsvped
                      ? [...s.attendees.filter(a => a !== userId), userId]
                      : s.attendees.filter(a => a !== userId);
                    const myName = userName || 'You';
                    const newNames = nowRsvped
                      ? [...s.attendee_names.filter(n => n !== myName), myName]
                      : s.attendee_names.filter(n => n !== myName);
                    setUpcomingSessions(prev => prev.map(x => x.id === s.id ? { ...x, rsvped: nowRsvped, attendees: newAttendees, attendee_names: newNames } : x));
                    await supabase.from('study_sessions').update({ attendees: newAttendees, attendee_names: newNames }).eq('id', s.id);
                  } catch (e) { console.log('RSVP error:', e); }
                };
                return (
                  <View key={s.id} style={styles.sessionCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.sessionCourse}>{s.course}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Ionicons name="location" size={10} color="#059669" />
                        <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: '#059669' }}>IN PERSON</Text>
                      </View>
                    </View>
                    <Text style={styles.sessionTitle}>{s.title}</Text>
                    {s.location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                        <Ionicons name="location-outline" size={14} color={colors.maroon} />
                        <Text style={{ fontSize: 12, fontFamily: fonts.medium, color: colors.maroon }}>{s.location}</Text>
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.sessionMeta}>{s.time || 'TBD'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                      <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.sessionParticipants} numberOfLines={1}>
                        {s.attendee_names.length > 0 ? `${s.attendee_names.join(', ')} (${s.attendee_names.length} going)` : 'No one yet — be the first!'}
                      </Text>
                    </View>
                    <View style={styles.sessionActionsRow}>
                      <TouchableOpacity
                        style={[styles.rsvpBtn, s.rsvped && styles.rsvpBtnActive]}
                        onPress={handleRsvp}
                      >
                        <Text style={[styles.rsvpText, s.rsvped && styles.rsvpTextActive]}>{s.rsvped ? '\u2713 Going' : 'RSVP'}</Text>
                      </TouchableOpacity>
                      {s.createdByMe && (
                        <View style={styles.ownerActions}>
                          <TouchableOpacity style={styles.ownerActionBtn} onPress={() => {
                            setSessionEditor({ mode: 'edit', id: s.id });
                            setSessionDraftTitle(s.title);
                            setSessionDraftCourse(s.course);
                            setSessionDraftTime(s.time);
                            setSessionDraftLocation(s.location || '');
                          }}>
                            <Ionicons name="pencil" size={12} color={colors.maroon} />
                            <Text style={styles.ownerActionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.ownerActionBtn} onPress={async () => {
                            await supabase.from('study_sessions').delete().eq('id', s.id);
                            setUpcomingSessions((prev) => prev.filter((x) => x.id !== s.id));
                          }}>
                            <Ionicons name="trash" size={12} color="#b91c1c" />
                            <Text style={styles.ownerActionDangerText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ================== INVITES TAB ================== */}
        {activeTab === 'invites' && (
          <View style={styles.section}>
            {classInvites.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconLarge}>
                  <Ionicons name="mail-open-outline" size={36} color={colors.maroon} />
                </View>
                <Text style={styles.emptyCardTitle}>No class invites</Text>
                <Text style={styles.emptyCardSub}>
                  When a friend invites you to join their class, it will appear here. You can accept to instantly join!
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Pending Class Invites</Text>
                {classInvites.map((invite) => (
                  <View key={invite.id} style={{
                    backgroundColor: 'white', borderRadius: 20, padding: 16,
                    borderWidth: 2, borderColor: '#F0E0D0', marginBottom: 10,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <View style={{
                        width: 44, height: 44, borderRadius: 15,
                        backgroundColor: (invite.class_data?.color || colors.maroon) + '14',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="book" size={20} color={invite.class_data?.color || colors.maroon} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary }}>{invite.class_title}</Text>
                        <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 2 }}>
                          {invite.from_display_name} invited you{invite.class_data?.block ? ` • ${invite.class_data.block}` : ''}
                        </Text>
                      </View>
                    </View>
                    {invite.class_data?.description ? (
                      <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
                        {invite.class_data.description}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1, height: 42, borderRadius: 16,
                          backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'row', gap: 6,
                        }}
                        onPress={() => {
                          onAcceptClassInvite?.(invite.id);
                          showFeedback(`Joined ${invite.class_title}!`, '#166534');
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="white" />
                        <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: 'white' }}>Join Class</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          height: 42, paddingHorizontal: 18, borderRadius: 16,
                          backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1.5, borderColor: '#F0E0D0',
                        }}
                        onPress={() => {
                          onDeclineClassInvite?.(invite.id);
                          showFeedback('Invite declined.', '#991b1b');
                        }}
                      >
                        <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ================== DISCOVER TAB ================== */}
        {activeTab === 'discover' && (
          <DiscoverSection
            userSchool={userSchool}
            userSchools={userSchools}
            onSchoolOpen={onSchoolOpen}
            onPersonOpen={onPersonOpen}
            onSendRequest={onSendRequest}
            onInvitePeople={shareSchoolInvite}
            showFeedback={showFeedback}
            friends={friends}
            userUsername={userUsername}
            tutorialStep={tutorialStep}
          />
        )}
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal visible={showAddFriendModal} transparent animationType="fade" onRequestClose={() => setShowAddFriendModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Friend</Text>
                <TouchableOpacity onPress={() => setShowAddFriendModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>Enter a username to send a friend request.</Text>

              <View style={styles.modalInputRow}>
                <Text style={styles.modalAtSign}>@</Text>
                <TextInput
                  style={styles.modalInput}
                  value={friendSearchUsername}
                  onChangeText={(text) => { setFriendSearchUsername(text); setSendResult(null); }}
                  placeholder="username"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {sendResult && (
                <View style={[styles.resultBanner, { backgroundColor: sendResult.success ? '#D1FAE5' : '#fef2f2' }]}>
                  <Ionicons name={sendResult.success ? 'checkmark-circle' : 'alert-circle'} size={16} color={sendResult.success ? '#059669' : '#dc2626'} />
                  <Text style={[styles.resultText, { color: sendResult.success ? '#059669' : '#dc2626' }]}>{sendResult.message}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalSendBtn, (!friendSearchUsername.trim() || sendingRequest) && styles.modalSendBtnDisabled]}
                onPress={handleSendFriendRequest}
                disabled={!friendSearchUsername.trim() || sendingRequest}
              >
                {sendingRequest ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="white" />
                    <Text style={styles.modalSendText}>Send Request</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.usernameShareSmall}>
                <Text style={styles.usernameShareSmallLabel}>Your Username:</Text>
                <Text style={styles.usernameShareSmallValue}>@{userUsername || 'not set'}</Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Session Editor Modal */}
      <Modal visible={!!sessionEditor} transparent animationType="slide" onRequestClose={() => setSessionEditor(null)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{sessionEditor?.mode === 'edit' ? 'Edit Session' : 'Create Session'}</Text>
                <TouchableOpacity onPress={() => setSessionEditor(null)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>Plan an in-person study session with your classmates.</Text>
              <Text style={styles.editorLabel}>Session Title</Text>
              <TextInput style={styles.editorInput} value={sessionDraftTitle} onChangeText={setSessionDraftTitle} placeholder="Ex: Unit 7 Review Blitz" placeholderTextColor={colors.textTertiary} />
              <Text style={styles.editorLabel}>Course</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                {classes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.coursePill,
                      sessionDraftCourse === c.title && { backgroundColor: c.color, borderColor: c.color }
                    ]}
                    onPress={() => setSessionDraftCourse(c.title)}
                  >
                    <Text style={[styles.coursePillText, sessionDraftCourse === c.title && { color: 'white' }]}>{c.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.editorLabel}>Location</Text>
              <View style={[styles.editorInput, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium, paddingVertical: 0 }}
                  value={sessionDraftLocation}
                  onChangeText={setSessionDraftLocation}
                  placeholder="Ex: Library Room 204"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <Text style={styles.editorLabel}>Date & Time</Text>
              <TouchableOpacity
                style={[styles.editorInput, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                onPress={() => setDatePickerVisibility(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
                <Text style={{ color: sessionDraftTime ? colors.textPrimary : colors.textTertiary, fontSize: 14, fontFamily: fonts.medium }}>
                  {sessionDraftTime || 'Select date & time'}
                </Text>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="datetime"
                onConfirm={(date) => {
                  setSessionDraftTime(formatSessionTime(date));
                  setDatePickerVisibility(false);
                }}
                onCancel={() => setDatePickerVisibility(false)}
              />
              <TouchableOpacity style={styles.modalSendBtn} onPress={async () => {
                const title = sessionDraftTitle.trim() || 'Study Session';
                const course = sessionDraftCourse.trim() || 'Custom Session';
                const time = sessionDraftTime.trim() || 'TBD';
                const location = sessionDraftLocation.trim() || '';

                try {
                  const { data: userData } = await supabase.auth.getUser();
                  const userId = userData?.user?.id;
                  const myName = userName || 'You';

                  if (sessionEditor?.mode === 'create') {
                    const { data: inserted, error } = await supabase.from('study_sessions').insert({
                      title,
                      course,
                      time,
                      location,
                      user_id: userId,
                      participants: [myName],
                      attendees: [userId],
                      attendee_names: [myName],
                    }).select().maybeSingle();
                    if (error) console.log('Error saving session:', error);
                    const sessionId = inserted?.id?.toString() || `session-${Date.now()}`;
                    setUpcomingSessions((prev) => [{ id: sessionId, title, course, time, location, participants: [myName], attendees: [userId || ''], attendee_names: [myName], rsvped: true, createdByMe: true }, ...prev]);
                  } else {
                    const { error } = await supabase.from('study_sessions').update({
                      title,
                      course,
                      time,
                      location,
                    }).eq('id', sessionEditor?.id);
                    if (error) console.log('Error updating session:', error);

                    setUpcomingSessions((prev) => prev.map((s) => s.id === sessionEditor?.id ? { ...s, title, course, time, location } : s));
                  }
                } catch (e) {
                  console.log(e);
                }

                setSessionEditor(null);
                showFeedback(sessionEditor?.mode === 'edit' ? 'Session updated!' : 'Session created!', '#166534');
              }}>
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={styles.modalSendText}>{sessionEditor?.mode === 'edit' ? 'Save Changes' : 'Create Session'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav active="people" onHome={onHome} onScan={onScan} onFriends={() => { }} onFiles={onFiles} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  avatarWrap: { width: 52, height: 52, borderRadius: 20, backgroundColor: 'white', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  avatar: { width: '100%', height: '100%' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 20, height: 54, gap: 12, borderWidth: 2, borderColor: '#F0E0D0' },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0, fontFamily: fonts.medium },
  addFriendBtn: { width: 54, height: 54, borderRadius: 20, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  tutorialTargetButton: {
    borderWidth: 2,
    borderColor: '#F3D3A7',
    shadowColor: '#B45309',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  tabs: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0' },
  tabActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  tutorialTargetTab: {
    borderColor: '#C0761E',
    shadowColor: '#C0761E',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tabText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  tabTextActive: { color: 'white' },
  tabBadge: { backgroundColor: `${colors.maroon}18`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeText: { fontSize: 10, fontFamily: fonts.bold, color: colors.maroon },
  tabBadgeTextActive: { color: 'white' },

  feedbackBanner: { marginTop: 10, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  feedbackText: { color: 'white', fontSize: 12, fontFamily: fonts.bold },

  section: { marginTop: 20 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary, marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  discoverInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: '#F0D2B6',
    marginBottom: 18,
  },
  discoverInviteButtonTutorial: {
    borderColor: '#C0761E',
    shadowColor: '#C0761E',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  discoverInviteIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverInviteTextWrap: {
    flex: 1,
  },
  discoverInviteTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  discoverInviteSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  horizontalList: { gap: 12, paddingBottom: 8 },

  // Empty states
  emptyCard: { backgroundColor: 'white', borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  emptyIconLarge: { width: 72, height: 72, borderRadius: 24, backgroundColor: `${colors.maroon}10`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyCardTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary },
  emptyCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: fonts.regular, maxWidth: 280 },
  usernameShareCard: { marginTop: 20, backgroundColor: '#FFF5ED', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', width: '100%', borderWidth: 2, borderColor: '#F0E0D0' },
  usernameShareLabel: { fontSize: 10, fontFamily: fonts.semiBold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  usernameShareValue: { fontSize: 18, fontFamily: fonts.bold, color: colors.maroon, marginTop: 4 },

  // Friend chips & rows
  friendChip: { alignItems: 'center', width: 72 },
  friendChipAvatar: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statusDot: { position: 'absolute', bottom: 18, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#9ca3af', borderWidth: 2, borderColor: 'white' },
  statusDotSmall: { position: 'absolute', left: 36, top: 36, width: 12, height: 12, borderRadius: 6, backgroundColor: '#9ca3af', borderWidth: 2, borderColor: 'white' },
  statusOnline: { backgroundColor: '#22c55e' },
  statusStudying: { backgroundColor: '#f59e0b' },
  friendChipName: { fontSize: 11, fontFamily: fonts.medium, color: colors.textPrimary, marginTop: 6, maxWidth: 72 },
  friendRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: '#F0E0D0' },
  friendAvatar: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  friendStatus: { fontSize: 11, color: '#9ca3af', fontFamily: fonts.medium },
  friendStatusOnline: { color: '#22c55e' },
  friendStatusStudying: { color: '#f59e0b' },
  friendActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: `${colors.maroon}12`, alignItems: 'center', justifyContent: 'center' },

  // Requests
  requestCardWrap: { marginBottom: 10 },
  requestCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 2, borderColor: '#F0E0D0' },
  requestName: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  requestMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  requestDecline: { flex: 1, height: 42, borderRadius: 18, backgroundColor: '#FFF5ED', flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  requestDeclineText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bold },
  requestAccept: { flex: 1, height: 42, borderRadius: 18, backgroundColor: colors.maroon, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  requestAcceptText: { fontSize: 13, color: 'white', fontFamily: fonts.bold },

  // Chat
  chatHeader: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white' },
  backBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  chatHeaderInfo: { flex: 1 },
  chatFriendName: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  chatFriendStatus: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  chatTopAction: { width: 36, height: 36, borderRadius: 14, backgroundColor: `${colors.maroon}12`, alignItems: 'center', justifyContent: 'center' },
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  chatEmpty: { alignItems: 'center', paddingVertical: 40 },
  chatEmptyIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  chatEmptyTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  chatEmptySub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  messageRow: { marginBottom: 10, alignItems: 'flex-start' },
  messageRowMe: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '78%', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 2, borderColor: '#F0E0D0' },
  messageBubbleMe: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  messageText: { fontSize: 13, color: colors.textPrimary, lineHeight: 18, fontFamily: fonts.regular },
  messageTextMe: { color: 'white' },
  messageTime: { fontSize: 10, color: colors.textTertiary, marginTop: 4, fontFamily: fonts.regular },
  messageTimeMe: { color: 'rgba(255,255,255,0.8)' },
  chatComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white' },
  chatInput: { flex: 1, height: 44, borderRadius: 18, backgroundColor: '#FFF5ED', paddingHorizontal: 14, fontSize: 13, color: colors.textPrimary, fontFamily: fonts.medium, borderWidth: 2, borderColor: '#F0E0D0' },
  sendBtn: { width: 44, height: 44, borderRadius: 18, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },



  // Modal
  modalKeyboard: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: 16 },
  modalInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 18, borderWidth: 2, borderColor: '#F0E0D0', paddingHorizontal: 14, height: 52 },
  modalAtSign: { fontSize: 16, fontFamily: fonts.bold, color: colors.textTertiary, marginRight: 4 },
  modalInput: { flex: 1, fontSize: 15, color: colors.textPrimary, fontFamily: fonts.medium, paddingVertical: 0 },
  resultBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  resultText: { fontSize: 13, fontFamily: fonts.semiBold },
  modalSendBtn: { marginTop: 16, height: 52, borderRadius: 20, backgroundColor: colors.maroon, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalSendBtnDisabled: { opacity: 0.5 },
  modalSendText: { color: 'white', fontSize: 15, fontFamily: fonts.bold },
  usernameShareSmall: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, justifyContent: 'center' },
  usernameShareSmallLabel: { fontSize: 12, color: colors.textTertiary, fontFamily: fonts.regular },
  usernameShareSmallValue: { fontSize: 12, color: colors.maroon, fontFamily: fonts.bold },

  // Empty action button
  emptyActionBtn: { marginTop: 16, height: 44, borderRadius: 16, backgroundColor: colors.maroon, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  emptyActionText: { color: 'white', fontSize: 13, fontFamily: fonts.bold },

  // Sessions
  sessionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  createSessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.maroon, borderRadius: 14, height: 32, paddingHorizontal: 12 },
  createSessionText: { color: 'white', fontSize: 11, fontFamily: fonts.bold },
  sessionCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 8, borderWidth: 2, borderColor: '#F0E0D0' },
  sessionCourse: { fontSize: 10, color: colors.textTertiary, fontFamily: fonts.regular },
  sessionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 6, fontFamily: fonts.medium },
  sessionParticipants: { fontSize: 11, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  sessionActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  rsvpBtn: { height: 36, borderRadius: 14, borderWidth: 2, borderColor: '#F0E0D0', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  rsvpBtnActive: { backgroundColor: `${colors.maroon}12`, borderColor: `${colors.maroon}40` },
  rsvpText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.bold },
  rsvpTextActive: { color: colors.maroon },
  ownerActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  ownerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FFF5ED', borderWidth: 2, borderColor: '#F0E0D0' },
  ownerActionText: { fontSize: 11, fontFamily: fonts.bold, color: colors.maroon },
  ownerActionDangerText: { fontSize: 11, fontFamily: fonts.bold, color: '#b91c1c' },

  // Editor
  // Editor
  editorLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bold, marginTop: 10, marginBottom: 6 },
  editorInput: { height: 50, borderRadius: 18, borderWidth: 2, borderColor: '#F0E0D0', backgroundColor: 'white', paddingHorizontal: 14, fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium, justifyContent: 'center' },
  coursePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: '#FFF5ED', borderWidth: 2, borderColor: '#F0E0D0' },
  coursePillText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
});
