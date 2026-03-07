import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BottomNav } from '../components/BottomNav';
import { colors } from '../theme';
import type { ClassData, FriendData, UserData, UnitData } from '../types';
import { friendsDirectory } from '../data/friends';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48 - 72;
const CARD_GAP = 16;

type SearchFilter = 'all' | 'classes' | 'files' | 'friends' | 'actions';
type ShortcutType = 'class' | 'friend' | 'scan' | 'files';
type ClassTemplate = 'Standard' | 'AP Exam' | 'Lab' | 'Seminar';

type SearchResult =
  | { id: string; type: 'class'; title: string; subtitle: string; classId: string }
  | { id: string; type: 'file'; title: string; subtitle: string; classId: string }
  | { id: string; type: 'friend'; title: string; subtitle: string }
  | { id: string; type: 'action'; title: string; subtitle: string; actionId: 'scan' | 'files' | 'friends' };

interface ShortcutItem {
  id: string;
  type: ShortcutType;
  label: string;
  refId?: string;
}

interface Props {
  onCourseOpen: (classId: string) => void;
  onFilesOpen: (classId?: string) => void;
  onScanOpen: () => void;
  onFriendsOpen: () => void;
  userName?: string;
  profilePicture?: string | null;
  grade?: string;
  school?: string;
  onUpdateProfile: (updates: Partial<UserData>) => void;
  classes: ClassData[];
  onAddClass: (cls: ClassData) => void;
  onRemoveClass: (id: string) => void;
}

const blocks = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8'];
const classGoals = ['Notes', 'Projects', 'Exam Prep', 'Labs'];

function makeClassCode(title: string) {
  const prefix = title
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'CL';
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 6);
  return `${prefix}-${suffix}`;
}

function buildStarterUnits(template: ClassTemplate): UnitData[] {
  const base =
    template === 'AP Exam'
      ? ['Unit 1 Review', 'Unit 2 Review', 'Practice FRQ']
      : template === 'Lab'
        ? ['Lab Setup', 'Lab Notebook', 'Lab Analysis']
        : template === 'Seminar'
          ? ['Discussion 1', 'Reading Circle', 'Final Reflection']
          : ['Week 1', 'Week 2', 'Week 3'];

  return base.map((title, idx) => ({
    id: idx + 1,
    title,
    pages: 0,
    collaborators: 0,
    examDate: 'TBD',
    daysLeft: 0,
    subUnits: [
      { id: `${idx + 1}.1`, title: 'Core Concepts', notes: [] },
      { id: `${idx + 1}.2`, title: 'Resources', notes: [] },
    ],
  }));
}

