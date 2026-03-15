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
  Animated,
  LayoutAnimation,
  UIManager,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { colors, fonts } from '../theme';
import type { FriendData, ClassData } from '../types';
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
}

interface Props {
  onHome: () => void;
  onScan: () => void;
  onFiles: () => void;
  profilePicture: string | null;
  userName: string;
  userUsername: string;
  onPersonOpen?: (person: FriendData) => void;
  friends: FriendData[];
  friendRequests: FriendRequest[];
  onSendRequest: (username: string) => Promise<{ success: boolean; message: string }>;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  classes: ClassData[];
}

type Tab = 'friends' | 'requests' | 'sessions' | 'discover';
type CallMode = 'voice' | 'video';

interface StudySession {
  id: string;
  title: string;
  course: string;
  time: string;
  participants: string[];
  rsvped: boolean;
  createdByMe: boolean;
}

interface Message {
  id: number;
  from: 'me' | 'them';
  text: string;
  time: string;
}

interface ActiveCall {
  mode: CallMode;
  title: string;
  participants: string[];
  startedAt: number;
}

function currentTimeLabel() {
  const now = new Date();
  return `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function FriendsScreen({
  onHome, onScan, onFiles, profilePicture, userName, userUsername,
  onPersonOpen, friends, friendRequests,
  onSendRequest, onAcceptRequest, onDeclineRequest, classes,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendSearchUsername, setFriendSearchUsername] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, Message[]>>({});

  // Sessions
  const [upcomingSessions, setUpcomingSessions] = useState<StudySession[]>([]);
  const [sessionEditor, setSessionEditor] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [sessionDraftTitle, setSessionDraftTitle] = useState('');
  const [sessionDraftCourse, setSessionDraftCourse] = useState('');
  const [sessionDraftTime, setSessionDraftTime] = useState('');
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
        const formattedSessions: StudySession[] = data.map((session: any) => ({
          id: session.id?.toString() || `session-${Date.now()}-${Math.random()}`,
          title: session.title,
          course: session.course,
          time: session.time,
          participants: session.participants || [],
          rsvped: true,
          createdByMe: session.user_id === userId,
        }));
        setUpcomingSessions(formattedSessions);
      }
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab]);

  const formatSessionTime = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Feedback toast
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [feedbackColor, setFeedbackColor] = useState('#166534');
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackY = useRef(new Animated.Value(-8)).current;

  // Message send swoosh animation
  const messageSwoosh = useRef(new Animated.Value(0)).current;
  const messageSwooshOpacity = useRef(new Animated.Value(0)).current;

  // Online status pulse
  const onlinePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(onlinePulse, { toValue: 1.15, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(onlinePulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [onlinePulse]);

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

  useEffect(() => {
    if (!activeCall) {
      setCallSeconds(0);
      setMicMuted(false);
      setSpeakerOn(true);
      setCameraOn(true);
      return;
    }
    const timer = setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

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

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeChatFriend = friends.find((f) => f.id === activeChatId) || null;

  const sendMessage = () => {
    const text = draftMessage.trim();
    if (!text || !activeChatId) return;
    messageSwoosh.setValue(40);
    messageSwooshOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(messageSwoosh, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }),
      Animated.timing(messageSwooshOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    setMessagesByFriend((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), { id: Date.now(), from: 'me', text, time: currentTimeLabel() }],
    }));
    setDraftMessage('');
  };

  const startFriendCall = (friendName: string, mode: CallMode) => {
    setActiveCall({
      mode,
      title: mode === 'voice' ? `Voice with ${friendName}` : `Video with ${friendName}`,
      participants: [friendName, userName || 'You'],
      startedAt: Date.now(),
    });
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

  // ==================== CALL SCREEN ====================
  if (activeCall) {
    const isVideo = activeCall.mode === 'video';
    const participants = activeCall.participants;

    return (
      <View style={styles.callScreen}>
        <View style={styles.callGlowOne} />
        <View style={styles.callGlowTwo} />
        <View style={styles.callTopRow}>
          <TouchableOpacity style={styles.callTopBtn} onPress={() => setActiveCall(null)}>
            <Ionicons name="chevron-down" size={22} color="white" />
          </TouchableOpacity>
          <View style={styles.callTitleWrap}>
            <Text style={styles.callTypeLabel}>{isVideo ? 'VIDEO CALL' : 'VOICE CALL'}</Text>
            <Text style={styles.callTitleText} numberOfLines={1}>{activeCall.title}</Text>
            <Text style={styles.callClock}>{formatDuration(callSeconds)}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {isVideo ? (
          <View style={styles.videoStage}>
            <View style={styles.videoFocusTile}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={22} color="rgba(255,255,255,0.9)" />
              <Text style={styles.videoFocusName}>{participants[0]}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.voiceStage}>
            <View style={styles.voiceAvatarOuter}>
              <View style={styles.voiceAvatarInner}>
                <Ionicons name="person" size={42} color="white" />
              </View>
            </View>
            <Text style={styles.voiceName}>{participants[0]}</Text>
          </View>
        )}

        <View style={styles.callControlsDock}>
          <TouchableOpacity style={[styles.callControlBtn, micMuted && styles.callControlBtnActive]} onPress={() => setMicMuted((v) => !v)}>
            <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={20} color={micMuted ? 'white' : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callControlBtn, speakerOn && styles.callControlBtnActive]} onPress={() => setSpeakerOn((v) => !v)}>
            <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={20} color={speakerOn ? 'white' : colors.textPrimary} />
          </TouchableOpacity>
          {isVideo && (
            <TouchableOpacity style={[styles.callControlBtn, cameraOn && styles.callControlBtnActive]} onPress={() => setCameraOn((v) => !v)}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={20} color={cameraOn ? 'white' : colors.textPrimary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.callControlBtn, styles.callEndBtn]} onPress={() => setActiveCall(null)}>
            <Ionicons name="call" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==================== CHAT SCREEN ====================
  if (activeChatFriend) {
    const messages = messagesByFriend[activeChatFriend.id] || [];

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setActiveChatId(null)}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatFriendName}>{activeChatFriend.name}</Text>
            <Text style={styles.chatFriendStatus}>
              {activeChatFriend.status === 'online' ? 'Online now' : 'Available later'}
            </Text>
          </View>
          <TouchableOpacity style={styles.chatTopAction} onPress={() => startFriendCall(activeChatFriend.name, 'voice')}>
            <Ionicons name="call" size={18} color={colors.maroon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatTopAction} onPress={() => startFriendCall(activeChatFriend.name, 'video')}>
            <Ionicons name="videocam" size={18} color={colors.maroon} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && (
            <View style={styles.chatEmpty}>
              <View style={styles.chatEmptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textTertiary} /></View>
              <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
              <Text style={styles.chatEmptySub}>Say hello to {activeChatFriend.name.split(' ')[0]}!</Text>
            </View>
          )}
          {messages.map((message, idx) => {
            const isLatestMe = message.from === 'me' && idx === messages.length - 1;
            const bubble = (
              <View style={[styles.messageBubble, message.from === 'me' && styles.messageBubbleMe]}>
                <Text style={[styles.messageText, message.from === 'me' && styles.messageTextMe]}>{message.text}</Text>
                <Text style={[styles.messageTime, message.from === 'me' && styles.messageTimeMe]}>{message.time}</Text>
              </View>
            );
            return (
              <View key={message.id} style={[styles.messageRow, message.from === 'me' && styles.messageRowMe]}>
                {isLatestMe ? (
                  <Animated.View style={{ opacity: messageSwooshOpacity, transform: [{ translateX: messageSwoosh }] }}>
                    {bubble}
                  </Animated.View>
                ) : bubble}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.chatComposer}>
          <TextInput
            style={styles.chatInput}
            value={draftMessage}
            onChangeText={setDraftMessage}
            placeholder="Message"
            placeholderTextColor={colors.textTertiary}
          />
          <AnimatedPressable style={styles.sendBtn} onPress={sendMessage} scaleDown={0.85}>
            <Ionicons name="send" size={16} color="white" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ==================== MAIN SCREEN ====================
  const pendingRequests = friendRequests.filter((r) => r.status === 'pending');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Connect, chat, and study together</Text>
          </View>
          <View style={styles.avatarWrap}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={24} color={colors.textTertiary} />
            )}
          </View>
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
          <AnimatedPressable style={styles.addFriendBtn} onPress={() => { setShowAddFriendModal(true); setSendResult(null); setFriendSearchUsername(''); }} scaleDown={0.88}>
            <Ionicons name="person-add" size={18} color="white" />
          </AnimatedPressable>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(['friends', 'requests', 'sessions', 'discover'] as Tab[]).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
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
              {tab === 'sessions' && upcomingSessions.length > 0 && (
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{upcomingSessions.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

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
                  Tap the <Text style={{ fontFamily: fonts.bold, color: colors.maroon }}>+</Text> button above to add friends by their username. You can also share your username so others can find you!
                </Text>
                <View style={styles.usernameShareCard}>
                  <Text style={styles.usernameShareLabel}>Your Username</Text>
                  <Text style={styles.usernameShareValue}>@{userUsername || 'not set'}</Text>
                </View>
              </View>
            ) : (
              <>
                {/* Active Now */}
                {filteredFriends.filter((f) => f.status !== 'offline').length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Active Now</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                      {filteredFriends
                        .filter((f) => f.status !== 'offline')
                        .map((friend) => (
                          <TouchableOpacity key={friend.id} style={styles.friendChip} onPress={() => setActiveChatId(friend.id)}>
                            <View style={[styles.friendChipAvatar, { backgroundColor: friend.color }]}>
                              <Ionicons name="person" size={24} color="#6366f1" />
                            </View>
                            <View style={[styles.statusDot, friend.status === 'online' && styles.statusOnline, friend.status === 'studying' && styles.statusStudying]} />
                            <Text style={styles.friendChipName} numberOfLines={1}>{friend.name.split(' ')[0]}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </>
                )}

                {/* All Friends */}
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>All Friends</Text>
                {filteredFriends.map((friend) => (
                  <TouchableOpacity key={friend.id} style={styles.friendRow} onPress={() => onPersonOpen?.(friend)} activeOpacity={0.7}>
                    <View style={[styles.friendAvatar, { backgroundColor: friend.color }]}>
                      <Ionicons name="person" size={20} color="#6366f1" />
                    </View>
                    <Animated.View
                      style={[
                        styles.statusDotSmall,
                        friend.status === 'online' && styles.statusOnline,
                        friend.status === 'studying' && styles.statusStudying,
                        (friend.status === 'online' || friend.status === 'studying') && { transform: [{ scale: onlinePulse }] },
                      ]}
                    />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.name}</Text>
                      <Text style={[styles.friendStatus, friend.status === 'online' && styles.friendStatusOnline, friend.status === 'studying' && styles.friendStatusStudying]}>
                        {friend.status === 'online' ? 'Online' : friend.status === 'studying' ? 'Studying' : 'Offline'}
                      </Text>
                    </View>
                    <View style={styles.friendActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveChatId(friend.id)}>
                        <Ionicons name="chatbubble-outline" size={18} color={colors.maroon} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => startFriendCall(friend.name, 'voice')}>
                        <Ionicons name="call-outline" size={18} color={colors.maroon} />
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
                <Text style={styles.sectionLabel}>Incoming Requests</Text>
                {pendingRequests.map((request, index) => (
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
              }}>
                <Ionicons name="add" size={14} color="white" />
                <Text style={styles.createSessionText}>Create</Text>
              </TouchableOpacity>
            </View>

            {upcomingSessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconLarge}>
                  <Ionicons name="videocam-outline" size={36} color={colors.maroon} />
                </View>
                <Text style={styles.emptyCardTitle}>No study sessions</Text>
                <Text style={styles.emptyCardSub}>
                  Create a study session to invite friends for a live video review. Perfect for group studying and exam prep!
                </Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => {
                  setSessionEditor({ mode: 'create' });
                  setSessionDraftTitle('');
                  setSessionDraftCourse('');
                  setSessionDraftTime('');
                }}>
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={styles.emptyActionText}>Create Your First Session</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingSessions.map((s) => (
                <View key={s.id} style={styles.sessionCard}>
                  <Text style={styles.sessionCourse}>{s.course}</Text>
                  <Text style={styles.sessionTitle}>{s.title}</Text>
                  <Text style={styles.sessionMeta}>{s.time}</Text>
                  <Text style={styles.sessionParticipants} numberOfLines={1}>{s.participants.join(', ')}</Text>
                  <View style={styles.sessionActionsRow}>
                    <TouchableOpacity
                      style={[styles.rsvpBtn, s.rsvped && styles.rsvpBtnActive]}
                      onPress={() => setUpcomingSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, rsvped: !x.rsvped } : x))}
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
                        }}>
                          <Ionicons name="pencil" size={12} color={colors.maroon} />
                          <Text style={styles.ownerActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ownerActionBtn} onPress={() => setUpcomingSessions((prev) => prev.filter((x) => x.id !== s.id))}>
                          <Ionicons name="trash" size={12} color="#b91c1c" />
                          <Text style={styles.ownerActionDangerText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ================== DISCOVER TAB ================== */}
        {activeTab === 'discover' && (
          <View style={styles.section}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconLarge}>
                <Ionicons name="compass-outline" size={36} color={colors.maroon} />
              </View>
              <Text style={styles.emptyCardTitle}>Discover classmates</Text>
              <Text style={styles.emptyCardSub}>
                Share your username with classmates so they can add you as a friend. You can also add friends using the + button above!
              </Text>
              <View style={styles.usernameShareCard}>
                <Text style={styles.usernameShareLabel}>Your Username</Text>
                <Text style={styles.usernameShareValue}>@{userUsername || 'not set'}</Text>
              </View>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={() => { setShowAddFriendModal(true); setSendResult(null); setFriendSearchUsername(''); }}>
                <Ionicons name="person-add" size={16} color="white" />
                <Text style={styles.emptyActionText}>Add by Username</Text>
              </TouchableOpacity>
            </View>
          </View>
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
              <Text style={styles.modalSub}>Set up your live study room details.</Text>
              <Text style={styles.editorLabel}>Session Title</Text>
              <TextInput style={styles.editorInput} value={sessionDraftTitle} onChangeText={setSessionDraftTitle} placeholder="Ex: Unit 7 Blitz" placeholderTextColor={colors.textTertiary} />
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
              <Text style={styles.editorLabel}>Time</Text>
              <TouchableOpacity
                style={styles.editorInput}
                onPress={() => setDatePickerVisibility(true)}
              >
                <Text style={{ color: sessionDraftTime ? colors.textPrimary : colors.textTertiary, fontSize: 14 }}>
                  {sessionDraftTime || 'Ex: Saturday \u2022 7:00 PM'}
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
                const title = sessionDraftTitle.trim() || 'New Study Session';
                const course = sessionDraftCourse.trim() || 'Custom Session';
                const time = sessionDraftTime.trim() || 'TBD';

                try {
                  const { data: userData } = await supabase.auth.getUser();
                  const userId = userData?.user?.id;

                  if (sessionEditor?.mode === 'create') {
                    const { error } = await supabase.from('study_sessions').insert({
                      title,
                      course,
                      time,
                      user_id: userId,
                      participants: [userName || 'You']
                    });
                    if (error) console.log('Error saving session:', error);
                    
                    setUpcomingSessions((prev) => [{ id: `session-${Date.now()}`, title, course, time, participants: [userName || 'You'], rsvped: true, createdByMe: true }, ...prev]);
                  } else {
                    const { error } = await supabase.from('study_sessions').update({
                      title,
                      course,
                      time
                    }).eq('title', title);
                    if (error) console.log('Error updating session:', error);

                    setUpcomingSessions((prev) => prev.map((s) => s.id === sessionEditor?.id ? { ...s, title, course, time } : s));
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
  scrollContent: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  avatarWrap: { width: 48, height: 48, borderRadius: 18, backgroundColor: 'white', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  avatar: { width: '100%', height: '100%' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 18, paddingHorizontal: 16, height: 48, gap: 10, borderWidth: 2, borderColor: '#F0E0D0' },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0, fontFamily: fonts.medium },
  addFriendBtn: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0' },
  tabActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
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

  // Call
  callScreen: { flex: 1, backgroundColor: '#140709', paddingTop: 56, paddingHorizontal: 18, paddingBottom: 24 },
  callGlowOne: { position: 'absolute', top: -80, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(127,29,29,0.45)' },
  callGlowTwo: { position: 'absolute', bottom: 120, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(30,64,175,0.22)' },
  callTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  callTopBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  callTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: 12 },
  callTypeLabel: { fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bold },
  callTitleText: { fontSize: 18, color: 'white', fontFamily: fonts.bold, marginTop: 4 },
  callClock: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontFamily: fonts.medium },
  videoStage: { flex: 1, marginTop: 16 },
  videoFocusTile: { flex: 1, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 280 },
  videoFocusName: { color: 'white', fontSize: 20, fontFamily: fonts.bold },
  voiceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  voiceAvatarOuter: { width: 190, height: 190, borderRadius: 95, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  voiceAvatarInner: { width: 142, height: 142, borderRadius: 71, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.maroon}95` },
  voiceName: { color: 'white', fontSize: 24, fontFamily: fonts.bold },
  callControlsDock: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 4 },
  callControlBtn: { width: 56, height: 56, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  callControlBtnActive: { backgroundColor: colors.maroon },
  callEndBtn: { backgroundColor: '#dc2626' },

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
