import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
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
import type { Screen, FriendData } from './src/types';
import type { UserData, ClassData, FileData } from './src/types';
import { defaultClasses } from './src/data/defaultClasses';
import { supabase } from './src/lib/supabase';
import { uploadAvatar } from './src/lib/storage';
import { Session } from '@supabase/supabase-js';

const SUPPORT_EMAIL = 'my.citadel.official@gmail.com';

type ShortcutItem = {
  id: string;
  type: 'class' | 'friend' | 'scan' | 'files';
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

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [previousScreen, setPreviousScreen] = useState<Screen>('home');
  const [userData, setUserData] = useState<UserData>({ name: '', username: '', email: '', grade: '', school: '', profilePicture: null });
  const [classes, setClasses] = useState<ClassData[]>(defaultClasses);
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [unitProgress, setUnitProgress] = useState<Record<string, boolean>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>('1');
  const [selectedPerson, setSelectedPerson] = useState<FriendData | null>(null);
  const [activeInfoPage, setActiveInfoPage] = useState<'help' | 'terms' | 'privacy'>('help');
  const [session, setSession] = useState<Session | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

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
        setUserData({ name: '', username: '', email: '', grade: '', school: '', profilePicture: null });
        setClasses([]);
        setShortcuts([]);
        setFriends([]);
        setFriendRequests([]);
        dataLoadedRef.current = false;
        setCurrentScreen('onboarding');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
        setUserData({
          name: data.display_name || '',
          username: data.username || '',
          email: userEmail,
          grade: data.grade || '',
          school: data.school || '',
          profilePicture: data.avatar_url || null,
        });
      } else {
        const metadata = sessionData.data.session?.user.user_metadata || {};
        const defaultUsername = userData.username || metadata.username || `user_${userId.substring(0, 6)}`;
        const defaultName = userData.name || metadata.display_name || '';
        const defaultGrade = userData.grade || metadata.grade || '';
        const defaultSchool = userData.school || metadata.school || '';

        await supabase.from('profiles').insert([{
          id: userId,
          username: defaultUsername,
          display_name: defaultName,
          grade: defaultGrade,
          school: defaultSchool,
        }]);

        setUserData(prev => ({
          ...prev,
          email: userEmail,
          name: defaultName,
          username: defaultUsername,
          grade: defaultGrade,
          school: defaultSchool,
        }));
      }

      // Load classes
      await loadClasses(userId);
      // Load shortcuts
      await loadShortcuts(userId);
      // Load friends
      await loadFriends(userId);
      // Load friend requests
      await loadFriendRequests(userId);
      // Load unit/section progress
      await loadProgress(userId);

      dataLoadedRef.current = true;
      setCurrentScreen('home');
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
    } catch (err) {
      console.error('Error saving classes:', err);
    }
  }, [session?.user?.id]);

  // Auto-save classes when they change
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveClasses(classes);
    }
  }, [classes, saveClasses]);

  // ═══════════════════════════════════════════
  // SHORTCUTS SYNC
  // ═══════════════════════════════════════════
  const loadShortcuts = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_shortcuts')
        .select('shortcuts')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.shortcuts) {
        setShortcuts(data.shortcuts as ShortcutItem[]);
      } else {
        setShortcuts([]);
      }
    } catch (err) {
      console.error('Error loading shortcuts:', err);
    }
  };

  const saveShortcuts = useCallback(async (items: ShortcutItem[]) => {
    if (!session?.user?.id || !dataLoadedRef.current) return;
    const userId = session.user.id;

    try {
      const { data } = await supabase
        .from('user_shortcuts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        await supabase.from('user_shortcuts').update({ shortcuts: items, updated_at: new Date().toISOString() }).eq('user_id', userId);
      } else {
        await supabase.from('user_shortcuts').insert({ user_id: userId, shortcuts: items });
      }
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
  const loadFriends = async (userId: string) => {
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
          .select('id, username, display_name, school, avatar_url')
          .in('id', uniqueIds);

        if (profiles) {
          const friendData: FriendData[] = profiles.map((p: any) => ({
            id: p.id,
            name: p.display_name || p.username || 'User',
            color: '#E0E7FF',
            status: 'offline' as const,
            school: p.school || '',
          }));
          setFriends(friendData);
        }
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

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
        return { success: false, message: error.message };
      }

      return { success: true, message: `Request sent to ${targetProfile.display_name || username}!` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Something went wrong.' };
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

  const handleOnboardingComplete = (data: { name: string; username: string; grade: string; school: string }) => {
    setUserData((prev) => ({ ...prev, ...data }));
    navigate('signin');
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

  const handleAddClass = (newClass: ClassData) => setClasses((prev) => [...prev, newClass]);
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
      if (updates.school !== undefined) dbUpdates.school = updates.school;
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
    navigate('files');
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
        {currentScreen === 'onboarding' && <OnboardingScreen onGetStarted={handleOnboardingComplete} />}
        {currentScreen === 'signin' && (
          <SignInScreen
            onSignIn={handleSignIn}
            onBack={() => navigate('onboarding')}
            userName={userData.name}
            userUsername={userData.username}
            userGrade={userData.grade}
            userSchool={userData.school}
          />
        )}
        {currentScreen === 'home' && (
          <HomeScreen
            onCourseOpen={handleOpenCourse}
            onFilesOpen={openFiles}
            onScanOpen={() => navigate('scan')}
            onFriendsOpen={() => navigate('friends')}
            onProfileOpen={() => navigate('profile')}
            userName={userData.name}
            profilePicture={userData.profilePicture}
            grade={userData.grade}
            school={userData.school}
            onUpdateProfile={handleUpdateProfile}
            classes={classes}
            onAddClass={handleAddClass}
            onRemoveClass={handleRemoveClass}
            shortcuts={shortcuts}
            onUpdateShortcuts={handleUpdateShortcuts}
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
            session={session}
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
              // Send a friend request (same flow as the Friends tab)
              await supabase.from('friend_requests').insert({
                from_user_id: session.user.id,
                to_user_id: personId,
              });
            }}
            onRemoveFriend={async (personId) => {
              if (!session?.user?.id) return;
              // Delete friendship in both directions
              await supabase.from('friends').delete().eq('user_id', session.user.id).eq('friend_id', personId);
              await supabase.from('friends').delete().eq('user_id', personId).eq('friend_id', session.user.id);
              await loadFriends(session.user.id);
            }}
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
            onFilesOpen={() => navigate('files')}
            onScan={() => navigate('scan')}
            onFriends={() => navigate('friends')}
            onUpdateClass={handleUpdateClass}
            onPersonOpen={(name) => openPersonByName(name, 'course-detail')}
            unitProgress={unitProgress}
            onUpdateProgress={handleUpdateProgress}
          />
        )}
        {currentScreen === 'files' && (
          <FilesScreen
            classes={classes}
            initialClassId={selectedClassId}
            onBack={() => navigate('course-detail')}
            onHome={() => navigate('home')}
            onScan={() => navigate('scan')}
            onFriends={() => navigate('friends')}
            onUpdateClass={handleUpdateClass}
          />
        )}
        {currentScreen === 'scan' && (
          <ScanScreen
            onHome={() => navigate('home')}
            onFiles={() => navigate('files')}
            onFriends={() => navigate('friends')}
            classes={classes}
            onSaveScan={handleSaveScan}
          />
        )}
        {currentScreen === 'friends' && (
          <FriendsScreen
            onHome={() => navigate('home')}
            onScan={() => navigate('scan')}
            onFiles={() => navigate('files')}
            profilePicture={userData.profilePicture}
            userName={userData.name}
            userUsername={userData.username}
            onPersonOpen={(person) => openPersonProfile(person, 'friends')}
            friends={friends}
            friendRequests={friendRequests}
            onSendRequest={handleSendRequest}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            classes={classes}
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
