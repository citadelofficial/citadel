import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Share,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { colors, fonts } from '../theme';
import { friendsDirectory } from '../data/friends';
import type { ClassData, SubUnitNote, UnitData, Quiz } from '../types';

interface Props {
  classData: ClassData;
  onBack: () => void;
  onFilesOpen: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onUpdateClass: (updatedClass: ClassData) => void;
  onPersonOpen?: (name: string) => void;
}

function makeCustomCode(title: string) {
  const prefix =
    title
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'CL';
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 6);
  return `${prefix}-${suffix}`;
}

function formatToday() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
}

const fallbackClassmateNames = [
  'Laasya Potuluri',
  'Anya Vulupala',
  'Andrew Boldea',
  'Saraa Rana',
  'Risha Guru',
  'Annika Shah',
  'Zayyan Masud',
  'Roshan Shah',
  'Catalina Nemes',
  'Jack Swartz',
  'Will Caling',
  'Maya Chen',
  'Ethan Patel',
  'Nora Kim',
  'Ava Martinez',
  'Liam Walker',
  'Noah Brown',
  'Emma Johnson',
  'Sophia Davis',
  'Lucas Miller',
  'Olivia Moore',
  'Mason Taylor',
  'Isabella Thomas',
  'James Lee',
  'Amelia Harris',
  'Benjamin Clark',
  'Charlotte Young',
  'Elijah Hall',
  'Mila Allen',
  'Alexander Scott',
  'Harper Green',
  'Michael Adams',
];

function buildClassmateList(total: number, preset: string[] | undefined, seed: string) {
  if (total <= 0) return [];
  const fromPreset = (preset || []).map((name) => name.trim()).filter(Boolean);
  const used = new Set(fromPreset.map((name) => name.toLowerCase()));
  const result = [...fromPreset];

  const offset = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % fallbackClassmateNames.length;
  let cursor = 0;

  while (result.length < total && cursor < fallbackClassmateNames.length * 3) {
    const candidate = fallbackClassmateNames[(offset + cursor) % fallbackClassmateNames.length];
    cursor += 1;
    if (used.has(candidate.toLowerCase())) continue;
    used.add(candidate.toLowerCase());
    result.push(candidate);
  }

  while (result.length < total) {
    result.push(`Classmate ${result.length + 1}`);
  }

  return result.slice(0, total);
}