export function HomeScreen({
  onCourseOpen,
  onFilesOpen,
  onScanOpen,
  onFriendsOpen,
  userName,
  profilePicture,
  grade,
  school,
  onUpdateProfile,
  classes,
  onAddClass,
  onRemoveClass,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(userName || '');
  const [profileGrade, setProfileGrade] = useState(grade || '');
  const [profileSchool, setProfileSchool] = useState(school || '');

  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [shortcutType, setShortcutType] = useState<ShortcutType>('class');
  const [shortcutLabel, setShortcutLabel] = useState('');
  const [shortcutRef, setShortcutRef] = useState<string | undefined>(classes[0]?.id);
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([
    { id: 'shortcut-class', type: 'class', label: 'Unit 4: AP HUG', refId: classes[0]?.id },
    { id: 'shortcut-friend', type: 'friend', label: 'Laasya', refId: 'laasya' },
    { id: 'shortcut-scan', type: 'scan', label: 'Quick Scan' },
  ]);

  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassBlock, setNewClassBlock] = useState('Block 1');
  const [newClassTemplate, setNewClassTemplate] = useState<ClassTemplate>('Standard');
  const [newClassColor, setNewClassColor] = useState(colors.maroon);
  const [newClassGoal, setNewClassGoal] = useState('Notes');
  const [newClassImage, setNewClassImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const heroPulse = useRef(new Animated.Value(0)).current;
  const heroDrift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroPulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroDrift, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroDrift, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [heroDrift, heroPulse]);

  const heroScale = heroPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const heroOrbX = heroDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 8],
  });

  const heroOrbY = heroDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -8],
  });

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const classResults: SearchResult[] = classes.map((cls) => ({
      id: `class-${cls.id}`,
      type: 'class',
      title: cls.title,
      subtitle: `${cls.block} • ${cls.description}`,
      classId: cls.id,
    }));

    const fileResults: SearchResult[] = classes.flatMap((cls) =>
      cls.files.map((file) => ({
        id: `file-${cls.id}-${file.id}`,
        type: 'file',
        title: file.name,
        subtitle: `${cls.title} • ${file.pages} pages`,
        classId: cls.id,
      }))
    );

    const friendResults: SearchResult[] = friendsDirectory.map((friend) => ({
      id: `friend-${friend.id}`,
      type: 'friend',
      title: friend.name,
      subtitle: friend.course ? `${friend.status} • ${friend.course}` : friend.status,
    }));

    const actionResults: SearchResult[] = [
      { id: 'action-scan', type: 'action', title: 'Open Scan', subtitle: 'Capture notes or files', actionId: 'scan' },
      { id: 'action-files', type: 'action', title: 'Open Files', subtitle: 'Browse all class files', actionId: 'files' },
      { id: 'action-friends', type: 'action', title: 'Open Friends', subtitle: 'Start chat or calls', actionId: 'friends' },
    ];

    let merged = [...classResults, ...fileResults, ...friendResults, ...actionResults];

    if (searchFilter !== 'all') {
      merged = merged.filter((item) => {
        if (searchFilter === 'classes') return item.type === 'class';
        if (searchFilter === 'files') return item.type === 'file';
        if (searchFilter === 'friends') return item.type === 'friend';
        return item.type === 'action';
      });
    }

    if (!q) return merged.slice(0, 8);

    return merged
      .filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 10);
  }, [classes, searchFilter, searchQuery]);

  const toggleLike = (id: string) => {
    setLikedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openProfile = () => {
    setProfileName(userName || '');
    setProfileGrade(grade || '');
    setProfileSchool(school || '');
    setShowProfileModal(true);
  };

  const saveProfile = () => {
    onUpdateProfile({
      name: profileName.trim() || userName || '',
      grade: profileGrade.trim(),
      school: profileSchool.trim(),
    });
    setShowProfileModal(false);
  };

  const shortcutIcon = (item: ShortcutItem): keyof typeof Ionicons.glyphMap => {
    if (item.type === 'class') return 'document-text';
    if (item.type === 'friend') return 'person';
    if (item.type === 'files') return 'folder';
    return 'camera';
  };

  const runShortcut = (item: ShortcutItem) => {
    if (item.type === 'class' && item.refId) {
      onCourseOpen(item.refId);
      return;
    }
    if (item.type === 'friend') {
      onFriendsOpen();
      return;
    }
    if (item.type === 'files') {
      onFilesOpen();
      return;
    }
    onScanOpen();
  };

  const saveShortcut = () => {
    const fallbackLabel =
      shortcutType === 'class'
        ? classes.find((cls) => cls.id === shortcutRef)?.title || 'Class Shortcut'
        : shortcutType === 'friend'
          ? friendsDirectory.find((friend) => friend.id === shortcutRef)?.name || 'Friend Shortcut'
          : shortcutType === 'files'
            ? 'Files'
            : 'Quick Scan';

    const item: ShortcutItem = {
      id: `shortcut-${Date.now()}`,
      type: shortcutType,
      label: shortcutLabel.trim() || fallbackLabel,
      refId: shortcutRef,
    };

    setShortcuts((prev) => [item, ...prev]);
    setShowShortcutModal(false);
    setShortcutLabel('');
    setShortcutRef(classes[0]?.id);
  };

  const openAddClassModal = () => {
    setNewClassName('');
    setNewClassBlock('Block 1');
    setNewClassTemplate('Standard');
    setNewClassColor(colors.maroon);
    setNewClassGoal('Notes');
    setNewClassImage(null);
    setShowClassModal(true);
  };

  const pickClassImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
      aspect: [3, 2],
    });

    if (!result.canceled && result.assets[0]) {
      setNewClassImage(result.assets[0].uri);
    }
  };

  const saveNewClass = () => {
    const title = newClassName.trim() || 'New Class';

    const templateImage =
      newClassTemplate === 'AP Exam'
        ? 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=500&fit=crop'
        : newClassTemplate === 'Lab'
          ? 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=500&fit=crop'
          : newClassTemplate === 'Seminar'
            ? 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=500&fit=crop'
            : 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=500&fit=crop';

    const newClass: ClassData = {
      id: Date.now().toString(),
      title,
      block: newClassBlock,
      classCode: makeClassCode(title),
      image: newClassImage || templateImage,
      classmates: 0,
      documents: 0,
      color: newClassColor,
      description: `${newClassTemplate} setup • Focus: ${newClassGoal}`,
      files: [],
      units: buildStarterUnits(newClassTemplate),
    };

    onAddClass(newClass);
    setShowClassModal(false);
    setCurrentCardIndex(classes.length);
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: classes.length * (CARD_WIDTH + CARD_GAP), animated: true });
    }, 120);
  };

  const handleSearchSelect = (item: SearchResult) => {
    if (item.type === 'class') {
      onCourseOpen(item.classId);
    } else if (item.type === 'file') {
      onFilesOpen(item.classId);
    } else if (item.type === 'friend') {
      onFriendsOpen();
    } else {
      if (item.actionId === 'scan') onScanOpen();
      if (item.actionId === 'files') onFilesOpen();
      if (item.actionId === 'friends') onFriendsOpen();
    }

    setSearchQuery('');
    setShowFilterMenu(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{userName ? `Hello, ${userName}` : 'Welcome Back'}</Text>
            <Text style={styles.subtitle}>Welcome to Citadel</Text>
          </View>
          <TouchableOpacity style={styles.avatarWrap} onPress={openProfile}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={28} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.heroCard, { transform: [{ scale: heroScale }] }]}>
          <Animated.View style={[styles.heroOrbA, { transform: [{ translateX: heroOrbX }] }]} />
          <Animated.View style={[styles.heroOrbB, { transform: [{ translateY: heroOrbY }] }]} />
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={13} color={colors.maroon} />
              <Text style={styles.heroBadgeText}>Today’s Momentum</Text>
            </View>
            <Text style={styles.heroDate}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
          </View>
          <Text style={styles.heroTitle}>Keep the streak alive.</Text>
          <Text style={styles.heroSubtitle}>Open a class, merge notes, or launch a live session to build progress fast.</Text>
          <View style={styles.heroMiniStats}>
            <View style={styles.heroMiniCard}>
              <Text style={styles.heroMiniValue}>{classes.length}</Text>
              <Text style={styles.heroMiniLabel}>Classes</Text>
            </View>
            <View style={styles.heroMiniCard}>
              <Text style={styles.heroMiniValue}>{classes.reduce((a, c) => a + c.files.length, 0)}</Text>
              <Text style={styles.heroMiniLabel}>Files</Text>
            </View>
            <View style={styles.heroMiniCard}>
              <Text style={styles.heroMiniValue}>{friendsDirectory.length}</Text>
              <Text style={styles.heroMiniLabel}>Friends</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Smart Search: classes, files, friends, actions"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[styles.filterBtn, searchFilter !== 'all' && styles.filterBtnActive]} onPress={() => setShowFilterMenu((v) => !v)}>
            <Ionicons name="options" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {showFilterMenu && (
          <View style={styles.filterMenu}>
            {(['all', 'classes', 'files', 'friends', 'actions'] as SearchFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, searchFilter === filter && styles.filterChipActive]}
                onPress={() => {
                  setSearchFilter(filter);
                  setShowFilterMenu(false);
                }}
              >
                <Text style={[styles.filterChipText, searchFilter === filter && styles.filterChipTextActive]}>
                  {filter[0].toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResultsBox}>
            {searchResults.length === 0 ? (
              <Text style={styles.searchEmpty}>No results found</Text>
            ) : (
              searchResults.map((item) => (
                <TouchableOpacity key={item.id} style={styles.searchResultRow} onPress={() => handleSearchSelect(item)}>
                  <View style={styles.searchResultIcon}>
                    <Ionicons
                      name={
                        item.type === 'class'
                          ? 'book'
                          : item.type === 'file'
                            ? 'document-text'
                            : item.type === 'friend'
                              ? 'people'
                              : 'flash'
                      }
                      size={15}
                      color={colors.maroon}
                    />
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultTitle}>{item.title}</Text>
                    <Text style={styles.searchResultSub}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Shortcuts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcuts} contentContainerStyle={styles.shortcutsContent}>
          <TouchableOpacity style={styles.shortcutAdd} onPress={() => setShowShortcutModal(true)}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>

          {shortcuts.map((shortcut) => (
            <TouchableOpacity key={shortcut.id} style={styles.shortcut} onPress={() => runShortcut(shortcut)}>
              <Ionicons name={shortcutIcon(shortcut)} size={16} color={colors.maroon} />
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {shortcut.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.carouselHeader}>
          <Text style={styles.sectionTitle}>My Classes</Text>
          {classes.length > 0 && (
            <Text style={styles.counter}>
              {currentCardIndex + 1} / {classes.length + 1}
            </Text>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={[...classes, { id: 'add', isAdd: true }] as (ClassData | { id: string; isAdd: true })[]}
          horizontal
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
            setCurrentCardIndex(Math.min(index, classes.length));
          }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if ('isAdd' in item && item.isAdd) {
              return (
                <TouchableOpacity style={[styles.classCard, styles.addCard]} onPress={openAddClassModal}>
                  <View style={styles.addCardInner}>
                    <View style={styles.addCardIcon}><Ionicons name="add" size={34} color={colors.maroon} /></View>
                    <Text style={styles.addCardTitle}>Create / Join Class</Text>
                    <Text style={styles.addCardSub}>Pick a template, focus area, and class code</Text>
                    <View style={styles.addCardPills}>
                      <View style={styles.addCardPill}><Text style={styles.addCardPillText}>Template</Text></View>
                      <View style={styles.addCardPill}><Text style={styles.addCardPillText}>Block</Text></View>
                      <View style={styles.addCardPill}><Text style={styles.addCardPillText}>Code</Text></View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }

            const cls = item as ClassData;
            const isLiked = likedCards.has(cls.id);

            return (
              <TouchableOpacity
                style={[styles.classCard, { width: CARD_WIDTH }]}
                onPress={() => onCourseOpen(cls.id)}
                activeOpacity={0.95}
              >
                <Image source={{ uri: cls.image }} style={styles.classImage} />
                <View style={styles.classOverlay} />
                <TouchableOpacity style={styles.heartBtn} onPress={() => toggleLike(cls.id)}>
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.trashBtn} onPress={() => onRemoveClass(cls.id)}>
                  <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <View style={styles.classFooter}>
                  <Text style={styles.classBlock}>{cls.block}</Text>
                  <Text style={styles.classTitle}>{cls.title}</Text>
                  <Text style={styles.classDesc}>{cls.description}</Text>
                  <View style={styles.classMeta}>
                    <View style={styles.classMetaItem}>
                      <Ionicons name="key" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.classMetaText}>{cls.classCode}</Text>
                    </View>
                    <Text style={styles.classMetaText}>{cls.documents > 0 ? `${cls.documents} Documents` : 'No documents yet'}</Text>
                  </View>
                  <View style={styles.keepLearning}>
                    <Text style={styles.keepLearningText}>{cls.documents > 0 ? 'Open Class' : 'Set Up Class'}</Text>
                    <View style={styles.keepLearningIcon}>
                      <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.dots}>
          {Array.from({ length: classes.length + 1 }).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => flatListRef.current?.scrollToOffset({ offset: i * (CARD_WIDTH + CARD_GAP), animated: true })}
            >
              <View style={[styles.dot, currentCardIndex === i && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="book" size={20} color={colors.maroon} />
            </View>
            <Text style={styles.statValue}>{classes.length}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="document-text" size={20} color="#2563eb" />
            </View>
            <Text style={styles.statValue}>{classes.reduce((a, c) => a + c.documents, 0)}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="people" size={20} color="#059669" />
            </View>
            <Text style={styles.statValue}>{friendsDirectory.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>
      </ScrollView>

      <BottomNav active="home" onHome={() => {}} onScan={onScanOpen} onFriends={onFriendsOpen} onFiles={() => onFilesOpen()} />

      <Modal visible={showProfileModal} transparent animationType="slide" onRequestClose={() => setShowProfileModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Profile & Settings</Text>
                <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput style={styles.modalInput} value={profileName} onChangeText={setProfileName} placeholder="Your name" />
              <Text style={styles.modalLabel}>Grade / Year</Text>
              <TextInput style={styles.modalInput} value={profileGrade} onChangeText={setProfileGrade} placeholder="11th Grade / College Sophomore" />
              <Text style={styles.modalLabel}>School</Text>
              <TextInput style={styles.modalInput} value={profileSchool} onChangeText={setProfileSchool} placeholder="School name" />
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveProfile}>
                <Text style={styles.modalSaveBtnText}>Save Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showShortcutModal} transparent animationType="fade" onRequestClose={() => setShowShortcutModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Shortcut</Text>
                <TouchableOpacity onPress={() => setShowShortcutModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.optionRow}>
                {(['class', 'friend', 'scan', 'files'] as ShortcutType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.optionChip, shortcutType === type && styles.optionChipActive]}
                    onPress={() => {
                      setShortcutType(type);
                      if (type === 'class') setShortcutRef(classes[0]?.id);
                      if (type === 'friend') setShortcutRef(friendsDirectory[0]?.id);
                      if (type === 'scan' || type === 'files') setShortcutRef(undefined);
                    }}
                  >
                    <Text style={[styles.optionChipText, shortcutType === type && styles.optionChipTextActive]}>
                      {type[0].toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(shortcutType === 'class' || shortcutType === 'friend') && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {(shortcutType === 'class' ? classes : friendsDirectory).map((item) => {
                    const id = shortcutType === 'class' ? (item as ClassData).id : (item as FriendData).id;
                    const label = shortcutType === 'class' ? (item as ClassData).title : (item as FriendData).name;
                    const active = shortcutRef === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.pickChip, active && styles.pickChipActive]}
                        onPress={() => setShortcutRef(id)}
                      >
                        <Text style={[styles.pickChipText, active && styles.pickChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={styles.modalLabel}>Shortcut Label</Text>
              <TextInput
                style={styles.modalInput}
                value={shortcutLabel}
                onChangeText={setShortcutLabel}
                placeholder="Custom label (optional)"
              />

              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveShortcut}>
                <Text style={styles.modalSaveBtnText}>Add Shortcut</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showClassModal} transparent animationType="slide" onRequestClose={() => setShowClassModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCardLarge}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Class</Text>
                <TouchableOpacity onPress={() => setShowClassModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Class Name</Text>
              <TextInput style={styles.modalInput} value={newClassName} onChangeText={setNewClassName} placeholder="Ex: AP Physics" />

              <Text style={styles.modalLabel}>Class Background Image</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickClassImage}>
                <Ionicons name="image" size={16} color={colors.maroon} />
                <Text style={styles.imagePickerBtnText}>Upload Background</Text>
              </TouchableOpacity>
              {newClassImage && <Image source={{ uri: newClassImage }} style={styles.newClassImagePreview} />}

              <Text style={styles.modalLabel}>Block</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {blocks.map((block) => (
                  <TouchableOpacity
                    key={block}
                    style={[styles.pickChip, newClassBlock === block && styles.pickChipActive]}
                    onPress={() => setNewClassBlock(block)}
                  >
                    <Text style={[styles.pickChipText, newClassBlock === block && styles.pickChipTextActive]}>{block}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {(['Standard', 'AP Exam', 'Lab', 'Seminar'] as ClassTemplate[]).map((template) => (
                  <TouchableOpacity
                    key={template}
                    style={[styles.pickChip, newClassTemplate === template && styles.pickChipActive]}
                    onPress={() => setNewClassTemplate(template)}
                  >
                    <Text style={[styles.pickChipText, newClassTemplate === template && styles.pickChipTextActive]}>{template}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Primary Focus</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {classGoals.map((goal) => (
                  <TouchableOpacity
                    key={goal}
                    style={[styles.pickChip, newClassGoal === goal && styles.pickChipActive]}
                    onPress={() => setNewClassGoal(goal)}
                  >
                    <Text style={[styles.pickChipText, newClassGoal === goal && styles.pickChipTextActive]}>{goal}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Theme Color</Text>
              <View style={styles.colorRow}>
                {['#3D0C11', '#0f766e', '#1d4ed8', '#7c3aed', '#b45309'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorDot, { backgroundColor: color }, newClassColor === color && styles.colorDotActive]}
                    onPress={() => setNewClassColor(color)}
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveNewClass}>
                <Text style={styles.modalSaveBtnText}>Create Class</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgSecondary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e7e3e3',
  },
  avatar: { width: '100%', height: '100%' },
  heroCard: {
    marginTop: 18,
    backgroundColor: '#fff9f6',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0dfd9',
    overflow: 'hidden',
  },
  heroOrbA: {
    position: 'absolute',
    top: -24,
    right: -12,
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: 'rgba(127,29,29,0.12)',
  },
  heroOrbB: {
    position: 'absolute',
    bottom: -26,
    left: -14,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(127,29,29,0.1)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: { fontSize: 11, color: colors.maroon, fontWeight: '700' },
  heroDate: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  heroTitle: { marginTop: 10, fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  heroSubtitle: { marginTop: 4, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  heroMiniStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroMiniCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#ede2df',
    paddingVertical: 10,
    alignItems: 'center',
  },
  heroMiniValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  heroMiniLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 20, height: 52, gap: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0 },
  filterBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#7f1d1d' },
  filterMenu: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
  },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f3f3f3' },
  filterChipActive: { backgroundColor: colors.maroon },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: 'white' },
  searchResultsBox: {
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ece8e8',
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f1f1',
  },
  searchResultIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f7f3f3', alignItems: 'center', justifyContent: 'center' },
  searchResultInfo: { flex: 1 },
  searchResultTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  searchResultSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  searchEmpty: { padding: 14, textAlign: 'center', color: colors.textSecondary },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 28 },
  shortcuts: { marginTop: 12 },
  shortcutsContent: { paddingRight: 24, gap: 12, flexDirection: 'row', alignItems: 'center' },
  shortcutAdd: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24 },
  shortcutLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, maxWidth: 130 },
  carouselHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 },
  counter: { fontSize: 12, color: colors.textTertiary },
  carouselContent: { paddingRight: 24, gap: CARD_GAP, marginTop: 16 },
  classCard: { height: 370, borderRadius: 28, overflow: 'hidden' },
  addCard: { backgroundColor: '#fff', borderWidth: 2, borderColor: `${colors.maroon}35`, borderStyle: 'dashed' },
  addCardInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  addCardIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: `${colors.maroon}15`, alignItems: 'center', justifyContent: 'center' },
  addCardTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  addCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  addCardPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  addCardPill: { backgroundColor: '#f3f0f0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  addCardPillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  classImage: { ...StyleSheet.absoluteFillObject },
  classOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  heartBtn: { position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  trashBtn: { position: 'absolute', top: 20, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  classFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 },
  classBlock: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  classTitle: { fontSize: 24, fontWeight: '700', color: 'white', marginTop: 4 },
  classDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  classMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  classMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  classMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  keepLearning: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14, marginTop: 16 },
  keepLearningText: { fontSize: 14, fontWeight: '600', color: 'white' },
  keepLearningIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  dotActive: { width: 24, backgroundColor: colors.maroon },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: { flex: 1, backgroundColor: 'white', borderRadius: 24, padding: 16, alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.maroon}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  modalKeyboard: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 30 },
  modalCardLarge: { backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  modalInput: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#ece8e8', backgroundColor: '#faf8f8', paddingHorizontal: 14, fontSize: 14, color: colors.textPrimary },
  modalSaveBtn: { marginTop: 16, height: 50, borderRadius: 25, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  modalSaveBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f3f1f1' },
  optionChipActive: { backgroundColor: colors.maroon },
  optionChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  optionChipTextActive: { color: 'white' },
  pickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e5e1e1', backgroundColor: 'white' },
  pickChipActive: { borderColor: colors.maroon, backgroundColor: `${colors.maroon}12` },
  pickChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  pickChipTextActive: { color: colors.maroon },
  imagePickerBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.maroon}40`,
    backgroundColor: `${colors.maroon}10`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  imagePickerBtnText: { fontSize: 13, color: colors.maroon, fontWeight: '700' },
  newClassImagePreview: {
    marginTop: 8,
    width: '100%',
    height: 110,
    borderRadius: 14,
    backgroundColor: '#f0ecec',
  },
  colorRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#111' },
});
