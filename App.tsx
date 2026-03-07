import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SplashScreen } from './src/screens/SplashScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { CourseDetailScreen } from './src/screens/CourseDetailScreen';
import { FilesScreen } from './src/screens/FilesScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import type { Screen } from './src/types';
import type { UserData, ClassData, FileData } from './src/types';
import { defaultClasses } from './src/data/defaultClasses';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [userData, setUserData] = useState<UserData>({ name: '', grade: '', school: '', profilePicture: null });
  const [classes, setClasses] = useState<ClassData[]>(defaultClasses);
  const [selectedClassId, setSelectedClassId] = useState<string>('1');

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
        {currentScreen === 'course-detail' && selectedClass && (
          <CourseDetailScreen
            classData={selectedClass}
            onBack={() => navigate('home')}
            onFilesOpen={() => navigate('files')}
            onScan={() => navigate('scan')}
            onFriends={() => navigate('friends')}
            onUpdateClass={handleUpdateClass}
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
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
});
