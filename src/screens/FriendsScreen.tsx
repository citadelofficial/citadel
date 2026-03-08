import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Alert,
  Animated,
  LayoutAnimation,
  UIManager,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { colors, fonts } from '../theme';
import { friendsDirectory } from '../data/friends';
import type { FriendData } from '../types';

interface Props {
  onHome: () => void;
  onScan: () => void;
  onFiles: () => void;
  profilePicture: string | null;
  userName: string;
  onPersonOpen?: (person: FriendData) => void;
}

type Tab = 'friends' | 'requests' | 'sessions' | 'discover';
type CallMode = 'voice' | 'video' | 'group';

interface Message {
  id: number;
  from: 'me' | 'them';
  text: string;
  time: string;
}

interface StudySession {
  id: string;
  title: string;
  course: string;
  time: string;
  participants: string[];
  rsvped: boolean;
  createdByMe: boolean;
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

export function FriendsScreen({ onHome, onScan, onFiles, profilePicture, userName, onPersonOpen }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');

  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);

  const [requests, setRequests] = useState([
    { id: 'saraa', name: 'Saraa Rana', school: 'Loudoun Valley High School' },
    { id: 'risha', name: 'Risha Guru', school: 'John Champe High School' },
  ]);
  const [sentDiscoverInvites, setSentDiscoverInvites] = useState<Set<string>>(new Set());
  const [requestFeedback, setRequestFeedback] = useState<{ text: string; color: string } | null>(null);
  const requestFeedbackOpacity = useState(new Animated.Value(0))[0];
  const requestFeedbackTranslate = useState(new Animated.Value(-8))[0];
  const requestReveal = useState(new Animated.Value(0))[0];

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

  const [upcomingSessions, setUpcomingSessions] = useState<StudySession[]>([
    {
      id: 'session-1',
      title: 'AP Bio Cell Signaling Review',
      course: 'AP Biology',
      time: 'Tomorrow • 6:30 PM',
      participants: ['Laasya Potuluri', 'Anya Vulupala', 'Andrew Boldea'],
      rsvped: false,
      createdByMe: false,
    },
    {
      id: 'session-2',
      title: 'DE English Essay Workshop',
      course: 'DE English',
      time: 'Friday • 5:00 PM',
      participants: ['Annika Shah', 'Jack Swartz'],
      rsvped: false,
      createdByMe: false,
    },
  ]);

