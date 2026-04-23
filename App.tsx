import React, { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Alert, Share, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SplashScreen } from './src/screens/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CourseDetailScreen } from './src/screens/CourseDetailScreen';
import { FilesScreen } from './src/screens/FilesScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { PersonProfileScreen } from './src/screens/PersonProfileScreen';
import { InfoPageScreen } from './src/screens/InfoPageScreen';
import { SchoolScreen } from './src/screens/SchoolScreen';
import type { Screen, FriendData, ClassInvite } from './src/types';
import type { UserData, ClassData, FileData } from './src/types';
import { defaultClasses } from './src/data/defaultClasses';
import { supabase } from './src/lib/supabase';
import { uploadAvatar } from './src/lib/storage';
import { Session } from '@supabase/supabase-js';

const SUPPORT_EMAIL = 'my.citadel.official@gmail.com';

type ShortcutItem = {
  id: string;
  type: 'class' | 'school';
  label: string;
  refId?: string;
};

type FriendRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_username: string;
  from_display_name: string;
  from_school?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

const TUTORIAL_TOTAL_STEPS = 7;

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [signInOnly, setSignInOnly] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen>('home');
  const [userData, setUserData] = useState<UserData>({ name: '', username: '', email: '', grade: '', schools: [], primarySchool: '', profilePicture: null });
  const [classes, setClasses] = useState<ClassData[]>(defaultClasses);
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [classInvites, setClassInvites] = useState<ClassInvite[]>([]);
  const [unitProgress, setUnitProgress] = useState<Record<string, boolean>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>('1');
  const [selectedPerson, setSelectedPerson] = useState<FriendData | null>(null);
  const [activeInfoPage, setActiveInfoPage] = useState<'help' | 'terms' | 'privacy'>('help');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [schoolBackScreen, setSchoolBackScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const pendingTutorialRef = useRef(false);

  // Prevent saving to Supabase until initial data is loaded
  const dataLoadedRef = useRef(false);

  // ═══════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id);
      } else {
        setAuthInitialized(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id);
      } else {
        setUserData({ name: '', username: '', email: '', grade: '', schools: [], primarySchool: '', profilePicture: null });
        setClasses([]);
        setShortcuts([]);
        setFriends([]);
        setFriendRequests([]);
        setClassInvites([]);
        dataLoadedRef.current = false;
        setCurrentScreen('onboarding');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ═══════════════════════════════════════════
  // REAL-TIME SUBSCRIPTIONS + FOREGROUND REFRESH
  // ═══════════════════════════════════════════
  // Use a ref so realtime callbacks always call the latest loader functions
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    // Subscribe to friend_requests changes (INSERT, UPDATE, DELETE)
    const frChannel = supabase.channel('friend-requests-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `to_user_id=eq.${userId}`,
      }, () => {
        loadFriendRequests(userId);
        loadFriends(userId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `from_user_id=eq.${userId}`,
      }, () => {
        loadFriendRequests(userId);
        loadFriends(userId);
      })
      .subscribe();

    // Subscribe to class_invites changes
    const ciChannel = supabase.channel('class-invites-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'class_invites',
        filter: `to_user_id=eq.${userId}`,
      }, () => {
        loadClassInvites(userId);
      })
      .subscribe();

    // Subscribe to friends table changes (both sides)
    const friendsChannel = supabase.channel('friends-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends',
        filter: `user_id=eq.${userId}`,
      }, () => {
        loadFriends(userId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends',
        filter: `friend_id=eq.${userId}`,
      }, () => {
        loadFriends(userId);
      })
      .subscribe();

    // Refresh everything when app comes back to foreground
    const appStateListener = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && sessionRef.current?.user?.id) {
        const uid = sessionRef.current.user.id;
        loadFriendRequests(uid);
        loadClassInvites(uid);
        loadFriends(uid);
      }
    });

    // Periodic poll every 30s as a safety net
    const pollInterval = setInterval(() => {
      if (sessionRef.current?.user?.id) {
        const uid = sessionRef.current.user.id;
        loadFriendRequests(uid);
        loadClassInvites(uid);
        loadFriends(uid);
      }
    }, 30000);

    return () => {
      supabase.removeChannel(frChannel);
      supabase.removeChannel(ciChannel);
      supabase.removeChannel(friendsChannel);
      appStateListener.remove();
      clearInterval(pollInterval);
    };
  }, [session?.user?.id]);

  // ═══════════════════════════════════════════
  // FETCH PROFILE + ALL DATA
  // ═══════════════════════════════════════════
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const sessionData = await supabase.auth.getSession();
      const userEmail = sessionData.data.session?.user.email || '';

      if (data) {
        // Migrate from single school to multi-school
        const dbSchools: string[] = data.schools && Array.isArray(data.schools) && data.schools.length > 0
          ? data.schools
          : (data.school ? [data.school] : []);
        const dbPrimary = dbSchools[0] || '';

        setUserData({
          name: data.display_name || '',
          username: data.username || '',
          email: userEmail,
          grade: data.grade || '',
          schools: dbSchools,
          primarySchool: dbPrimary,
          profilePicture: data.avatar_url || null,
        });
      } else {

        const metadata = sessionData.data.session?.user.user_metadata || {};
        const defaultUsername = userData.username || metadata.username || `user_${userId.substring(0, 6)}`;
        const defaultName = userData.name || metadata.display_name || '';
        const defaultGrade = userData.grade || metadata.grade || '';
        const defaultSchools: string[] = userData.schools.length > 0 ? userData.schools : (metadata.school ? [metadata.school] : []);

        await supabase.from('profiles').insert([{
          id: userId,
          username: defaultUsername,
          display_name: defaultName,
          grade: defaultGrade,
          school: defaultSchools[0] || '',
          schools: defaultSchools,
        }]);

        setUserData(prev => ({
          ...prev,
          email: userEmail,
          name: defaultName,
          username: defaultUsername,
          grade: defaultGrade,
          schools: defaultSchools,
          primarySchool: defaultSchools[0] || '',
        }));
      }

      // Navigate to home immediately — don't wait for secondary data
      setAuthInitialized(true);
      setCurrentScreen('home');

      // Load all secondary data in parallel in the background
      await Promise.all([
        loadClasses(userId),
        loadShortcuts(userId),
        loadFriends(userId),
        loadFriendRequests(userId),
        loadClassInvites(userId),
        loadProgress(userId),
      ]);

      dataLoadedRef.current = true;

      // Show tutorial for brand-new sign-ups (flag set by onBeforeSignUp)
      if (pendingTutorialRef.current) {
        pendingTutorialRef.current = false;
        try {
          const tutorialKey = `tutorial_seen_${userId}`;
          const seen = await AsyncStorage.getItem(tutorialKey);
          if (!seen) {
            await AsyncStorage.setItem(tutorialKey, 'true');
            setTimeout(() => setTutorialStep(1), 800);
          }
        } catch {}
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setCurrentScreen('home');
    } finally {
      setAuthInitialized(true);
    }
  };

  // ═══════════════════════════════════════════
  // CLASSES SYNC
  // ═══════════════════════════════════════════
  const loadClasses = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_classes')
        .select('class_data')
        .eq('user_id', userId);

      if (data && data.length > 0) {
        const loaded = data.map((row: any) => row.class_data as ClassData);
        setClasses(loaded);
      } else {
        setClasses([]);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  };

  const saveClasses = useCallback(async (classesData: ClassData[]) => {
    if (!session?.user?.id || !dataLoadedRef.current) return;
    const userId = session.user.id;

    try {
      // Delete existing and re-insert
      await supabase.from('user_classes').delete().eq('user_id', userId);

      if (classesData.length > 0) {
        const rows = classesData.map((cls) => ({
          user_id: userId,
          class_data: cls,
        }));
        await supabase.from('user_classes').insert(rows);
      }

      // Sync class codes to the registry for cross-user discovery
      await syncClassCodes(userId, classesData);
    } catch (err) {
      console.error('Error saving classes:', err);
    }
  }, [session?.user?.id]);

  // Sync class codes to publicly-readable locations so other users can join by code
  const syncClassCodes = async (userId: string, classesData: ClassData[]) => {
    try {
      // Strategy 1: Try dedicated class_code_registry table
      const registryRows = classesData.map((cls) => ({
        class_code: cls.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
        class_data: cls,
        owner_id: userId,
      }));

      // Delete old entries for this user, then insert new ones
      await supabase.from('class_code_registry').delete().eq('owner_id', userId);
      if (registryRows.length > 0) {
        await supabase.from('class_code_registry').insert(registryRows);
      }

      // Count how many users have each class code and update classmates
      try {
        for (const cls of classesData) {
          const normalized = cls.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const { data: countData } = await supabase
            .from('class_code_registry')
            .select('owner_id')
            .eq('class_code', normalized);

          if (countData && countData.length > 0) {
            const memberCount = countData.length;
            // Only update if the count has changed
            if (memberCount !== cls.classmates) {
              setClasses((prev) =>
                prev.map((c) =>
                  c.classCode === cls.classCode
                    ? { ...c, classmates: memberCount }
                    : c
                )
              );
            }
          }
        }
      } catch {
        // Count query failed, that's ok
      }
    } catch {
      // Registry table may not exist yet — fall through to fallback
    }

    try {
      // Strategy 2 (fallback): Store class codes in the user's profile as JSON
      // This works because profiles table is publicly readable
      const codeLookup = classesData.reduce((acc: Record<string, any>, cls) => {
        const normalized = cls.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        acc[normalized] = {
          title: cls.title,
          block: cls.block,
          classCode: cls.classCode,
          color: cls.color,
          description: cls.description,
          school: cls.school || '',
          units: cls.units,
          files: [],
          documents: 0,
          classmates: cls.classmates,
          classmateNames: cls.classmateNames,
          image: cls.image,
        };
        return acc;
      }, {});
      await supabase.from('profiles').update({ class_codes: codeLookup }).eq('id', userId);
    } catch {
      // class_codes column may not exist — that's ok
    }
  };

  // Auto-save classes when they change
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveClasses(classes);
    }
  }, [classes, saveClasses]);

  // ═══════════════════════════════════════════
  // SHORTCUTS SYNC (AsyncStorage — local)
  // ═══════════════════════════════════════════
  const loadShortcuts = async (userId: string) => {
    try {
      const stored = await AsyncStorage.getItem(`@shortcuts_${userId}`);
      if (stored) {
        setShortcuts(JSON.parse(stored) as ShortcutItem[]);
      } else {
        setShortcuts([]);
      }
    } catch (err) {
      console.error('Error loading shortcuts:', err);
      setShortcuts([]);
    }
  };

  const saveShortcuts = useCallback(async (items: ShortcutItem[]) => {
    if (!session?.user?.id || !dataLoadedRef.current) return;
    try {
      await AsyncStorage.setItem(`@shortcuts_${session.user.id}`, JSON.stringify(items));
    } catch (err) {
      console.error('Error saving shortcuts:', err);
    }
  }, [session?.user?.id]);

  // Auto-save shortcuts when they change
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveShortcuts(shortcuts);
    }
  }, [shortcuts, saveShortcuts]);

  const handleUpdateShortcuts = useCallback((newShortcuts: ShortcutItem[]) => {
    setShortcuts(newShortcuts);
  }, []);

  // ═══════════════════════════════════════════
  // UNIT/SECTION PROGRESS SYNC
  // ═══════════════════════════════════════════
  const loadProgress = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_progress')
        .select('progress')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.progress) {
        setUnitProgress(data.progress as Record<string, boolean>);
      } else {
        setUnitProgress({});
      }
    } catch (err) {
      console.error('Error loading progress:', err);
    }
  };

  const saveProgress = useCallback(async (progress: Record<string, boolean>) => {
    if (!session?.user?.id || !dataLoadedRef.current) return;
    const userId = session.user.id;

    try {
      const { data } = await supabase
        .from('user_progress')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        await supabase.from('user_progress').update({ progress, updated_at: new Date().toISOString() }).eq('user_id', userId);
      } else {
        await supabase.from('user_progress').insert({ user_id: userId, progress });
      }
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  }, [session?.user?.id]);

  // Auto-save progress when it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveProgress(unitProgress);
    }
  }, [unitProgress, saveProgress]);

  const handleUpdateProgress = useCallback((newProgress: Record<string, boolean>) => {
    setUnitProgress(newProgress);
  }, []);

  // ═══════════════════════════════════════════
  // FRIENDS SYNC
  // ═══════════════════════════════════════════
  const loadFriends = useCallback(async (userId: string) => {
    try {
      // Load friends where user is either side of the friendship
      const { data: asUser } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      const { data: asFriend } = await supabase
        .from('friends')
        .select('user_id')
        .eq('friend_id', userId);

      const friendIds = [
        ...(asUser || []).map((row: any) => row.friend_id),
        ...(asFriend || []).map((row: any) => row.user_id),
      ];

      // Deduplicate
      const uniqueIds = [...new Set(friendIds)];

      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, school, grade, avatar_url')
          .in('id', uniqueIds);

        if (profiles) {
          const friendData: FriendData[] = profiles.map((p: any) => ({
            id: p.id,
            name: p.display_name || p.username || 'User',
            color: '#E0E7FF',
            status: 'offline' as const,
            school: p.school || '',
            grade: p.grade || '',
            avatarUrl: p.avatar_url || null,
          }));
          setFriends(friendData);
        }
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  }, []);

  // Refresh friends data — can be called by screens to get latest profile data
  const handleRefreshFriends = useCallback(async () => {
    if (session?.user?.id) {
      await loadFriends(session.user.id);
    }
  }, [session?.user?.id, loadFriends]);

  // ═══════════════════════════════════════════
  // FRIEND REQUESTS
  // ═══════════════════════════════════════════
  const loadFriendRequests = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('to_user_id', userId)
        .eq('status', 'pending');

      if (data && data.length > 0) {
        // Fetch sender profiles
        const fromIds = data.map((r: any) => r.from_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, school')
          .in('id', fromIds);

        const profileMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const requests: FriendRequest[] = data.map((r: any) => {
          const profile = profileMap[r.from_user_id] || {};
          return {
            id: r.id,
            from_user_id: r.from_user_id,
            to_user_id: r.to_user_id,
            from_username: profile.username || 'unknown',
            from_display_name: profile.display_name || profile.username || 'User',
            from_school: profile.school || '',
            status: r.status,
            created_at: r.created_at,
          };
        });
        setFriendRequests(requests);
      } else {
        setFriendRequests([]);
      }
    } catch (err) {
      console.error('Error loading friend requests:', err);
    }
  };

  // ═══════════════════════════════════════════
  // CLASS INVITES
  // ═══════════════════════════════════════════
  const loadClassInvites = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_invites')
        .select('*')
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Class invites load error (table may not exist):', error.message);
        return;
      }

      if (data && data.length > 0) {
        // Fetch sender display names
        const fromIds = [...new Set(data.map((r: any) => r.from_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', fromIds);

        const profileMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const invites: ClassInvite[] = data.map((r: any) => {
          const profile = profileMap[r.from_user_id] || {};
          return {
            id: r.id,
            from_user_id: r.from_user_id,
            to_user_id: r.to_user_id,
            from_display_name: r.from_display_name || profile.display_name || profile.username || 'Someone',
            class_title: r.class_title,
            class_code: r.class_code,
            class_data: r.class_data as ClassData,
            status: r.status,
            created_at: r.created_at,
          };
        });
        setClassInvites(invites);
      } else {
        setClassInvites([]);
      }
    } catch (err) {
      console.log('Error loading class invites:', err);
    }
  };

  const handleSendClassInvite = async (toUserId: string, classesToInvite: ClassData[]) => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const senderName = userData.name || userData.username || 'Someone';

    try {
      const rows = classesToInvite.map((cls) => ({
        from_user_id: userId,
        to_user_id: toUserId,
        from_display_name: senderName,
        class_title: cls.title,
        class_code: cls.classCode,
        class_data: cls,
      }));

      const { error } = await supabase.from('class_invites').insert(rows);
      if (error) {
        console.log('Error sending class invite:', error.message);
        Alert.alert('Invite Error', 'Could not send invite. Please try again.');
      }
    } catch (err) {
      console.log('Error sending class invite:', err);
    }
  };

  const handleAcceptClassInvite = async (inviteId: string) => {
    const invite = classInvites.find((i) => i.id === inviteId);
    if (!invite) return;

    // Add the class
    const joinedClass: ClassData = {
      ...invite.class_data,
      id: Date.now().toString(),
      classmates: (invite.class_data.classmates || 0) + 1,
      classmateNames: [...(invite.class_data.classmateNames || []), ...(userData.name ? [userData.name] : [])],
    };
    handleAddClass(joinedClass);

    // Update invite status in Supabase
    try {
      await supabase.from('class_invites').update({ status: 'accepted' }).eq('id', inviteId);
    } catch (err) {
      console.log('Error accepting class invite:', err);
    }

    // Remove from local state
    setClassInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const handleDeclineClassInvite = async (inviteId: string) => {
    try {
      await supabase.from('class_invites').update({ status: 'declined' }).eq('id', inviteId);
    } catch (err) {
      console.log('Error declining class invite:', err);
    }
    setClassInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const handleSendRequest = async (username: string): Promise<{ success: boolean; message: string }> => {
    if (!session?.user?.id) return { success: false, message: 'Not logged in.' };
    const userId = session.user.id;

    try {
      // Can't add yourself
      if (username.toLowerCase() === userData.username.toLowerCase()) {
        return { success: false, message: "That's your own username!" };
      }

      // Find user by username
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('username', username)
        .maybeSingle();

      if (!targetProfile) {
        return { success: false, message: `No user found with username "${username}".` };
      }

      // Check if already friends
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', targetProfile.id)
        .maybeSingle();

      if (existingFriend) {
        return { success: false, message: `You're already friends with ${targetProfile.display_name || username}.` };
      }

      // Check if request already sent
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('from_user_id', userId)
        .eq('to_user_id', targetProfile.id)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return { success: false, message: 'Request already sent and pending.' };
        }
      }

      // Send the request
      const { error } = await supabase.from('friend_requests').insert({
        from_user_id: userId,
        to_user_id: targetProfile.id,
      });

      if (error) {
        if (error.code === '23505') return { success: false, message: 'Request already sent.' };
        console.error('Friend request error:', error.message);
        return { success: false, message: 'Could not send request. Please try again.' };
      }

      return { success: true, message: `Request sent to ${targetProfile.display_name || username}!` };
    } catch (err: any) {
      console.error('Friend request exception:', err);
      return { success: false, message: 'Something went wrong. Please try again.' };
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    try {
      // Get the request
      const req = friendRequests.find((r) => r.id === requestId);
      if (!req) return;

      // Delete the request (RLS allows to_user_id to DELETE via USING clause)
      await supabase.from('friend_requests').delete().eq('id', requestId);

      // Add friendship — only insert our own row (RLS blocks inserting for other users)
      await supabase.from('friends').insert({ user_id: userId, friend_id: req.from_user_id });

      // Refresh local state
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
      await loadFriends(userId);
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      // Delete the request (RLS allows to_user_id to DELETE via USING clause)
      await supabase.from('friend_requests').delete().eq('id', requestId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error('Error declining request:', err);
    }
  };

  // ═══════════════════════════════════════════
  // SPLASH TIMER
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (currentScreen === 'splash' && authInitialized && fontsLoaded) {
      const timer = setTimeout(() => {
        if (session) {
          setCurrentScreen('home');
        } else {
          setCurrentScreen('onboarding');
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, authInitialized, fontsLoaded, session]);

  // ═══════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════
  const navigate = (screen: Screen) => setCurrentScreen(screen);
  const goToTutorialStep = useCallback((step: number) => {
    const clampedStep = Math.max(1, Math.min(step, TUTORIAL_TOTAL_STEPS));
    const tutorialClassId = classes.some((cls) => cls.id === selectedClassId)
      ? selectedClassId
      : classes[0]?.id;

    setTutorialStep(clampedStep);

    if (clampedStep <= 2) {
      setCurrentScreen('home');
      return;
    }

    if ((clampedStep === 3 || clampedStep === 4) && tutorialClassId) {
      setSelectedClassId(tutorialClassId);
    }

    if (clampedStep === 3) {
      setCurrentScreen('course-detail');
      return;
    }

    if (clampedStep === 4) {
      setCurrentScreen('files');
      return;
    }

    if (clampedStep === 5) {
      setCurrentScreen('scan');
      return;
    }

    setCurrentScreen('friends');
  }, [classes, selectedClassId]);
  const advanceTutorial = useCallback(() => {
    if (tutorialStep === 0 || tutorialStep >= TUTORIAL_TOTAL_STEPS) return;
    goToTutorialStep(tutorialStep + 1);
  }, [goToTutorialStep, tutorialStep]);
  const retreatTutorial = useCallback(() => {
    if (tutorialStep <= 1) return;
    goToTutorialStep(tutorialStep - 1);
  }, [goToTutorialStep, tutorialStep]);
  const endTutorial = useCallback(() => setTutorialStep(0), []);
  const replayTutorial = useCallback(() => {
    setTutorialStep(1);
    setCurrentScreen('home');
  }, []);

  const handleOnboardingComplete = (data: { name: string; username: string; grade: string; schools: string[] }) => {
    setUserData((prev) => ({ ...prev, ...data, primarySchool: data.schools[0] || '' }));
    setSignInOnly(false);
    navigate('signin');
  };

  const handleBeforeSignUp = () => {
    pendingTutorialRef.current = true;
  };

  const handleSignIn = async (profilePicture: string | null, displayName?: string) => {

    if (profilePicture) {
      const sessionData = await supabase.auth.getSession();
      const userId = sessionData.data.session?.user.id;
      if (userId) {
        const publicUrl = await uploadAvatar(userId, profilePicture);
        if (publicUrl) {
          setUserData(prev => ({ ...prev, profilePicture: publicUrl }));
          const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
          if (error) console.error('Error saving avatar URL to profile:', error.message);
        }
      }
    }
  };

  const handleAddClass = (newClass: ClassData) => {
    if (tutorialStep > 0) {
      setSelectedClassId(newClass.id);
    }
    setClasses((prev) => [...prev, newClass]);
  };
  const handleRemoveClass = (id: string) => setClasses((prev) => prev.filter((c) => c.id !== id));
  const handleUpdateClass = (updatedClass: ClassData) =>
    setClasses((prev) => prev.map((c) => (c.id === updatedClass.id ? updatedClass : c)));

  const handleUpdateProfile = async (updates: Partial<UserData>) => {
    setUserData((prev) => ({ ...prev, ...updates }));

    if (session?.user?.id) {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.display_name = updates.name;
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.grade !== undefined) dbUpdates.grade = updates.grade;
      if (updates.schools !== undefined) {
        dbUpdates.schools = updates.schools;
        dbUpdates.school = updates.primarySchool || updates.schools[0] || '';
      }
      if (updates.primarySchool !== undefined) {
        dbUpdates.school = updates.primarySchool;
      }
      if (updates.profilePicture !== undefined) dbUpdates.avatar_url = updates.profilePicture;

      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from('profiles').update(dbUpdates).eq('id', session.user.id);
      }

      if (updates.email !== undefined && updates.email !== userData.email) {
        const { error } = await supabase.auth.updateUser({ email: updates.email });
        if (error) {
          Alert.alert('Email Update Failed', error.message);
          setUserData((prev) => ({ ...prev, email: userData.email }));
        } else {
          Alert.alert('Check your inbox', 'A confirmation link has been sent to your new email address.');
        }
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const openPersonProfile = (person: FriendData, fromScreen: Screen) => {
    setSelectedPerson(person);
    setPreviousScreen(fromScreen);
    navigate('person-profile');
  };

  const openPersonByName = (name: string, fromScreen: Screen) => {
    const found = friends.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (found) {
      openPersonProfile(found, fromScreen);
    } else {
      openPersonProfile({
        id: name.toLowerCase().replace(/\s/g, '-'),
        name,
        color: '#E0E7FF',
        status: 'offline',
      }, fromScreen);
    }
  };

  const openInfoPage = (page: 'help' | 'terms' | 'privacy') => {
    setActiveInfoPage(page);
    setPreviousScreen('profile');
    navigate('info-page');
  };

  const openSchool = (schoolName: string, fromScreen: Screen) => {
    setSelectedSchool(schoolName);
    setSchoolBackScreen(fromScreen);
    setPreviousScreen(fromScreen);
    navigate('school');
  };

  const handleRateApp = () => {
    Alert.alert('Rate Citadel ⭐', 'Thanks for using Citadel! Rating will open the App Store.', [
      { text: 'Not Now', style: 'cancel' },
      { text: 'Rate 5 Stars', onPress: () => { } },
    ]);
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out Citadel — the study app that makes school way better! 🎓🔥 Download it now!',
      });
    } catch { }
  };

  const handleOpenCourse = (classId: string) => {
    setSelectedClassId(classId);
    navigate('course-detail');
  };

  const openFiles = (classId?: string) => {
    if (classId) setSelectedClassId(classId);
    if (tutorialStep === 3) advanceTutorial();
    navigate('files');
  };

  const openScan = () => {
    if (tutorialStep === 4) advanceTutorial();
    navigate('scan');
  };

  const openFriends = () => {
    if (tutorialStep === 5) advanceTutorial();
    navigate('friends');
  };

  const handleSaveScan = (classId: string, file: FileData) => {
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId
          ? { ...cls, files: [file, ...cls.files], documents: cls.documents + 1 }
          : cls
      )
    );
    setSelectedClassId(classId);
    navigate('files');
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  if (!fontsLoaded || !authInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3D0C11" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        {currentScreen === 'splash' && <SplashScreen />}
        {currentScreen === 'onboarding' && <OnboardingScreen onGetStarted={handleOnboardingComplete} onSignIn={() => { setSignInOnly(true); navigate('signin'); }} />}
        {currentScreen === 'signin' && (
          <SignInScreen
            onSignIn={handleSignIn}
            onBack={() => navigate('onboarding')}
            onBeforeSignUp={handleBeforeSignUp}
            signInOnly={signInOnly}
            onGoToSignUp={() => { setSignInOnly(false); navigate('onboarding'); }}
            userName={signInOnly ? undefined : userData.name}
            userUsername={signInOnly ? undefined : userData.username}
            userGrade={signInOnly ? undefined : userData.grade}
            userSchool={signInOnly ? undefined : userData.primarySchool}
            userSchools={signInOnly ? undefined : userData.schools}
          />
        )}
        {currentScreen === 'home' && (
          <HomeScreen
            onCourseOpen={handleOpenCourse}
            onFilesOpen={openFiles}
            onScanOpen={openScan}
            onFriendsOpen={openFriends}
            onProfileOpen={() => navigate('profile')}
            userName={userData.name}
            profilePicture={userData.profilePicture}
            grade={userData.grade}
            school={userData.primarySchool}
            schools={userData.schools}
            onUpdateProfile={handleUpdateProfile}
            classes={classes}
            onAddClass={handleAddClass}
            onRemoveClass={handleRemoveClass}
            shortcuts={shortcuts}
            onUpdateShortcuts={handleUpdateShortcuts}
            onSchoolOpen={(schoolName: string) => openSchool(schoolName, 'home')}
            classInvites={classInvites}
            onAcceptClassInvite={handleAcceptClassInvite}
            onDeclineClassInvite={handleDeclineClassInvite}
            tutorialStep={tutorialStep}
            onTutorialNext={advanceTutorial}
            onTutorialBack={retreatTutorial}
            onTutorialSkip={endTutorial}
          />
        )}
        {currentScreen === 'profile' && (
          <ProfileScreen
            userData={userData}
            onUpdateProfile={handleUpdateProfile}
            onBack={() => navigate('home')}
            onLogout={handleLogout}
            classes={classes}
            onPersonOpen={(person) => openPersonProfile(person, 'profile')}
            onInfoPage={openInfoPage}
            onRateApp={handleRateApp}
            onShareApp={handleShareApp}
            onReplayTutorial={replayTutorial}
            session={session}
            onSchoolOpen={(schoolName: string) => openSchool(schoolName, 'profile')}
          />
        )}
        {currentScreen === 'person-profile' && selectedPerson && (
          <PersonProfileScreen
            person={selectedPerson}
            onBack={() => navigate(previousScreen)}
            onChat={() => navigate('friends')}
            classes={classes}
            isFriend={friends.some(f => f.id === selectedPerson.id)}
            onAddFriend={async (personId) => {
              if (!session?.user?.id) return;
              // Look up the person's username to use the proper send request flow
              const { data: targetProfile } = await supabase
                .from('profiles')
                .select('username, display_name')
                .eq('id', personId)
                .single();
              if (targetProfile?.username) {
                const result = await handleSendRequest(targetProfile.username);
                Alert.alert(
                  result.success ? 'Request Sent!' : 'Could Not Send',
                  result.message
                );
              } else {
                // Fallback: direct insert
                const { error } = await supabase.from('friend_requests').insert({
                  from_user_id: session.user.id,
                  to_user_id: personId,
                });
                if (error) {
                  Alert.alert('Error', error.code === '23505' ? 'Friend request already sent.' : 'Could not send request. Please try again.');
                } else {
                  Alert.alert('Request Sent!', 'Your friend request has been sent.');
                }
              }
            }}
            onRemoveFriend={async (personId) => {
              if (!session?.user?.id) return;
              await supabase.from('friends').delete().eq('user_id', session.user.id).eq('friend_id', personId);
              await supabase.from('friends').delete().eq('user_id', personId).eq('friend_id', session.user.id);
              await loadFriends(session.user.id);
              Alert.alert('Removed', 'Friend has been removed.');
            }}
            onSchoolOpen={(schoolName: string) => openSchool(schoolName, 'person-profile')}
            onSendClassInvite={(toUserId: string, cls: ClassData[]) => handleSendClassInvite(toUserId, cls)}
            session={session}
          />
        )}
        {currentScreen === 'info-page' && (
          <InfoPageScreen
            page={activeInfoPage}
            onBack={() => navigate(previousScreen)}
            supportEmail={SUPPORT_EMAIL}
          />
        )}
        {currentScreen === 'course-detail' && selectedClass && (
          <CourseDetailScreen
            classData={selectedClass}
            onBack={() => navigate('home')}
            onFilesOpen={() => openFiles()}
            onScan={openScan}
            onFriends={openFriends}
            onUpdateClass={handleUpdateClass}
            onPersonOpen={(name) => openPersonByName(name, 'course-detail')}
            unitProgress={unitProgress}
            onUpdateProgress={handleUpdateProgress}
            userName={userData.name}
            onSendClassInvite={(toUserId: string, cls: ClassData[]) => handleSendClassInvite(toUserId, cls)}
            tutorialStep={tutorialStep}
            onTutorialNext={advanceTutorial}
            onTutorialBack={retreatTutorial}
            onTutorialSkip={endTutorial}
          />
        )}
        {currentScreen === 'files' && (
          <FilesScreen
            classes={classes}
            initialClassId={selectedClassId}
            onBack={() => navigate('course-detail')}
            onHome={() => navigate('home')}
            onScan={openScan}
            onFriends={openFriends}
            onUpdateClass={handleUpdateClass}
            tutorialStep={tutorialStep}
            onTutorialNext={advanceTutorial}
            onTutorialBack={retreatTutorial}
            onTutorialSkip={endTutorial}
          />
        )}
        {currentScreen === 'scan' && (
          <ScanScreen
            onHome={() => navigate('home')}
            onFiles={() => openFiles()}
            onFriends={openFriends}
            classes={classes}
            onSaveScan={handleSaveScan}
            tutorialStep={tutorialStep}
            onTutorialNext={advanceTutorial}
            onTutorialBack={retreatTutorial}
            onTutorialSkip={endTutorial}
          />
        )}
        {currentScreen === 'friends' && (
          <FriendsScreen
            onHome={() => navigate('home')}
            onScan={openScan}
            onFiles={() => openFiles()}
            profilePicture={userData.profilePicture}
            userName={userData.name}
            userUsername={userData.username}
            onPersonOpen={(person) => openPersonProfile(person, 'friends')}
            onProfileOpen={() => navigate('profile')}
            friends={friends}
            friendRequests={friendRequests}
            onSendRequest={handleSendRequest}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            classes={classes}
            userSchool={userData.primarySchool}
            userSchools={userData.schools}
            onSchoolOpen={(schoolName: string) => openSchool(schoolName, 'friends')}
            classInvites={classInvites}
            onAcceptClassInvite={handleAcceptClassInvite}
            onDeclineClassInvite={handleDeclineClassInvite}
            onRefreshFriends={handleRefreshFriends}
            tutorialStep={tutorialStep}
            onTutorialNext={advanceTutorial}
            onTutorialBack={retreatTutorial}
            onTutorialSkip={endTutorial}
            onTutorialFinish={endTutorial}
          />
        )}
        {currentScreen === 'school' && (
          <SchoolScreen
            schoolName={selectedSchool}
            onBack={() => navigate('home')}
            onPersonOpen={(person) => openPersonProfile(person, 'school')}
            classes={classes}
            currentUserId={session?.user?.id || null}
            onAddClass={handleAddClass}
            onCourseOpen={handleOpenCourse}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  loadingContainer: { flex: 1, backgroundColor: '#3D0C11', alignItems: 'center', justifyContent: 'center' },
});
