import React, { useState, useEffect } from 'react';
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
import { friendsDirectory } from './src/data/friends';

const SUPPORT_EMAIL = 'my.citadel.official@gmail.com';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [previousScreen, setPreviousScreen] = useState<Screen>('home');
  const [userData, setUserData] = useState<UserData>({ name: '', grade: '', school: '', profilePicture: null });
  const [classes, setClasses] = useState<ClassData[]>(defaultClasses);
  const [selectedClassId, setSelectedClassId] = useState<string>('1');
  const [selectedPerson, setSelectedPerson] = useState<FriendData | null>(null);
  const [activeInfoPage, setActiveInfoPage] = useState<'help' | 'terms' | 'privacy'>('help');

  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => setCurrentScreen('onboarding'), 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const navigate = (screen: Screen) => setCurrentScreen(screen);

  const handleOnboardingComplete = (data: { name: string; grade: string; school: string }) => {
    setUserData((prev) => ({ ...prev, ...data }));
    navigate('signin');
  };

  const handleSignIn = (profilePicture: string | null, displayName?: string) => {
    setUserData((prev) => ({ ...prev, profilePicture, ...(displayName !== undefined ? { name: displayName } : {}) }));
    navigate('home');
  };

  const handleAddClass = (newClass: ClassData) => setClasses((prev) => [...prev, newClass]);
  const handleRemoveClass = (id: string) => setClasses((prev) => prev.filter((c) => c.id !== id));
  const handleUpdateClass = (updatedClass: ClassData) =>
    setClasses((prev) => prev.map((c) => (c.id === updatedClass.id ? updatedClass : c)));
  const handleUpdateProfile = (updates: Partial<UserData>) =>
    setUserData((prev) => ({ ...prev, ...updates }));
  const handleLogout = () => {
    setUserData({ name: '', grade: '', school: '', profilePicture: null });
    navigate('onboarding');
  };

  const openPersonProfile = (person: FriendData, fromScreen: Screen) => {
    setSelectedPerson(person);
    setPreviousScreen(fromScreen);
    navigate('person-profile');
  };

  // Helper: find or build a FriendData from just a name
  const openPersonByName = (name: string, fromScreen: Screen) => {
    const found = friendsDirectory.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (found) {
      openPersonProfile(found, fromScreen);
    } else {
      // Build a minimal profile for classmates not in friends list
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

  if (!fontsLoaded) {
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
          />
        )}
        {currentScreen === 'person-profile' && selectedPerson && (
          <PersonProfileScreen
            person={selectedPerson}
            onBack={() => navigate(previousScreen)}
            onChat={() => navigate('friends')}
            classes={classes}
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
            onPersonOpen={(person) => openPersonProfile(person, 'friends')}
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