  const [sessionEditor, setSessionEditor] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [sessionDraftTitle, setSessionDraftTitle] = useState('');
  const [sessionDraftCourse, setSessionDraftCourse] = useState('');
  const [sessionDraftTime, setSessionDraftTime] = useState('');

  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, Message[]>>(() =>
    friendsDirectory.reduce<Record<string, Message[]>>((acc, friend) => {
      acc[friend.id] = [
        {
          id: 1,
          from: 'them',
          text: friend.lastMessage || `Hey ${userName || 'there'}, ready to study?`,
          time: '4:12 PM',
        },
      ];
      return acc;
    }, {})
  );

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
      setFocusedParticipant(null);
      return;
    }

    setFocusedParticipant(activeCall.participants[0] || null);

    const timer = setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCall]);

  useEffect(() => {
    if (activeTab !== 'requests') return;
    requestReveal.setValue(0);
    Animated.timing(requestReveal, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [activeTab, requestReveal, requests.length]);

  const filteredFriends = useMemo(
    () => friendsDirectory.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery]
  );

  const activeChatFriend = friendsDirectory.find((f) => f.id === activeChatId) || null;

  const discoverPeople = [
    { id: 'zayyan', name: 'Zayyan Masud', school: 'Loudoun Valley High School' },
    { id: 'roshan', name: 'Roshan Shah', school: 'Dominion High School' },
    { id: 'catalina', name: 'Catalina Nemes', school: 'Loudoun Valley High School' },
  ];

  const showRequestFeedback = (text: string, color: string) => {
    setRequestFeedback({ text, color });
    requestFeedbackOpacity.setValue(0);
    requestFeedbackTranslate.setValue(-8);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(requestFeedbackOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(requestFeedbackTranslate, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(requestFeedbackOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(requestFeedbackTranslate, {
          toValue: -8,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setRequestFeedback(null));
  };

  const sendMessage = () => {
    const text = draftMessage.trim();
    if (!text || !activeChatId) return;

    // Swoosh animation
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

    setTimeout(() => {
      setMessagesByFriend((prev) => ({
        ...prev,
        [activeChatId]: [
          ...(prev[activeChatId] || []),
          {
            id: Date.now() + 1,
            from: 'them',
            text: 'Nice, I can add this into a merged review version too.',
            time: currentTimeLabel(),
          },
        ],
      }));
    }, 700);
  };

  const startFriendCall = (friendName: string, mode: CallMode) => {
    setActiveCall({
      mode,
      title: mode === 'voice' ? `Voice with ${friendName}` : `Video with ${friendName}`,
      participants: [friendName, userName || 'You'],
      startedAt: Date.now(),
    });
  };

  const openLiveSession = () => {
    const participants = ['Laasya Potuluri', 'Anya Vulupala', 'Andrew Boldea', userName || 'You'];
    setActiveCall({
      mode: 'group',
      title: 'AP Human Geography Live Session',
      participants,
      startedAt: Date.now(),
    });
  };

  const openSession = (session: StudySession) => {
    const participants = [...session.participants];
    if (!participants.includes(userName || 'You')) participants.push(userName || 'You');

    setActiveCall({
      mode: 'group',
      title: session.title,
      participants,
      startedAt: Date.now(),
    });
  };

  const toggleRequest = (id: string, accepted: boolean) => {
    const selected = requests.find((request) => request.id === id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRequests((prev) => prev.filter((request) => request.id !== id));
    if (accepted) {
      showRequestFeedback(`Accepted ${selected?.name || 'request'}.`, '#166534');
      setActiveTab('friends');
    } else {
      showRequestFeedback(`Declined ${selected?.name || 'request'}.`, '#991b1b');
    }
  };

  const toggleRsvp = (id: string) => {
    setUpcomingSessions((prev) =>
      prev.map((session) => (session.id === id ? { ...session, rsvped: !session.rsvped } : session))
    );
  };

  const openCreateSessionEditor = () => {
    setSessionEditor({ mode: 'create' });
    setSessionDraftTitle('');
    setSessionDraftCourse('Custom Session');
    setSessionDraftTime('');
  };

  const openEditSessionEditor = (session: StudySession) => {
    setSessionEditor({ mode: 'edit', id: session.id });
    setSessionDraftTitle(session.title);
    setSessionDraftCourse(session.course);
    setSessionDraftTime(session.time);
  };

  const saveSession = () => {
    const title = sessionDraftTitle.trim() || 'New Study Session';
    const course = sessionDraftCourse.trim() || 'Custom Session';
    const time = sessionDraftTime.trim() || 'TBD';

    if (!sessionEditor) return;

    if (sessionEditor.mode === 'create') {
      setUpcomingSessions((prev) => [
        {
          id: `session-${Date.now()}`,
          title,
          course,
          time,
          participants: [userName || 'You'],
          rsvped: true,
          createdByMe: true,
        },
        ...prev,
      ]);
    } else {
      setUpcomingSessions((prev) =>
        prev.map((session) =>
          session.id === sessionEditor.id
            ? {
              ...session,
              title,
              course,
              time,
            }
            : session
        )
      );
    }

    setSessionEditor(null);
  };

  const deleteSession = (id: string) => {
    Alert.alert('Delete Session', 'Delete this session from your schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setUpcomingSessions((prev) => prev.filter((session) => session.id !== id)),
      },
    ]);
  };

  const sendDiscoverInvite = (person: { id: string; name: string }) => {
    if (sentDiscoverInvites.has(person.id)) return;
    setSentDiscoverInvites((prev) => new Set(prev).add(person.id));
    showRequestFeedback(`Friend request sent to ${person.name}.`, '#166534');
  };

  if (activeCall) {
    const isVideo = activeCall.mode !== 'voice';
    const participants = activeCall.participants;
    const focusName = focusedParticipant || participants[0] || 'Session';
    const otherParticipants = participants.filter((name) => name !== focusName);

    return (
      <View style={styles.callScreen}>
        <View style={styles.callGlowOne} />
        <View style={styles.callGlowTwo} />

        <View style={styles.callTopRow}>
          <TouchableOpacity style={styles.callTopBtn} onPress={() => setActiveCall(null)}>
            <Ionicons name="chevron-down" size={22} color="white" />
          </TouchableOpacity>
          <View style={styles.callTitleWrap}>
            <Text style={styles.callTypeLabel}>{activeCall.mode === 'voice' ? 'VOICE CALL' : 'LIVE SESSION'}</Text>
            <Text style={styles.callTitleText} numberOfLines={1}>
              {activeCall.title}
            </Text>
            <Text style={styles.callClock}>{formatDuration(callSeconds)}</Text>
          </View>
          <View style={styles.callTopBtnPlaceholder} />
        </View>

        <View style={styles.callStatusRow}>
          <View style={[styles.callStatusPill, micMuted && styles.callStatusPillMuted]}>
            <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={12} color={micMuted ? '#fecaca' : '#bbf7d0'} />
            <Text style={styles.callStatusText}>{micMuted ? 'Muted' : 'Mic On'}</Text>
          </View>
          <View style={[styles.callStatusPill, !speakerOn && styles.callStatusPillMuted]}>
            <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={12} color={speakerOn ? '#bbf7d0' : '#fecaca'} />
            <Text style={styles.callStatusText}>{speakerOn ? 'Speaker On' : 'Speaker Off'}</Text>
          </View>
          {isVideo && (
            <View style={[styles.callStatusPill, !cameraOn && styles.callStatusPillMuted]}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={12} color={cameraOn ? '#bbf7d0' : '#fecaca'} />
              <Text style={styles.callStatusText}>{cameraOn ? 'Camera On' : 'Camera Off'}</Text>
            </View>
          )}
        </View>

        {isVideo ? (
          <View style={styles.videoStage}>
            <View style={styles.videoFocusTile}>
              <Text style={styles.videoFocusName}>{focusName}</Text>
              <Text style={styles.videoFocusHint}>{focusName === (userName || 'You') && !cameraOn ? 'Camera is off' : 'Live video'}</Text>
              <Ionicons
                name={focusName === (userName || 'You') && !cameraOn ? 'videocam-off' : 'videocam'}
                size={22}
                color="rgba(255,255,255,0.9)"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoThumbRow}>
              {otherParticipants.map((name) => (
                <TouchableOpacity key={name} style={styles.videoThumb} onPress={() => setFocusedParticipant(name)}>
                  <Ionicons name="person" size={18} color="white" />
                  <Text style={styles.videoThumbText} numberOfLines={1}>
                    {name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.voiceStage}>
            <View style={styles.voiceAvatarOuter}>
              <View style={styles.voiceAvatarInner}>
                <Ionicons name="person" size={42} color="white" />
              </View>
            </View>
            <Text style={styles.voiceName}>{participants[0]}</Text>
            <Text style={styles.voiceHint}>{speakerOn ? 'Speakerphone enabled' : 'Speakerphone disabled'}</Text>
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

  if (sessionEditor) {
    const isEditing = sessionEditor.mode === 'edit';

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editorHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSessionEditor(null)}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.editorTitleWrap}>
            <Text style={styles.editorTitle}>{isEditing ? 'Edit Session' : 'Create Session'}</Text>
            <Text style={styles.editorSubtitle}>Configure your live study room details</Text>
          </View>
        </View>

        <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
          <View style={styles.editorCard}>
            <Text style={styles.modalLabel}>Session Title</Text>
            <TextInput
              style={styles.modalInput}
              value={sessionDraftTitle}
              onChangeText={setSessionDraftTitle}
              placeholder="Ex: Unit 7 Blitz"
            />
            <Text style={styles.modalLabel}>Course</Text>
            <TextInput
              style={styles.modalInput}
              value={sessionDraftCourse}
              onChangeText={setSessionDraftCourse}
              placeholder="Ex: AP Biology"
            />
            <Text style={styles.modalLabel}>Time</Text>
            <TextInput
              style={styles.modalInput}
              value={sessionDraftTime}
              onChangeText={setSessionDraftTime}
              placeholder="Ex: Saturday • 7:00 PM"
            />

            <TouchableOpacity style={styles.editorSaveBtn} onPress={saveSession}>
              <Text style={styles.editorSaveText}>{isEditing ? 'Save Changes' : 'Create Session'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Connect, chat, and jump into live sessions</Text>
          </View>
          <View style={styles.avatarWrap}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={24} color={colors.textTertiary} />
            )}
          </View>
        </View>

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(['friends', 'requests', 'sessions', 'discover'] as Tab[]).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab[0].toUpperCase() + tab.slice(1)}</Text>
              {tab === 'friends' && (
                <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{friendsDirectory.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {requestFeedback && (
          <Animated.View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: requestFeedback.color,
                opacity: requestFeedbackOpacity,
                transform: [{ translateY: requestFeedbackTranslate }],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={14} color="white" />
            <Text style={styles.feedbackText}>{requestFeedback.text}</Text>
          </Animated.View>
        )}

        {activeTab === 'friends' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Active Now</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {filteredFriends
                .filter((f) => f.status !== 'offline')
                .map((friend) => (
                  <TouchableOpacity key={friend.id} style={styles.friendChip} onPress={() => setActiveChatId(friend.id)}>
                    <View style={[styles.friendChipAvatar, { backgroundColor: friend.color }]}>
                      <Ionicons name="person" size={24} color="#6366f1" />
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        friend.status === 'online' && styles.statusOnline,
                        friend.status === 'studying' && styles.statusStudying,
                      ]}
                    />
                    <Text style={styles.friendChipName} numberOfLines={1}>
                      {friend.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

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
                  <Text style={[styles.friendStatus, friend.status === 'studying' && styles.friendStatusStudying]}>
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
                  <TouchableOpacity style={styles.actionBtn} onPress={() => startFriendCall(friend.name, 'video')}>
                    <Ionicons name="videocam-outline" size={18} color={colors.maroon} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'requests' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Incoming Requests</Text>
            {requests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="person-add" size={24} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>No pending requests</Text>
              </View>
            ) : (
              requests.map((request, index) => (
                <Animated.View
                  key={request.id}
                  style={[
                    styles.requestCardWrap,
                    {
                      opacity: requestReveal,
                      transform: [
                        {
                          translateY: requestReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12 + index * 6, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.requestCard}>
                    <TouchableOpacity onPress={() => onPersonOpen?.({
                      id: request.id,
                      name: request.name,
                      color: '#E0E7FF',
                      status: 'offline',
                      school: request.school,
                    })} activeOpacity={0.7}>
                      <Text style={styles.requestName}>{request.name}</Text>
                    </TouchableOpacity>
                    <Text style={styles.requestMeta}>{request.school}</Text>
                    <View style={styles.requestActions}>
                      <AnimatedPressable style={styles.requestDecline} onPress={() => toggleRequest(request.id, false)} scaleDown={0.92}>
                        <Ionicons name="close" size={14} color={colors.textSecondary} />
                        <Text style={styles.requestDeclineText}>Decline</Text>
                      </AnimatedPressable>
                      <AnimatedPressable style={styles.requestAccept} onPress={() => toggleRequest(request.id, true)} scaleDown={0.92}>
                        <Ionicons name="checkmark" size={14} color="white" />
                        <Text style={styles.requestAcceptText}>Accept</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {activeTab === 'sessions' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Live Session</Text>
            <View style={styles.sessionCardLive}>
              <View style={styles.sessionBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.sessionTitle}>AP Human Geography Multi-Person Review</Text>
              <Text style={styles.sessionSub}>Laasya, Anya, Andrew, and others are in this room now.</Text>
              <TouchableOpacity style={styles.joinBtn} onPress={openLiveSession}>
                <Ionicons name="videocam" size={14} color="white" />
                <Text style={styles.joinBtnText}>Join Live Video</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sessionHeaderRow}>
              <Text style={styles.sectionLabel}>Upcoming Sessions</Text>
              <TouchableOpacity style={styles.createSessionBtn} onPress={openCreateSessionEditor}>
                <Ionicons name="add" size={14} color="white" />
                <Text style={styles.createSessionText}>Create</Text>
              </TouchableOpacity>
            </View>

            {upcomingSessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                <Text style={styles.sessionCourse}>{session.course}</Text>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <Text style={styles.sessionMeta}>{session.time}</Text>
                <Text style={styles.sessionParticipants} numberOfLines={1}>
                  {session.participants.join(', ')}
                </Text>

                <View style={styles.sessionActionsRow}>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, session.rsvped && styles.rsvpBtnActive]}
                    onPress={() => toggleRsvp(session.id)}
                  >
                    <Text style={[styles.rsvpText, session.rsvped && styles.rsvpTextActive]}>
                      {session.rsvped ? 'RSVPed' : 'RSVP'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.openSessionBtn} onPress={() => openSession(session)}>
                    <Text style={styles.openSessionBtnText}>Open Session</Text>
                  </TouchableOpacity>
                </View>

                {session.createdByMe && (
                  <View style={styles.ownerActions}>
                    <TouchableOpacity style={styles.ownerActionBtn} onPress={() => openEditSessionEditor(session)}>
                      <Ionicons name="pencil" size={14} color={colors.maroon} />
                      <Text style={styles.ownerActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ownerActionBtn} onPress={() => deleteSession(session.id)}>
                      <Ionicons name="trash" size={14} color="#b91c1c" />
                      <Text style={styles.ownerActionDangerText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'discover' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Discover Friends</Text>
            {discoverPeople.map((person) => (
              <View key={person.id} style={styles.discoverCard}>
                <View style={styles.discoverAvatar}>
                  <Ionicons name="person" size={18} color={colors.maroon} />
                </View>
                <View style={styles.discoverInfo}>
                  <Text style={styles.discoverName}>{person.name}</Text>
                  <Text style={styles.discoverSchool}>{person.school}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.discoverAddBtn, sentDiscoverInvites.has(person.id) && styles.discoverAddBtnSent]}
                  onPress={() => sendDiscoverInvite(person)}
                  disabled={sentDiscoverInvites.has(person.id)}
                >
                  <Text style={styles.discoverAddText}>{sentDiscoverInvites.has(person.id) ? 'Requested' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: `${colors.maroon}18`,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: '100%', height: '100%' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 52,
    gap: 12,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0, fontFamily: fonts.medium },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  tabActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  tabText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  tabTextActive: { color: 'white' },
  tabBadge: { backgroundColor: `${colors.maroon}18`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeText: { fontSize: 10, fontFamily: fonts.bold, color: colors.maroon },
  tabBadgeTextActive: { color: 'white' },
  feedbackBanner: {
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  feedbackText: { color: 'white', fontSize: 12, fontFamily: fonts.bold },

  section: { marginTop: 24 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary, marginBottom: 12, letterSpacing: 0.5 },
  horizontalList: { gap: 12, paddingBottom: 8 },
  friendChip: { alignItems: 'center', width: 72 },
  friendChipAvatar: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statusDot: {
    position: 'absolute',
    bottom: 18,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#9ca3af',
    borderWidth: 2,
    borderColor: 'white',
  },
  statusDotSmall: {
    position: 'absolute',
    left: 36,
    top: 36,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#9ca3af',
    borderWidth: 2,
    borderColor: 'white',
  },
  statusOnline: { backgroundColor: '#22c55e' },
  statusStudying: { backgroundColor: '#f59e0b' },
  friendChipName: { fontSize: 11, fontFamily: fonts.medium, color: colors.textPrimary, marginTop: 6, maxWidth: 72 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  friendAvatar: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  friendStatus: { fontSize: 11, color: '#22c55e', fontFamily: fonts.medium },
  friendStatusStudying: { color: '#f59e0b' },
  friendActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: `${colors.maroon}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  requestCardWrap: { marginBottom: 10 },
  requestCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 2, borderColor: '#F0E0D0' },
  requestName: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  requestMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  requestDecline: {
    flex: 1,
    height: 42,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  requestDeclineText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bold },
  requestAccept: {
    flex: 1,
    height: 42,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAcceptText: { fontSize: 13, color: 'white', fontFamily: fonts.bold },
  emptyState: { backgroundColor: 'white', borderRadius: 20, padding: 22, alignItems: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  emptyTitle: { marginTop: 8, fontFamily: fonts.bold, color: colors.textPrimary },

  sessionCardLive: { backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 2, borderColor: '#F0E0D0' },
  sessionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  createSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.maroon,
    borderRadius: 14,
    height: 32,
    paddingHorizontal: 12,
  },
  createSessionText: { color: 'white', fontSize: 11, fontFamily: fonts.bold },
  sessionCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 8, borderWidth: 2, borderColor: '#F0E0D0' },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { fontSize: 10, fontFamily: fonts.bold, color: '#ef4444' },
  sessionCourse: { fontSize: 10, color: colors.textTertiary, marginTop: 8, fontFamily: fonts.regular },
  sessionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  sessionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 6, fontFamily: fonts.medium },
  sessionParticipants: { fontSize: 11, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  joinBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    backgroundColor: colors.maroon,
    borderRadius: 16,
  },
  joinBtnText: { fontSize: 12, fontFamily: fonts.bold, color: 'white' },
  sessionActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rsvpBtn: {
    flex: 1,
    height: 36,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpBtnActive: { backgroundColor: `${colors.maroon}12`, borderColor: `${colors.maroon}40` },
  rsvpText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.bold },
  rsvpTextActive: { color: colors.maroon },
  openSessionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSessionBtnText: { color: 'white', fontSize: 12, fontFamily: fonts.bold },
  ownerActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  ownerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#FFF5ED',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  ownerActionText: { fontSize: 12, fontFamily: fonts.bold, color: colors.maroon },
  ownerActionDangerText: { fontSize: 12, fontFamily: fonts.bold, color: '#b91c1c' },

  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  discoverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: `${colors.maroon}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverInfo: { flex: 1 },
  discoverName: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.bold },
  discoverSchool: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  discoverAddBtn: {
    height: 32,
    borderRadius: 14,
    backgroundColor: colors.maroon,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverAddBtnSent: { backgroundColor: '#166534' },
  discoverAddText: { color: 'white', fontSize: 11, fontFamily: fonts.bold },

  chatHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  chatHeaderInfo: { flex: 1 },
  chatFriendName: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  chatFriendStatus: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  chatTopAction: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: `${colors.maroon}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  messageRow: { marginBottom: 10, alignItems: 'flex-start' },
  messageRowMe: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '78%', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 2, borderColor: '#F0E0D0' },
  messageBubbleMe: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  messageText: { fontSize: 13, color: colors.textPrimary, lineHeight: 18, fontFamily: fonts.regular },
  messageTextMe: { color: 'white' },
  messageTime: { fontSize: 10, color: colors.textTertiary, marginTop: 4, fontFamily: fonts.regular },
  messageTimeMe: { color: 'rgba(255,255,255,0.8)' },
  chatComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  chatInput: {
    flex: 1,
    height: 44,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },

  callScreen: { flex: 1, backgroundColor: '#140709', paddingTop: 56, paddingHorizontal: 18, paddingBottom: 24 },
  callGlowOne: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(127,29,29,0.45)',
  },
  callGlowTwo: {
    position: 'absolute',
    bottom: 120,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(30,64,175,0.22)',
  },
  callTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  callTopBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTopBtnPlaceholder: { width: 42, height: 42 },
  callTitleWrap: { alignItems: 'center', flex: 1, paddingHorizontal: 12 },
  callTypeLabel: { fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bold },
  callTitleText: { fontSize: 18, color: 'white', fontFamily: fonts.bold, marginTop: 4 },
  callClock: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontFamily: fonts.medium },
  callStatusRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  callStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  callStatusPillMuted: { backgroundColor: 'rgba(220,38,38,0.18)' },
  callStatusText: { color: 'white', fontSize: 11, fontFamily: fonts.bold },

  videoStage: { flex: 1, marginTop: 16 },
  videoFocusTile: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 280,
  },
  videoFocusName: { color: 'white', fontSize: 20, fontFamily: fonts.bold },
  videoFocusHint: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: fonts.regular },
  videoThumbRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingBottom: 8 },
  videoThumb: {
    width: 104,
    height: 78,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  videoThumbText: { color: 'white', fontSize: 11, fontFamily: fonts.bold },

  voiceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  voiceAvatarOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  voiceAvatarInner: {
    width: 142,
    height: 142,
    borderRadius: 71,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.maroon}95`,
  },
  voiceName: { color: 'white', fontSize: 24, fontFamily: fonts.bold },
  voiceHint: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontFamily: fonts.regular },

  callControlsDock: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  callControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callControlBtnActive: { backgroundColor: colors.maroon },
  callEndBtn: { backgroundColor: '#dc2626' },

  editorHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editorTitleWrap: { flex: 1 },
  editorTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  editorSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  editorScroll: { flex: 1 },
  editorContent: { paddingHorizontal: 20, paddingBottom: 40 },
  editorCard: { marginTop: 12, backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 2, borderColor: '#F0E0D0' },
  editorSaveBtn: {
    marginTop: 18,
    height: 50,
    borderRadius: 20,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorSaveText: { color: 'white', fontSize: 14, fontFamily: fonts.bold },

  modalLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bold, marginTop: 8, marginBottom: 6 },
  modalInput: {
    height: 50,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    backgroundColor: 'white',
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
});