export function CourseDetailScreen({ classData, onBack, onFilesOpen, onScan, onFriends, onUpdateClass, onPersonOpen }: Props) {
  const classAccent = classData.color || colors.maroon;
  const themeColorChoices = [colors.maroon, '#0f766e', '#1d4ed8', '#7c3aed', '#b45309'];

  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showClassmatesModal, setShowClassmatesModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const [draftTitle, setDraftTitle] = useState(classData.title);
  const [draftBlock, setDraftBlock] = useState(classData.block);
  const [draftDescription, setDraftDescription] = useState(classData.description);
  const [draftCode, setDraftCode] = useState(classData.classCode);
  const [draftImage, setDraftImage] = useState(classData.image);
  const [draftColor, setDraftColor] = useState(classData.color || colors.maroon);

  const [showUnitEditModal, setShowUnitEditModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [unitDraftTitle, setUnitDraftTitle] = useState('');
  const [unitDraftExamDate, setUnitDraftExamDate] = useState('');
  const [unitDraftDaysLeft, setUnitDraftDaysLeft] = useState('');

  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [activeSubUnitId, setActiveSubUnitId] = useState<string | null>(null);
  const [noteSource, setNoteSource] = useState<'filesTab' | 'phone'>('filesTab');
  const [selectedClassFileId, setSelectedClassFileId] = useState<number | null>(classData.files[0]?.id || null);
  const [localUpload, setLocalUpload] = useState<{ name: string; content: string; pages: number } | null>(null);
  const [newNoteAuthor, setNewNoteAuthor] = useState('You');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedMergeNoteIds, setSelectedMergeNoteIds] = useState<number[]>([]);
  const [activeNote, setActiveNote] = useState<{ note: SubUnitNote; sectionTitle: string } | null>(null);
  const [noteActionStatus, setNoteActionStatus] = useState('');

  const [unitProgress, setUnitProgress] = useState<Record<string, boolean>>({});

  // === Study Sheet & SOS ===
  const [showStudySheet, setShowStudySheet] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const sosPulse = useRef(new Animated.Value(1)).current;

  // === Plane animation ===
  const planeX = useRef(new Animated.Value(0)).current;
  const planeY = useRef(new Animated.Value(0)).current;
  const planeOpacity = useRef(new Animated.Value(0)).current;
  const [showPlane, setShowPlane] = useState(false);

  const flyPlane = () => {
    setShowPlane(true);
    planeX.setValue(-30);
    planeY.setValue(0);
    planeOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(planeX, { toValue: 300, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(planeY, { toValue: -20, duration: 400, useNativeDriver: true }),
        Animated.timing(planeY, { toValue: 10, duration: 400, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(planeOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => setShowPlane(false));
  };

  // === Quizzes ===
  const [showAddQuiz, setShowAddQuiz] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizQuestionCount, setQuizQuestionCount] = useState('5');

  const addQuiz = () => {
    if (!selectedUnit || !activeSubUnitId || !quizTitle.trim()) return;
    const newQuiz: Quiz = {
      id: Date.now(),
      title: quizTitle.trim(),
      questions: parseInt(quizQuestionCount) || 5,
      date: formatToday(),
    };
    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) =>
        sub.id === activeSubUnitId
          ? { ...sub, quizzes: [...(sub.quizzes || []), newQuiz] }
          : sub
      ),
    }));
    setShowAddQuiz(false);
    setQuizTitle('');
  };

  const takeQuiz = (subUnitId: string, quizId: number) => {
    const score = Math.floor(Math.random() * 41) + 60; // 60-100
    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) =>
        sub.id === subUnitId
          ? {
            ...sub,
            quizzes: (sub.quizzes || []).map((q) =>
              q.id === quizId ? { ...q, score } : q
            ),
          }
          : sub
      ),
    }));
  };

  // === Copy icon morph microinteraction ===
  const [copyIconDone, setCopyIconDone] = useState(false);
  const copyIconScale = useRef(new Animated.Value(1)).current;

  // === Checkbox completion ripple ===
  const checkRippleScale = useRef(new Animated.Value(0)).current;
  const checkRippleOpacity = useRef(new Animated.Value(0)).current;
  const [checkRippleKey, setCheckRippleKey] = useState<string | null>(null);

  const isNewClass = classData.classmates === 0 && classData.documents === 0;
  const classmatesList = useMemo(
    () => buildClassmateList(classData.classmates, classData.classmateNames, classData.classCode),
    [classData.classCode, classData.classmateNames, classData.classmates]
  );

  const selectedUnitTotalSections = selectedUnit?.subUnits.length || 0;
  const selectedUnitCompletedSections = useMemo(() => {
    if (!selectedUnit) return 0;
    return selectedUnit.subUnits.filter((sub) => unitProgress[`${selectedUnit.id}-${sub.id}`]).length;
  }, [selectedUnit, unitProgress]);

  const selectedUnitProgress =
    selectedUnitTotalSections > 0 ? selectedUnitCompletedSections / selectedUnitTotalSections : 0;

  const canSaveAddedNote = useMemo(() => {
    if (!activeSubUnitId) return false;
    const hasTypedText = newNoteContent.trim().length > 0;
    if (noteSource === 'filesTab') {
      return hasTypedText || classData.files.some((file) => file.id === selectedClassFileId) || classData.files.length > 0;
    }
    return hasTypedText || !!localUpload;
  }, [activeSubUnitId, classData.files, localUpload, newNoteContent, noteSource, selectedClassFileId]);

  useEffect(() => {
    if (!selectedUnit) return;
    const refreshed = classData.units.find((unit) => unit.id === selectedUnit.id);
    if (refreshed) setSelectedUnit(refreshed);
  }, [classData, selectedUnit]);

  const updateClassUnits = (updater: (units: UnitData[]) => UnitData[]) => {
    onUpdateClass({ ...classData, units: updater(classData.units) });
  };

  const openEditModal = () => {
    setDraftTitle(classData.title);
    setDraftBlock(classData.block);
    setDraftDescription(classData.description);
    setDraftCode(classData.classCode);
    setDraftImage(classData.image);
    setDraftColor(classData.color || colors.maroon);
    setShowEditModal(true);
  };

  const saveClassEdits = () => {
    onUpdateClass({
      ...classData,
      title: draftTitle.trim() || classData.title,
      block: draftBlock.trim() || classData.block,
      description: draftDescription.trim() || classData.description,
      classCode: draftCode.trim().toUpperCase() || classData.classCode,
      image: draftImage || classData.image,
      color: draftColor || classData.color,
    });
    setShowEditModal(false);
  };

  const copyClassCode = async () => {
    await Clipboard.setStringAsync(classData.classCode);
    setCopyIconDone(true);
    setCopyStatus('Class code copied!');
    // Icon morph: scale down, swap icon, pop back up
    copyIconScale.setValue(0);
    Animated.spring(copyIconScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 16,
    }).start();
    setTimeout(() => {
      setCopyIconDone(false);
      setCopyStatus('');
      copyIconScale.setValue(0);
      Animated.spring(copyIconScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 10,
      }).start();
    }, 1500);
  };

  const regenerateCode = () => {
    const newCode = makeCustomCode(classData.title);
    onUpdateClass({ ...classData, classCode: newCode });
    setCopyStatus('New class code generated.');
    setTimeout(() => setCopyStatus(''), 1500);
  };

  const addUnit = () => {
    const nextId = classData.units.length > 0 ? Math.max(...classData.units.map((unit) => unit.id)) + 1 : 1;
    const newUnit: UnitData = {
      id: nextId,
      title: `Unit ${nextId}`,
      pages: 0,
      collaborators: 0,
      examDate: 'TBD',
      daysLeft: 0,
      subUnits: [
        { id: `${nextId}.1`, title: 'Core Concepts', notes: [] },
        { id: `${nextId}.2`, title: 'Review Questions', notes: [] },
      ],
    };

    updateClassUnits((units) => [...units, newUnit]);
  };

  const openUnitEditor = (unit: UnitData) => {
    setEditingUnitId(unit.id);
    setUnitDraftTitle(unit.title);
    setUnitDraftExamDate(unit.examDate);
    setUnitDraftDaysLeft(unit.daysLeft > 0 ? String(unit.daysLeft) : '');
    setShowUnitEditModal(true);
  };

  const saveUnitEdits = () => {
    if (!editingUnitId) return;
    const parsedDays = Number.parseInt(unitDraftDaysLeft, 10);

    updateClassUnits((units) =>
      units.map((unit) =>
        unit.id === editingUnitId
          ? {
            ...unit,
            title: unitDraftTitle.trim() || unit.title,
            examDate: unitDraftExamDate.trim() || unit.examDate,
            daysLeft: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 0,
          }
          : unit
      )
    );

    if (selectedUnit?.id === editingUnitId) {
      setSelectedUnit((prev) =>
        prev
          ? {
            ...prev,
            title: unitDraftTitle.trim() || prev.title,
            examDate: unitDraftExamDate.trim() || prev.examDate,
            daysLeft: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 0,
          }
          : prev
      );
    }

    setShowUnitEditModal(false);
    setEditingUnitId(null);
  };

  const deleteUnit = (unitId: number) => {
    Alert.alert('Delete Unit', 'This will remove the unit and all notes inside it. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateClassUnits((units) => units.filter((unit) => unit.id !== unitId));
          if (selectedUnit?.id === unitId) {
            setSelectedUnit(null);
          }
        },
      },
    ]);
  };

  const pickClassBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
      aspect: [3, 2],
    });

    if (!result.canceled && result.assets[0]) {
      setDraftImage(result.assets[0].uri);
    }
  };

  const updateSelectedUnit = (updater: (unit: UnitData) => UnitData) => {
    if (!selectedUnit) return;
    const updatedUnits = classData.units.map((unit) => (unit.id === selectedUnit.id ? updater(unit) : unit));
    const refreshed = updatedUnits.find((unit) => unit.id === selectedUnit.id) || selectedUnit;
    onUpdateClass({ ...classData, units: updatedUnits });
    setSelectedUnit(refreshed);
  };

  const openAddNoteModal = (subUnitId: string) => {
    setActiveSubUnitId(subUnitId);
    setNoteSource('filesTab');
    setSelectedClassFileId(classData.files[0]?.id || null);
    setLocalUpload(null);
    setNewNoteAuthor('You');
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowAddNoteModal(true);
  };

  const openScanTabFromAddNote = () => {
    setShowAddNoteModal(false);
    onScan?.();
  };

  const pickNoteFromPhone = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*', 'text/plain'],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const pages = asset.mimeType === 'application/pdf' ? 3 : 1;
      const trimmedName = asset.name.replace(/\.[^/.]+$/, '');

      setLocalUpload({
        name: asset.name,
        pages,
        content: `${trimmedName} was uploaded from phone storage. Key points are ready to annotate and merge with class notes.`,
      });
    }
  };

  const saveSectionNote = () => {
    if (!selectedUnit || !activeSubUnitId) return;

    const selectedFile = classData.files.find((file) => file.id === selectedClassFileId) || classData.files[0] || null;
    const sourceTitle =
      noteSource === 'filesTab'
        ? selectedFile
          ? `From File: ${selectedFile.name}`
          : 'Imported File Note'
        : localUpload
          ? `From Phone: ${localUpload.name}`
          : 'Uploaded Note';

    const sourceContent = noteSource === 'filesTab' ? selectedFile?.previewText : localUpload?.content;
    const sourcePages =
      noteSource === 'filesTab' ? Math.max(1, selectedFile?.pages || 1) : Math.max(1, localUpload?.pages || 1);

    const title = newNoteTitle.trim() || sourceTitle;
    const content = newNoteContent.trim() || sourceContent || 'New class note added.';

    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) =>
        sub.id === activeSubUnitId
          ? {
            ...sub,
            notes: [
              ...sub.notes,
              {
                id: Date.now(),
                title,
                author: newNoteAuthor.trim() || 'You',
                date: formatToday(),
                pages: sourcePages,
                content,
              },
            ],
          }
          : sub
      ),
    }));

    setShowAddNoteModal(false);
  };

  const openMergeNotesModal = (subUnitId: string) => {
    setActiveSubUnitId(subUnitId);
    setSelectedMergeNoteIds([]);
    setShowMergeModal(true);
  };

  const toggleMergeNote = (id: number) => {
    setSelectedMergeNoteIds((prev) => (prev.includes(id) ? prev.filter((noteId) => noteId !== id) : [...prev, id]));
  };

  const mergeSelectedNotes = () => {
    if (!selectedUnit || !activeSubUnitId || selectedMergeNoteIds.length < 2) return;

    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) => {
        if (sub.id !== activeSubUnitId) return sub;
        const chosen = sub.notes.filter((note) => selectedMergeNoteIds.includes(note.id));
        const mergedBody = chosen.map((note) => `- ${note.title}: ${note.content}`).join(' ');

        return {
          ...sub,
          notes: [
            ...sub.notes,
            {
              id: Date.now(),
              title: `Merged (${chosen.length} Notes)`,
              author: 'Citadel Merge',
              date: formatToday(),
              pages: 1,
              content: `Merged summary: ${mergedBody}`.slice(0, 600),
            },
          ],
        };
      }),
    }));

    setShowMergeModal(false);
  };

  const openNoteModal = (note: SubUnitNote, sectionTitle: string) => {
    setActiveNote({ note, sectionTitle });
    setNoteActionStatus('');
  };

  const shareActiveNote = async () => {
    if (!activeNote) return;
    await Share.share({
      title: activeNote.note.title,
      message: `${activeNote.note.title}\n${activeNote.note.author} • ${activeNote.note.date}\n\n${activeNote.note.content}`,
    });
  };

  const downloadActiveNote = () => {
    if (!activeNote) return;
    const wordCount = activeNote.note.content.trim().split(/\s+/).filter(Boolean).length;
    const sizeMb = Math.max(0.1, Number((activeNote.note.content.length / 1800).toFixed(1)));
    const readTime = Math.max(1, Math.ceil(wordCount / 180));

    const file = {
      id: Date.now(),
      name: `${activeNote.note.title}.txt`,
      date: formatToday(),
      thumbnail: classData.image,
      pages: Math.max(1, activeNote.note.pages),
      size: `${sizeMb}MB`,
      readTime: `${readTime} Min Read`,
      previewTitle: activeNote.note.title,
      previewText: activeNote.note.content,
      source: 'document' as const,
    };

    onUpdateClass({
      ...classData,
      files: [file, ...classData.files],
      documents: classData.documents + 1,
    });

    setNoteActionStatus('Saved to Files tab.');
    setTimeout(() => setNoteActionStatus(''), 1400);
  };

  if (selectedUnit) {
    const mergeCandidates = selectedUnit.subUnits.find((sub) => sub.id === activeSubUnitId)?.notes || [];

    return (
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.unitHeader}>
            <TouchableOpacity onPress={() => setSelectedUnit(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.unitHeaderText}>
              <Text style={styles.unitTitle}>{selectedUnit.title}</Text>
              <Text style={styles.unitMeta}>{classData.title}</Text>
            </View>
          </View>

          <View style={styles.unitOverviewCard}>
            <Text style={styles.unitOverviewTitle}>Unit Progress</Text>
            <View style={styles.progressRow}>
              <Text style={[styles.progressValue, { color: classAccent }]}>{Math.round(selectedUnitProgress * 100)}%</Text>
              <Text style={styles.progressSub}>
                {selectedUnitCompletedSections}/{selectedUnitTotalSections} sections complete
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(selectedUnitProgress * 100)}%`, backgroundColor: classAccent }]} />
            </View>

            <View style={styles.unitStatsRow}>
              <View style={styles.unitStatCard}>
                <Ionicons name="document-text" size={16} color={classAccent} />
                <Text style={styles.unitStatValue}>{selectedUnit.subUnits.reduce((a, s) => a + s.notes.length, 0)}</Text>
                <Text style={styles.unitStatLabel}>Notes</Text>
              </View>
              <View style={styles.unitStatCard}>
                <Ionicons name="people" size={16} color={classAccent} />
                <Text style={styles.unitStatValue}>{selectedUnit.collaborators}</Text>
                <Text style={styles.unitStatLabel}>Collaborators</Text>
              </View>
              <View style={styles.unitStatCard}>
                <Ionicons name="calendar" size={16} color={classAccent} />
                <Text style={styles.unitStatValue}>{selectedUnit.daysLeft}</Text>
                <Text style={styles.unitStatLabel}>Days Left</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderStack}>
            <Text style={styles.sectionTitle}>✈️ Sections</Text>
            <Text style={styles.sectionSub}>Track completion and upload notes from files or scans.</Text>
          </View>

          {/* Plane fly animation overlay */}
          {showPlane && (
            <Animated.View style={{ position: 'absolute', top: 340, left: 0, zIndex: 100, opacity: planeOpacity, transform: [{ translateX: planeX }, { translateY: planeY }] }}>
              <Text style={{ fontSize: 24 }}>✈️</Text>
            </Animated.View>
          )}

          <View style={styles.flightPath}>
            {selectedUnit.subUnits.map((subUnit, idx) => {
              const key = `${selectedUnit.id}-${subUnit.id}`;
              const done = !!unitProgress[key];
              const isLast = idx === selectedUnit.subUnits.length - 1;
              const quizzes = subUnit.quizzes || [];
              return (
                <View key={subUnit.id} style={styles.flightNode}>
                  {/* Dashed connector */}
                  {idx > 0 && (
                    <View style={styles.flightLineContainer}>
                      {[0, 1, 2, 3, 4].map((d) => (
                        <View key={d} style={[styles.flightDash, { backgroundColor: done ? classAccent : '#E0D0C8' }]} />
                      ))}
                    </View>
                  )}

                  {/* Waypoint */}
                  <AnimatedPressable
                    style={[
                      styles.flightWaypoint,
                      done && { backgroundColor: classAccent, borderColor: classAccent },
                    ]}
                    onPress={() => {
                      const willBeChecked = !done;
                      setUnitProgress((prev) => ({ ...prev, [key]: willBeChecked }));
                      if (willBeChecked) {
                        flyPlane();
                        setCheckRippleKey(key);
                        checkRippleScale.setValue(0.5);
                        checkRippleOpacity.setValue(0.5);
                        Animated.parallel([
                          Animated.timing(checkRippleScale, { toValue: 3, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                          Animated.timing(checkRippleOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
                        ]).start(() => setCheckRippleKey(null));
                      }
                    }}
                    scaleDown={0.85}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={18} color="white" />
                    ) : (
                      <Text style={styles.flightWaypointNum}>{idx + 1}</Text>
                    )}
                  </AnimatedPressable>

                  {/* Section info card */}
                  <View style={styles.flightInfo}>
                    <View style={styles.flightInfoTop}>
                      <Text style={styles.flightInfoTitle}>{subUnit.title}</Text>
                    </View>
                    <Text style={styles.flightInfoMeta}>
                      {subUnit.notes.length} note{subUnit.notes.length !== 1 ? 's' : ''}{quizzes.length > 0 ? ` • ${quizzes.length} quiz${quizzes.length !== 1 ? 'zes' : ''}` : ''}
                    </Text>

                    {/* Action buttons */}
                    <View style={[styles.subUnitActionsRow, { marginTop: 8 }]}>
                      <TouchableOpacity style={[styles.subUnitAction, { backgroundColor: `${classAccent}12` }]} onPress={() => openAddNoteModal(subUnit.id)}>
                        <Ionicons name="add" size={14} color={classAccent} />
                        <Text style={[styles.subUnitActionText, { color: classAccent }]}>Note</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subUnitAction, { backgroundColor: `${classAccent}12` }, subUnit.notes.length < 2 && styles.subUnitActionDisabled]}
                        onPress={() => openMergeNotesModal(subUnit.id)}
                        disabled={subUnit.notes.length < 2}
                      >
                        <Ionicons name="git-merge" size={14} color={subUnit.notes.length < 2 ? colors.textTertiary : classAccent} />
                        <Text style={[styles.subUnitActionText, { color: classAccent }, subUnit.notes.length < 2 && styles.subUnitActionTextDisabled]}>Merge</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subUnitAction, { backgroundColor: '#EDE9FE' }]}
                        onPress={() => { setActiveSubUnitId(subUnit.id); setQuizTitle(''); setShowAddQuiz(true); }}
                      >
                        <Ionicons name="school" size={14} color="#7c3aed" />
                        <Text style={[styles.subUnitActionText, { color: '#7c3aed' }]}>Quiz</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Notes list */}
                    {subUnit.notes.length > 0 && (
                      <View style={[styles.notesList, { marginTop: 8 }]}>
                        {subUnit.notes.map((note) => (
                          <TouchableOpacity key={note.id} style={styles.noteCard} onPress={() => openNoteModal(note, subUnit.title)}>
                            <View style={styles.noteTopRow}>
                              <Text style={styles.noteTitle}>{note.title}</Text>
                              <Text style={[styles.noteAuthorPill, { color: classAccent, backgroundColor: `${classAccent}12` }]}>{note.author}</Text>
                            </View>
                            <Text style={styles.noteMeta}>{note.date}</Text>
                            <Text style={styles.noteContent} numberOfLines={2}>{note.content}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Quizzes */}
                    {quizzes.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        {quizzes.map((quiz) => (
                          <View key={quiz.id} style={styles.quizRow}>
                            <Ionicons name="school" size={14} color="#7c3aed" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.quizTitle}>{quiz.title}</Text>
                              <Text style={styles.quizMeta}>{quiz.questions} questions • {quiz.date}</Text>
                            </View>
                            {quiz.score !== undefined ? (
                              <View style={[styles.quizScorePill, { backgroundColor: quiz.score >= 80 ? '#D1FAE5' : '#FEF3C7' }]}>
                                <Text style={[styles.quizScoreText, { color: quiz.score >= 80 ? '#059669' : '#d97706' }]}>{quiz.score}%</Text>
                              </View>
                            ) : (
                              <TouchableOpacity style={styles.quizTakeBtn} onPress={() => takeQuiz(subUnit.id, quiz.id)}>
                                <Text style={styles.quizTakeBtnText}>Take</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Test checkpoint at end */}
            <View style={styles.flightNode}>
              <View style={styles.flightLineContainer}>
                {[0, 1, 2].map((d) => (
                  <View key={d} style={[styles.flightDash, { backgroundColor: '#E0D0C8' }]} />
                ))}
              </View>
              <View style={[styles.flightWaypoint, styles.flightFlagNode, { backgroundColor: classAccent, borderColor: classAccent }]}>
                <Ionicons name="checkmark-done" size={18} color="white" />
              </View>
              <View style={styles.flightInfo}>
                <Text style={[styles.flightInfoTitle, { color: classAccent }]}>Unit Test ✅</Text>
                <Text style={styles.flightInfoMeta}>Complete all sections to ace the test!</Text>
              </View>
            </View>
          </View>

          {/* Study Sheet + SOS inside scroll, not blocking nav */}
          <View style={styles.unitActionBarInline}>
            <AnimatedPressable
              style={[styles.unitActionBtn, { backgroundColor: `${classAccent}12`, borderColor: `${classAccent}30` }]}
              onPress={() => setShowStudySheet(true)}
              scaleDown={0.94}
            >
              <Ionicons name="document-text" size={16} color={classAccent} />
              <Text style={[styles.unitActionBtnText, { color: classAccent }]}>Study Sheet</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.sosBtn]}
              onPress={() => { setShowSOS(true); setSosSent(false); }}
              scaleDown={0.9}
            >
              <Ionicons name="alert-circle" size={18} color="white" />
              <Text style={styles.sosBtnText}>SOS</Text>
            </AnimatedPressable>
          </View>
        </ScrollView>

        <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} />

        {/* Study Sheet Modal */}
        <Modal visible={showStudySheet} transparent animationType="slide" onRequestClose={() => setShowStudySheet(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.studySheetCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📄 Study Sheet</Text>
                <TouchableOpacity onPress={() => setShowStudySheet(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.studySheetSub}>{selectedUnit.title} — {classData.title}</Text>

              <ScrollView style={styles.studySheetScroll} showsVerticalScrollIndicator={false}>
                {selectedUnit.subUnits.map((sub) => {
                  const mergedNotes = sub.notes.filter(n => n.title.startsWith('Merged'));
                  const regularNotes = mergedNotes.length > 0 ? mergedNotes : sub.notes;
                  if (regularNotes.length === 0) return null;
                  return (
                    <View key={sub.id} style={styles.studySection}>
                      <Text style={styles.studySectionTitle}>{sub.title}</Text>
                      <View style={styles.studySectionDivider} />
                      {regularNotes.map((note) => (
                        <View key={note.id} style={styles.studyNoteBlock}>
                          <Text style={styles.studyNoteHeading}>{note.title}</Text>
                          <Text style={styles.studyNoteAuthor}>{note.author} • {note.date}</Text>
                          {note.content.split('. ').filter(Boolean).map((sentence, i) => (
                            <View key={i} style={styles.studyBullet}>
                              <Text style={styles.studyBulletDot}>•</Text>
                              <Text style={styles.studyBulletText}>{sentence.trim()}{sentence.endsWith('.') ? '' : '.'}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: classAccent }]}
                onPress={async () => {
                  const sheetText = selectedUnit.subUnits.map(sub => {
                    const notes = sub.notes.filter(n => n.title.startsWith('Merged'));
                    const use = notes.length > 0 ? notes : sub.notes;
                    return `## ${sub.title}\n${use.map(n => `${n.title}: ${n.content}`).join('\n')}`;
                  }).join('\n\n');
                  await Share.share({ title: `${selectedUnit.title} Study Sheet`, message: `${selectedUnit.title} — ${classData.title}\n\n${sheetText}` });
                }}
              >
                <Ionicons name="share-social" size={16} color="white" />
                <Text style={styles.modalSaveBtnText}>  Share Study Sheet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* SOS Modal */}
        <Modal visible={showSOS} transparent animationType="fade" onRequestClose={() => setShowSOS(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.sosCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🚨 SOS Help</Text>
                <TouchableOpacity onPress={() => setShowSOS(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.sosSubtitle}>Stuck on {selectedUnit.title}? We'll notify classmates who can help.</Text>

              {sosSent ? (
                <View style={styles.sosSentContainer}>
                  <Ionicons name="checkmark-circle" size={48} color="#059669" />
                  <Text style={styles.sosSentTitle}>SOS Sent! 🎉</Text>
                  <Text style={styles.sosSentSub}>Your classmates have been notified. Help is on the way!</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sosSectionLabel}>🟢 Active Now</Text>
                  <View style={styles.sosPersonList}>
                    {friendsDirectory.filter(f => f.status === 'online' || f.status === 'studying').map(f => (
                      <View key={f.id} style={styles.sosPersonRow}>
                        <View style={[styles.sosPersonDot, { backgroundColor: f.status === 'online' ? '#059669' : '#d97706' }]} />
                        <Text style={styles.sosPersonName}>{f.name}</Text>
                        <Text style={styles.sosPersonStatus}>{f.status === 'studying' ? 'Studying' : 'Online'}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.sosSectionLabel}>📝 Unit Note Contributors</Text>
                  <View style={styles.sosPersonList}>
                    {[...new Set(selectedUnit.subUnits.flatMap(s => s.notes.map(n => n.author)))].filter(a => a !== 'You' && a !== 'Citadel Merge').map(author => (
                      <View key={author} style={styles.sosPersonRow}>
                        <Ionicons name="document-text" size={14} color={classAccent} />
                        <Text style={styles.sosPersonName}>{author}</Text>
                        <Text style={styles.sosPersonStatus}>Contributor</Text>
                      </View>
                    ))}
                  </View>

                  <AnimatedPressable
                    style={styles.sosSendBtn}
                    onPress={() => setSosSent(true)}
                    scaleDown={0.95}
                  >
                    <Ionicons name="paper-plane" size={16} color="white" />
                    <Text style={styles.sosSendBtnText}>Send SOS</Text>
                  </AnimatedPressable>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Add Quiz Modal */}
        <Modal visible={showAddQuiz} transparent animationType="fade" onRequestClose={() => setShowAddQuiz(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.sosCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🎓 Add Quiz</Text>
                <TouchableOpacity onPress={() => setShowAddQuiz(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.sosSubtitle}>Create a quiz for this section to test your knowledge.</Text>
              <TextInput
                style={styles.input}
                placeholder="Quiz title"
                placeholderTextColor={colors.textTertiary}
                value={quizTitle}
                onChangeText={setQuizTitle}
              />
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Number of questions"
                placeholderTextColor={colors.textTertiary}
                value={quizQuestionCount}
                onChangeText={setQuizQuestionCount}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#7c3aed', marginTop: 14 }, !quizTitle.trim() && styles.modalSaveBtnDisabled]}
                onPress={addQuiz}
                disabled={!quizTitle.trim()}
              >
                <Ionicons name="school" size={16} color="white" />
                <Text style={styles.modalSaveBtnText}>  Create Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showAddNoteModal} transparent animationType="fade" onRequestClose={() => setShowAddNoteModal(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Note</Text>
                <TouchableOpacity onPress={() => setShowAddNoteModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.noteMethodRow}>
                <TouchableOpacity style={[styles.noteMethodBtn, styles.noteMethodBtnActive, { backgroundColor: classAccent }]}>
                  <Text style={[styles.noteMethodText, styles.noteMethodTextActive]}>Upload from Files</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noteMethodBtn} onPress={openScanTabFromAddNote}>
                  <Text style={styles.noteMethodText}>Scan Now</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Source</Text>
              <View style={styles.sourceRow}>
                <TouchableOpacity
                  style={[
                    styles.sourceChip,
                    noteSource === 'filesTab' && [styles.sourceChipActive, { backgroundColor: `${classAccent}15`, borderColor: `${classAccent}40` }],
                  ]}
                  onPress={() => setNoteSource('filesTab')}
                >
                  <Text style={[styles.sourceChipText, noteSource === 'filesTab' && [styles.sourceChipTextActive, { color: classAccent }]]}>
                    Files Tab
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sourceChip,
                    noteSource === 'phone' && [styles.sourceChipActive, { backgroundColor: `${classAccent}15`, borderColor: `${classAccent}40` }],
                  ]}
                  onPress={() => setNoteSource('phone')}
                >
                  <Text style={[styles.sourceChipText, noteSource === 'phone' && [styles.sourceChipTextActive, { color: classAccent }]]}>
                    Phone Storage
                  </Text>
                </TouchableOpacity>
              </View>

              {noteSource === 'filesTab' ? (
                classData.files.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filePickRow}>
                    {classData.files.map((file) => (
                      <TouchableOpacity
                        key={file.id}
                        style={[
                          styles.filePickChip,
                          selectedClassFileId === file.id && [styles.filePickChipActive, { borderColor: classAccent, backgroundColor: `${classAccent}12` }],
                        ]}
                        onPress={() => setSelectedClassFileId(file.id)}
                      >
                        <Text
                          style={[
                            styles.filePickChipText,
                            selectedClassFileId === file.id && [styles.filePickChipTextActive, { color: classAccent }],
                          ]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.sourceHint}>No files in this class yet. Add content manually or scan first.</Text>
                )
              ) : (
                <View>
                  <TouchableOpacity
                    style={[styles.phonePickBtn, { borderColor: `${classAccent}40`, backgroundColor: `${classAccent}10` }]}
                    onPress={pickNoteFromPhone}
                  >
                    <Ionicons name="folder-open" size={14} color={classAccent} />
                    <Text style={[styles.phonePickBtnText, { color: classAccent }]}>Choose File from Phone</Text>
                  </TouchableOpacity>
                  {localUpload && (
                    <Text style={styles.sourceHint}>
                      Selected: {localUpload.name} ({localUpload.pages} page{localUpload.pages > 1 ? 's' : ''})
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.modalLabel}>Contributor Name</Text>
              <TextInput style={styles.modalInput} value={newNoteAuthor} onChangeText={setNewNoteAuthor} placeholder="Name" />
              <Text style={styles.modalLabel}>Note Title</Text>
              <TextInput
                style={styles.modalInput}
                value={newNoteTitle}
                onChangeText={setNewNoteTitle}
                placeholder="Optional custom title"
              />
              <Text style={styles.modalLabel}>Add Extra Context (Optional)</Text>
              <TextInput
                style={styles.modalInputMultiline}
                value={newNoteContent}
                onChangeText={setNewNoteContent}
                placeholder="Add highlights or context for this section"
                multiline
              />

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: classAccent }, !canSaveAddedNote && styles.modalSaveBtnDisabled]}
                onPress={saveSectionNote}
                disabled={!canSaveAddedNote}
              >
                <Text style={styles.modalSaveBtnText}>Add to Section</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showMergeModal} transparent animationType="fade" onRequestClose={() => setShowMergeModal(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Merge Notes</Text>
                <TouchableOpacity onPress={() => setShowMergeModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.mergeHint}>Select 2 or more notes to combine into one merged summary.</Text>

              <ScrollView style={styles.mergeList}>
                {mergeCandidates.map((note) => {
                  const selected = selectedMergeNoteIds.includes(note.id);
                  return (
                    <TouchableOpacity key={note.id} style={styles.mergeItem} onPress={() => toggleMergeNote(note.id)}>
                      <View style={[styles.mergeCheckbox, selected && [styles.mergeCheckboxActive, { borderColor: classAccent, backgroundColor: classAccent }]]}>
                        {selected && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                      <View style={styles.mergeItemInfo}>
                        <Text style={styles.mergeItemTitle}>{note.title}</Text>
                        <Text style={styles.mergeItemMeta}>
                          {note.author} • {note.date}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: classAccent }, selectedMergeNoteIds.length < 2 && styles.modalSaveBtnDisabled]}
                onPress={mergeSelectedNotes}
                disabled={selectedMergeNoteIds.length < 2}
              >
                <Text style={styles.modalSaveBtnText}>Merge Selected</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={!!activeNote} transparent animationType="fade" onRequestClose={() => setActiveNote(null)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Note Details</Text>
                <TouchableOpacity onPress={() => setActiveNote(null)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {activeNote && (
                <>
                  <Text style={styles.detailNoteTitle}>{activeNote.note.title}</Text>
                  <Text style={styles.detailNoteMeta}>
                    {activeNote.sectionTitle} • {activeNote.note.author} • {activeNote.note.date}
                  </Text>
                  <ScrollView style={styles.detailNoteScroll}>
                    <Text style={styles.detailNoteBody}>{activeNote.note.content}</Text>
                  </ScrollView>

                  {noteActionStatus.length > 0 && <Text style={styles.noteActionStatus}>{noteActionStatus}</Text>}

                  <View style={styles.noteActionsRow}>
                    <TouchableOpacity
                      style={[styles.noteActionBtn, { borderColor: `${classAccent}35`, backgroundColor: `${classAccent}10` }]}
                      onPress={downloadActiveNote}
                    >
                      <Ionicons name="download-outline" size={14} color={classAccent} />
                      <Text style={[styles.noteActionText, { color: classAccent }]}>Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.noteActionBtn, { borderColor: `${classAccent}35`, backgroundColor: `${classAccent}10` }]}
                      onPress={shareActiveNote}
                    >
                      <Ionicons name="share-social-outline" size={14} color={classAccent} />
                      <Text style={[styles.noteActionText, { color: classAccent }]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.noteActionBtn, { borderColor: `${classAccent}35`, backgroundColor: `${classAccent}10` }]}
                      onPress={() => {
                        setActiveNote(null);
                        onFilesOpen();
                      }}
                    >
                      <Ionicons name="folder-open-outline" size={14} color={classAccent} />
                      <Text style={[styles.noteActionText, { color: classAccent }]}>Files</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View >
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: classData.image }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroBar}>
            <TouchableOpacity onPress={onBack} style={styles.heroBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.heroBtns}>
              <TouchableOpacity style={styles.heroBtn} onPress={openEditModal}>
                <Ionicons name="pencil" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroBtn} onPress={() => setShowInviteModal(true)}>
                <Ionicons name="people" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.courseTitle}>{classData.title}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{classData.block}</Text>
            </View>
            <View style={[styles.codePill, { backgroundColor: `${classAccent}10` }]}>
              <Ionicons name="key" size={13} color={classAccent} />
              <Text style={[styles.codeText, { color: classAccent }]}>{classData.classCode}</Text>
            </View>
          </View>

          {!isNewClass && (
            <View style={styles.stats}>
              <TouchableOpacity style={[styles.stat, styles.statPressable]} onPress={() => setShowClassmatesModal(true)} activeOpacity={0.8}>
                <Ionicons name="people" size={16} color={classAccent} />
                <Text style={styles.statText}>{classData.classmates} Classmates</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
              <View style={styles.stat}>
                <Ionicons name="document-text" size={16} color={classAccent} />
                <Text style={styles.statText}>{classData.documents} Documents</Text>
              </View>
            </View>
          )}

          {isNewClass ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text" size={24} color={classAccent} />
              <Text style={styles.emptyTitle}>Fresh Start</Text>
              <Text style={styles.emptyText}>
                This class is brand new. Invite classmates with your class code and upload your first materials.
              </Text>
              <TouchableOpacity style={[styles.inviteBtn, { backgroundColor: classAccent }]} onPress={() => setShowInviteModal(true)}>
                <Ionicons name="people" size={16} color="white" />
                <Text style={styles.inviteBtnText}>Invite Classmates</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.desc}>
              Currently studying: <Text style={styles.descBold}>{classData.description}</Text>. Keep your unit pages updated and
              collaborate with classmates.
            </Text>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>✈️ Path</Text>
            <TouchableOpacity style={[styles.addUnitBtn, { backgroundColor: classAccent }]} onPress={addUnit}>
              <Ionicons name="add" size={16} color="white" />
              <Text style={[styles.addUnitBtnText, { lineHeight: 16 }]}>New Unit</Text>
            </TouchableOpacity>
          </View>

          {classData.units.length > 0 ? (
            <View style={styles.flightPath}>
              {classData.units.map((unit, idx) => {
                const totalNotes = unit.subUnits.reduce((a, s) => a + s.notes.length, 0);
                const sectionCount = unit.subUnits.length;
                const completedSections = unit.subUnits.filter(
                  (sub) => unitProgress[`${unit.id}-${sub.id}`]
                ).length;
                const unitProg = sectionCount > 0 ? completedSections / sectionCount : 0;
                const isComplete = unitProg === 1;
                const isLast = idx === classData.units.length - 1;

                // Find "current" unit = first incomplete
                const isCurrentUnit = !isComplete && (idx === 0 || classData.units.slice(0, idx).every((u) => {
                  const c = u.subUnits.filter((s) => unitProgress[`${u.id}-${s.id}`]).length;
                  return u.subUnits.length > 0 && c === u.subUnits.length;
                }));

                return (
                  <View key={unit.id} style={styles.flightNode}>
                    {/* Dashed connector line */}
                    {idx > 0 && (
                      <View style={styles.flightLineContainer}>
                        {[0, 1, 2, 3, 4].map((d) => (
                          <View key={d} style={[styles.flightDash, { backgroundColor: isComplete ? classAccent : '#E0D0C8' }]} />
                        ))}
                      </View>
                    )}

                    {/* Student avatar on current node */}
                    {isCurrentUnit && (
                      <View style={[styles.flightAvatar, { borderColor: classAccent }]}>
                        <Ionicons name="person" size={14} color={classAccent} />
                      </View>
                    )}

                    {/* Waypoint node */}
                    <TouchableOpacity
                      style={[
                        styles.flightWaypoint,
                        isComplete && { backgroundColor: classAccent, borderColor: classAccent },
                        isCurrentUnit && { borderColor: classAccent, borderWidth: 3 },
                      ]}
                      onPress={() => setSelectedUnit(unit)}
                      activeOpacity={0.7}
                    >
                      {isComplete ? (
                        <Ionicons name="checkmark" size={18} color="white" />
                      ) : (
                        <Text style={[styles.flightWaypointNum, isCurrentUnit && { color: classAccent }]}>{idx + 1}</Text>
                      )}
                    </TouchableOpacity>

                    {/* Unit info card */}
                    <TouchableOpacity style={styles.flightInfo} onPress={() => setSelectedUnit(unit)} activeOpacity={0.7}>
                      <View style={styles.flightInfoTop}>
                        <Text style={styles.flightInfoTitle}>{unit.title}</Text>
                        <View style={styles.flightInfoActions}>
                          <TouchableOpacity style={styles.flightInfoActionBtn} onPress={() => openUnitEditor(unit)}>
                            <Ionicons name="pencil" size={12} color={classAccent} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.flightInfoActionBtn} onPress={() => deleteUnit(unit.id)}>
                            <Ionicons name="trash" size={12} color="#b91c1c" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.flightInfoMeta}>
                        {sectionCount} sections • {totalNotes} notes
                      </Text>
                      {/* Mini progress bar */}
                      <View style={styles.flightProgress}>
                        <View style={[styles.flightProgressFill, { width: `${Math.round(unitProg * 100)}%`, backgroundColor: classAccent }]} />
                      </View>
                      <View style={styles.flightInfoBottom}>
                        <Text style={[styles.flightInfoDays, { color: classAccent }]}>
                          {unit.daysLeft > 0 ? `${unit.daysLeft}d left` : 'TBD'}
                        </Text>
                        <Text style={styles.flightInfoExam}>{unit.examDate}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Final destination: Exam flag */}
              <View style={styles.flightNode}>
                <View style={styles.flightLineContainer}>
                  {[0, 1, 2].map((d) => (
                    <View key={d} style={[styles.flightDash, { backgroundColor: '#E0D0C8' }]} />
                  ))}
                </View>
                <View style={[styles.flightWaypoint, styles.flightFlagNode, { backgroundColor: classAccent, borderColor: classAccent }]}>
                  <Ionicons name="flag" size={18} color="white" />
                </View>
                <View style={styles.flightInfo}>
                  <Text style={[styles.flightInfoTitle, { color: classAccent }]}>End of Course 🏆</Text>
                  <Text style={styles.flightInfoMeta}>Complete all units to ace it!</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyUnits}>
              <Ionicons name="book" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyUnitsText}>No units yet.</Text>
              <TouchableOpacity style={[styles.addUnitInlineBtn, { backgroundColor: classAccent }]} onPress={addUnit}>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addUnitBtnText}>Create First Unit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} />

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Class</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Class Name</Text>
            <TextInput style={styles.modalInput} value={draftTitle} onChangeText={setDraftTitle} />
            <Text style={styles.modalLabel}>Block</Text>
            <TextInput style={styles.modalInput} value={draftBlock} onChangeText={setDraftBlock} />
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput style={styles.modalInput} value={draftDescription} onChangeText={setDraftDescription} />
            <Text style={styles.modalLabel}>Class Code</Text>
            <TextInput
              style={styles.modalInput}
              value={draftCode}
              onChangeText={(text) => setDraftCode(text.toUpperCase())}
              autoCapitalize="characters"
            />
            <Text style={styles.modalLabel}>Background Image</Text>
            <TouchableOpacity
              style={[styles.imagePickerBtn, { borderColor: `${classAccent}40`, backgroundColor: `${classAccent}10` }]}
              onPress={pickClassBackground}
            >
              <Ionicons name="image" size={16} color={classAccent} />
              <Text style={[styles.imagePickerBtnText, { color: classAccent }]}>Upload / Change Background</Text>
            </TouchableOpacity>
            <Image source={{ uri: draftImage }} style={styles.editImagePreview} />

            <Text style={styles.modalLabel}>Theme Color</Text>
            <View style={styles.colorRow}>
              {themeColorChoices.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorDot, { backgroundColor: color }, draftColor === color && styles.colorDotActive]}
                  onPress={() => setDraftColor(color)}
                />
              ))}
            </View>

            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: draftColor || classAccent }]} onPress={saveClassEdits}>
              <Text style={styles.modalSaveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showUnitEditModal} transparent animationType="fade" onRequestClose={() => setShowUnitEditModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.noteModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Unit</Text>
              <TouchableOpacity onPress={() => setShowUnitEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Unit Title</Text>
            <TextInput style={styles.modalInput} value={unitDraftTitle} onChangeText={setUnitDraftTitle} />
            <Text style={styles.modalLabel}>Exam Date</Text>
            <TextInput style={styles.modalInput} value={unitDraftExamDate} onChangeText={setUnitDraftExamDate} placeholder="Ex: 05/10/2026" />
            <Text style={styles.modalLabel}>Days Left</Text>
            <TextInput
              style={styles.modalInput}
              value={unitDraftDaysLeft}
              onChangeText={setUnitDraftDaysLeft}
              placeholder="Ex: 28"
              keyboardType="number-pad"
            />

            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: classAccent }]} onPress={saveUnitEdits}>
              <Text style={styles.modalSaveBtnText}>Save Unit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.inviteCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Classmates</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteLabel}>Share this custom class code:</Text>
            <View style={styles.codeCard}>
              <Ionicons name="key" size={18} color={classAccent} />
              <Text style={[styles.codeCardText, { color: classAccent }]}>{classData.classCode}</Text>
            </View>

            {copyStatus.length > 0 && <Text style={styles.copyStatus}>{copyStatus}</Text>}

            <View style={styles.inviteActions}>
              <AnimatedPressable style={styles.inviteActionBtn} onPress={copyClassCode} scaleDown={0.92}>
                <Animated.View style={{ transform: [{ scale: copyIconScale }] }}>
                  <Ionicons name={copyIconDone ? 'checkmark-circle' : 'copy-outline'} size={16} color={copyIconDone ? '#059669' : classAccent} />
                </Animated.View>
                <Text style={[styles.inviteActionText, { color: copyIconDone ? '#059669' : classAccent }]}>
                  {copyIconDone ? 'Copied!' : 'Copy Code'}
                </Text>
              </AnimatedPressable>
              <TouchableOpacity style={styles.inviteActionBtn} onPress={regenerateCode}>
                <Ionicons name="refresh" size={16} color={classAccent} />
                <Text style={[styles.inviteActionText, { color: classAccent }]}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClassmatesModal} transparent animationType="fade" onRequestClose={() => setShowClassmatesModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.classmatesCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Classmates ({classmatesList.length})</Text>
              <TouchableOpacity onPress={() => setShowClassmatesModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.classmatesSub}>Everyone currently in this class.</Text>

            <ScrollView style={styles.classmatesList} showsVerticalScrollIndicator={false}>
              {classmatesList.map((name, index) => (
                <TouchableOpacity
                  key={`${name}-${index}`}
                  style={styles.classmateRow}
                  onPress={() => { setShowClassmatesModal(false); onPersonOpen?.(name); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.classmateAvatar, { backgroundColor: `${classAccent}16` }]}>
                    <Ionicons name="person" size={16} color={classAccent} />
                  </View>
                  <Text style={styles.classmateName}>{name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: classAccent }]} onPress={() => setShowClassmatesModal(false)}>
              <Text style={styles.modalSaveBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  hero: { height: 260, width: '100%' },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroBar: {
    position: 'absolute',
    top: 48,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtns: { flexDirection: 'row', gap: 8 },

  sheet: {
    backgroundColor: '#FFF8F2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  courseTitle: { fontSize: 26, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  badge: { backgroundColor: '#FFF5ED', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 2, borderColor: '#F0E0D0' },
  badgeText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.maroon}10`,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  codeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.maroon },
  stats: { flexDirection: 'row', gap: 20, marginTop: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statPressable: { paddingVertical: 2 },
  statText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.medium },
  desc: { fontSize: 14, color: colors.textSecondary, marginTop: 24, lineHeight: 22, fontFamily: fonts.regular },
  descBold: { fontFamily: fonts.bold, color: colors.textPrimary },

  emptyBox: { backgroundColor: 'white', borderRadius: 28, padding: 24, alignItems: 'center', marginTop: 24, borderWidth: 2, borderColor: '#F0E0D0' },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: fonts.regular },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    height: 46,
    paddingHorizontal: 24,
    backgroundColor: colors.maroon,
    borderRadius: 18,
  },
  inviteBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: 'white' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionHeaderStack: { marginHorizontal: 24, marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  sectionSub: { marginTop: 4, fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },
  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.maroon,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 38,
  },
  addUnitBtnText: { fontSize: 12, fontFamily: fonts.bold, color: 'white' },

  unitsRow: { gap: 12, paddingRight: 24 },
  unitCard: {
    width: 226,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  unitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unitCardTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1, marginRight: 8 },
  unitCardActions: { flexDirection: 'row', gap: 6 },
  unitCardActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitCardBody: { marginTop: 10 },
  unitCardDaysPill: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.maroon}12`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  unitCardDaysText: { fontSize: 11, color: colors.maroon, fontFamily: fonts.bold },
  unitCardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 8, fontFamily: fonts.medium },
  unitCardFooter: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitCardExam: { fontSize: 11, color: colors.textTertiary, fontFamily: fonts.medium },

  emptyUnits: { alignItems: 'center', paddingVertical: 32, backgroundColor: 'white', borderRadius: 28, borderWidth: 2, borderColor: '#F0E0D0' },
  emptyUnitsText: { fontSize: 14, color: colors.textSecondary, marginTop: 8, fontFamily: fonts.medium },
  addUnitInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    height: 42,
    paddingHorizontal: 20,
    backgroundColor: colors.maroon,
    borderRadius: 18,
  },

  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  unitHeaderText: { flex: 1 },
  unitTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  unitMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  unitOverviewCard: {
    marginHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  unitOverviewTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 },
  progressValue: { fontSize: 26, fontFamily: fonts.bold, color: colors.maroon },
  progressSub: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.medium },
  progressTrack: { height: 8, backgroundColor: '#F0E0D0', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.maroon, borderRadius: 999 },
  unitStatsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  unitStatCard: { flex: 1, backgroundColor: '#FFF5ED', borderRadius: 16, padding: 10, alignItems: 'center' },
  unitStatValue: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4 },
  unitStatLabel: { fontSize: 10, color: colors.textSecondary, fontFamily: fonts.medium },

  subUnitCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 24,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  subUnitHeader: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0D0C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  subUnitInfo: { flex: 1, marginLeft: 10 },
  subUnitTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  subUnitCount: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  subUnitActionsRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  subUnitAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    borderRadius: 14,
    backgroundColor: `${colors.maroon}12`,
    paddingHorizontal: 10,
  },
  subUnitActionDisabled: { backgroundColor: '#FFF5ED' },
  subUnitActionText: { fontSize: 12, color: colors.maroon, fontFamily: fonts.bold },
  subUnitActionTextDisabled: { color: colors.textTertiary },

  notesList: { marginTop: 12, gap: 8 },
  noteCard: { backgroundColor: '#FFF5ED', borderRadius: 16, padding: 12 },
  noteTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary, flex: 1, marginRight: 8 },
  noteAuthorPill: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.maroon,
    backgroundColor: `${colors.maroon}12`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  noteMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontFamily: fonts.regular },
  noteContent: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 18, fontFamily: fonts.regular },
  noteTapHint: { marginTop: 8, fontSize: 10, color: colors.maroon, fontFamily: fonts.bold },
  emptySectionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#FFF5ED',
    borderRadius: 14,
    padding: 10,
  },
  emptySectionText: { fontSize: 12, color: colors.textSecondary, flex: 1, fontFamily: fonts.regular },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropCentered: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: 30 },
  inviteCard: { width: '100%', backgroundColor: '#FFF8F2', borderRadius: 28, padding: 22 },
  noteModalCard: { width: '100%', backgroundColor: '#FFF8F2', borderRadius: 28, padding: 22, maxHeight: '88%' },
  classmatesCard: { width: '100%', backgroundColor: '#FFF8F2', borderRadius: 28, padding: 22, maxHeight: '84%' },
  classmatesSub: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, fontFamily: fonts.regular },
  classmatesList: { maxHeight: 360 },
  classmateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
  },
  classmateAvatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  classmateName: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.semiBold },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
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
  modalInputMultiline: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    fontFamily: fonts.medium,
  },
  modalSaveBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 20,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: { backgroundColor: '#D8C8B8' },
  modalSaveBtnText: { color: 'white', fontSize: 15, fontFamily: fonts.bold },

  noteMethodRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 8 },
  noteMethodBtn: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  noteMethodBtnActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  noteMethodText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bold },
  noteMethodTextActive: { color: 'white' },

  sourceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sourceChip: {
    flex: 1,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  sourceChipActive: { backgroundColor: `${colors.maroon}15`, borderWidth: 2, borderColor: `${colors.maroon}40` },
  sourceChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bold },
  sourceChipTextActive: { color: colors.maroon },
  filePickRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filePickChip: {
    maxWidth: 180,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    backgroundColor: 'white',
  },
  filePickChipActive: { borderColor: colors.maroon, backgroundColor: `${colors.maroon}12` },
  filePickChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  filePickChipTextActive: { color: colors.maroon },
  phonePickBtn: {
    height: 40,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: `${colors.maroon}40`,
    backgroundColor: `${colors.maroon}10`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  phonePickBtnText: { color: colors.maroon, fontSize: 12, fontFamily: fonts.bold },
  sourceHint: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 18, fontFamily: fonts.regular },

  mergeHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10, fontFamily: fonts.regular },
  mergeList: { maxHeight: 220 },
  mergeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
  },
  mergeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0D0C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeCheckboxActive: { borderColor: colors.maroon, backgroundColor: colors.maroon },
  mergeItemInfo: { flex: 1 },
  mergeItemTitle: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.bold },
  mergeItemMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  detailNoteTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4 },
  detailNoteMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  detailNoteScroll: { marginTop: 10, maxHeight: 180, borderRadius: 16, backgroundColor: '#FFF5ED', padding: 12 },
  detailNoteBody: { fontSize: 13, color: colors.textPrimary, lineHeight: 20, fontFamily: fonts.regular },
  noteActionStatus: { marginTop: 10, fontSize: 12, color: '#047857', fontFamily: fonts.bold },
  noteActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  noteActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: `${colors.maroon}35`,
    backgroundColor: `${colors.maroon}10`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexDirection: 'row',
  },
  noteActionText: { fontSize: 12, fontFamily: fonts.bold, color: colors.maroon },

  imagePickerBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: `${colors.maroon}40`,
    backgroundColor: `${colors.maroon}10`,
  },
  imagePickerBtnText: { color: colors.maroon, fontSize: 13, fontFamily: fonts.bold },
  editImagePreview: { marginTop: 8, width: '100%', height: 100, borderRadius: 16, backgroundColor: '#FFF5ED' },
  colorRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  colorDot: { width: 30, height: 30, borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#111' },

  inviteLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  codeCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF5ED',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  codeCardText: { fontSize: 20, letterSpacing: 1, fontFamily: fonts.bold, color: colors.maroon },
  copyStatus: { marginTop: 10, fontSize: 12, color: '#047857', fontFamily: fonts.semiBold },
  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  inviteActionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  inviteActionText: { fontSize: 13, color: colors.maroon, fontFamily: fonts.bold },

  // === Flight Path ===
  flightPath: { paddingLeft: 20, paddingRight: 20, paddingBottom: 8 },
  flightNode: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  flightLineContainer: {
    position: 'absolute',
    left: 20,
    top: -38,
    width: 2,
    height: 38,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  flightDash: { width: 2, height: 5, borderRadius: 1 },
  flightAvatar: {
    position: 'absolute',
    left: 5,
    top: -20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  flightWaypoint: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E0D0C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    zIndex: 5,
  },
  flightWaypointNum: { fontSize: 15, fontFamily: fonts.bold, color: colors.textTertiary },
  flightFlagNode: { borderWidth: 0 },
  flightInfo: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    padding: 14,
    marginBottom: 8,
  },
  flightInfoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flightInfoTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  flightInfoActions: { flexDirection: 'row', gap: 6 },
  flightInfoActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightInfoMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4 },
  flightProgress: {
    height: 4,
    backgroundColor: '#F0E0D0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden' as const,
  },
  flightProgressFill: { height: 4, borderRadius: 2 },
  flightInfoBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  flightInfoDays: { fontSize: 12, fontFamily: fonts.bold },
  flightInfoExam: { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary },

  // === Unit Action Bar ===
  unitActionBar: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
    zIndex: 20,
  },
  unitActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  unitActionBtnText: { fontSize: 13, fontFamily: fonts.bold },
  sosBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#dc2626',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sosBtnText: { fontSize: 13, fontFamily: fonts.bold, color: 'white' },

  // === Study Sheet Modal ===
  studySheetCard: {
    flex: 1,
    marginTop: 60,
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  studySheetSub: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2, marginBottom: 12 },
  studySheetScroll: { flex: 1 },
  studySection: { marginBottom: 20 },
  studySectionTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, textTransform: 'uppercase' as const, letterSpacing: 1 },
  studySectionDivider: { height: 2, backgroundColor: '#F0E0D0', borderRadius: 1, marginTop: 6, marginBottom: 12 },
  studyNoteBlock: { marginBottom: 14, paddingLeft: 8 },
  studyNoteHeading: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.maroon },
  studyNoteAuthor: { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, marginBottom: 6 },
  studyBullet: { flexDirection: 'row', gap: 8, marginBottom: 4, paddingRight: 8 },
  studyBulletDot: { fontSize: 14, lineHeight: 20, color: colors.maroon, fontFamily: fonts.bold },
  studyBulletText: { fontSize: 13, lineHeight: 20, color: colors.textPrimary, fontFamily: fonts.regular, flex: 1 },

  // === SOS Modal ===
  sosCard: {
    width: '88%',
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 20,
    maxHeight: '80%',
  },
  sosSubtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 16 },
  sosSentContainer: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  sosSentTitle: { fontSize: 20, fontFamily: fonts.bold, color: '#059669' },
  sosSentSub: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' as const },
  sosSectionLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 10, marginBottom: 8 },
  sosPersonList: { marginBottom: 8 },
  sosPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  sosPersonDot: { width: 8, height: 8, borderRadius: 4 },
  sosPersonName: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary },
  sosPersonStatus: { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary },
  sosSendBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sosSendBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },

  // === Quiz styles ===
  quizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    marginBottom: 6,
  },
  quizTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary },
  quizMeta: { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 1 },
  quizScorePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  quizScoreText: { fontSize: 12, fontFamily: fonts.bold },
  quizTakeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
  },
  quizTakeBtnText: { fontSize: 12, fontFamily: fonts.bold, color: 'white' },

  // === Inline Action Bar (inside scroll) ===
  unitActionBarInline: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 20,
  },

  // === Input (for quiz modal) ===
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: '#FFF8F2',
  },
});
