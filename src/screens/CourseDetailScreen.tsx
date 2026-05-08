import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { InlineTutorialCard } from '../components/InlineTutorialCard';
import { FormattedText } from '../components/FormattedText';
import { colors, fonts } from '../theme';
import { friendsDirectory } from '../data/friends';
import { getAPCourseFramework } from '../data/apCourseFrameworks';
import { mergeNotesWithAI, extractTextFromImage, extractTextFromMultipleImages, generateQuizFromNotes, generateQuizHint, generateAPPracticeTest, generateAnswerExplanation, generateQuizAdvice } from '../lib/gemini';
import { uploadScanImage } from '../lib/storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { ClassData, SubUnitNote, UnitData, Quiz, QuizQuestion, QuizAttempt } from '../types';

interface Props {
  classData: ClassData;
  onBack: () => void;
  onFilesOpen: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onUpdateClass: (updatedClass: ClassData) => void;
  onPersonOpen?: (name: string) => void;
  unitProgress: Record<string, boolean>;
  onUpdateProgress: (progress: Record<string, boolean>) => void;
  userName?: string;
  onSendClassInvite?: (toUserId: string, classes: ClassData[]) => void;
  pendingScanNote?: { title: string; content: string; thumbnail: string } | null;
  onClearPendingScanNote?: () => void;
  tutorialStep?: number;
  onTutorialNext?: () => void;
  onTutorialBack?: () => void;
  onTutorialSkip?: () => void;
}

const TUTORIAL_TOTAL_STEPS = 7;
const AP_PRACTICE_COUNTS = [10, 18, 25, 40];
const AP_PRACTICE_DIFFICULTIES = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const;
type APPracticeDifficulty = typeof AP_PRACTICE_DIFFICULTIES[number]['value'];

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

function buildClassmateList(total: number, preset: string[] | undefined, seed: string) {
  // Only return real classmate names — no fake filler names
  const fromPreset = (preset || []).map((name) => name.trim()).filter(Boolean);
  // Deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of fromPreset) {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(name);
    }
  }
  return result;
}

export function CourseDetailScreen({
  classData,
  onBack,
  onFilesOpen,
  onScan,
  onFriends,
  onUpdateClass,
  onPersonOpen,
  unitProgress,
  onUpdateProgress,
  userName,
  onSendClassInvite,
  pendingScanNote,
  onClearPendingScanNote,
  tutorialStep = 0,
  onTutorialNext = () => { },
  onTutorialBack = () => { },
  onTutorialSkip = () => { },
}: Props) {
  const classAccent = classData.color || colors.maroon;
  const apCourseFramework = useMemo(() => getAPCourseFramework(classData.title), [classData.title]);
  const apPracticeUnits = apCourseFramework?.units || [];
  const isAPClass = !!apCourseFramework || /^AP\b/i.test(classData.title.trim()) || /AP Class/i.test(classData.description);
  const themeColorChoices = [
    { hex: colors.maroon, label: 'Maroon' },
    { hex: '#0f766e', label: 'Teal' },
    { hex: '#1d4ed8', label: 'Royal' },
    { hex: '#7c3aed', label: 'Purple' },
    { hex: '#b45309', label: 'Amber' },
    { hex: '#be185d', label: 'Rose' },
    { hex: '#059669', label: 'Emerald' },
    { hex: '#4338ca', label: 'Indigo' },
    { hex: '#dc2626', label: 'Coral' },
    { hex: '#475569', label: 'Slate' },
    { hex: '#166534', label: 'Forest' },
    { hex: '#7f1d1d', label: 'Wine' },
  ];

  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);

  // Refs to avoid stale closures in setTimeout callbacks
  const classDataRef = useRef(classData);
  classDataRef.current = classData;
  const selectedUnitRef = useRef(selectedUnit);
  selectedUnitRef.current = selectedUnit;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showClassmatesModal, setShowClassmatesModal] = useState(false);
  const [showBlockEditModal, setShowBlockEditModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState(classData.teacher || '');
  const [showCodeEditModal, setShowCodeEditModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);

  const [draftTitle, setDraftTitle] = useState(classData.title);
  const [draftBlock, setDraftBlock] = useState(classData.block);
  const [draftDescription, setDraftDescription] = useState(classData.description);
  const [draftCode, setDraftCode] = useState(classData.classCode);
  const [draftImage, setDraftImage] = useState(classData.image);
  const [draftColor, setDraftColor] = useState(classData.color || colors.maroon);

  // === Scan-to-Unit Picker ===
  const [showScanUnitPicker, setShowScanUnitPicker] = useState(false);
  const [scanPickerUnitId, setScanPickerUnitId] = useState<number | null>(null);
  const [scanPickerSubUnitId, setScanPickerSubUnitId] = useState<string | null>(null);
  const [scanNewUnitTitle, setScanNewUnitTitle] = useState('');

  useEffect(() => {
    if (pendingScanNote) {
      if (classData.units.length === 0) {
        // No units — auto-show create unit flow
        setShowScanUnitPicker(true);
        setScanPickerUnitId(null);
        setScanPickerSubUnitId(null);
      } else {
        // Has units — show picker
        setShowScanUnitPicker(true);
        setScanPickerUnitId(classData.units[0].id);
        const firstSub = classData.units[0].subUnits[0];
        setScanPickerSubUnitId(firstSub?.id || null);
      }
    }
  }, [pendingScanNote]);

  const confirmScanToUnit = () => {
    if (!pendingScanNote) return;

    let updatedClass = { ...classData };

    // If no unit selected, we need to create one
    if (!scanPickerUnitId && scanNewUnitTitle.trim()) {
      const newUnitId = Date.now();
      const newUnit: UnitData = {
        id: newUnitId,
        title: scanNewUnitTitle.trim(),
        pages: 0,
        collaborators: 0,
        examDate: 'TBD',
        daysLeft: 0,
        subUnits: [
          { id: '1.1', title: '1.1', notes: [{ id: Date.now() + 1, title: pendingScanNote.title, author: userName || 'You', date: formatToday(), pages: 1, content: pendingScanNote.content }] },
          { id: '1.2', title: '1.2', notes: [] },
          { id: '1.3', title: '1.3', notes: [] },
        ],
      };
      updatedClass = { ...updatedClass, units: [...updatedClass.units, newUnit] };
    } else if (scanPickerUnitId && scanPickerSubUnitId) {
      // Add to existing unit/subunit
      updatedClass = {
        ...updatedClass,
        units: updatedClass.units.map((unit) =>
          unit.id === scanPickerUnitId
            ? {
              ...unit,
              subUnits: unit.subUnits.map((sub) =>
                sub.id === scanPickerSubUnitId
                  ? {
                    ...sub,
                    notes: [...sub.notes, { id: Date.now() + 1, title: pendingScanNote.title, author: userName || 'You', date: formatToday(), pages: 1, content: pendingScanNote.content }],
                  }
                  : sub
              ),
            }
            : unit
        ),
      };
    }

    onUpdateClass(updatedClass);
    setShowScanUnitPicker(false);
    setScanPickerUnitId(null);
    setScanPickerSubUnitId(null);
    setScanNewUnitTitle('');
    onClearPendingScanNote?.();
  };

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
  const [newNoteAuthor, setNewNoteAuthor] = useState(userName || 'You');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteStep, setNoteStep] = useState<1 | 2 | 3>(1);
  // Multi-page scan state for unit note adding
  type ScannedNotePage = { uri: string; base64: string; mimeType: string };
  const [scannedNotePages, setScannedNotePages] = useState<ScannedNotePage[]>([]);
  const [ocrProcessingNote, setOcrProcessingNote] = useState(false);
  const [selectedMergeNoteIds, setSelectedMergeNoteIds] = useState<number[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedResult, setMergedResult] = useState<{ title: string; content: string } | null>(null);
  const [showMergedViewer, setShowMergedViewer] = useState(false);
  const [activeNote, setActiveNote] = useState<{ note: SubUnitNote; sectionTitle: string } | null>(null);
  const [noteActionStatus, setNoteActionStatus] = useState('');
  // Edit note state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  // Pending scan target — when user taps "Scan Now" from add-note
  const [pendingScanTarget, setPendingScanTarget] = useState<{ unitId: number; subUnitId: string } | null>(null);
  const [collapsedUnits, setCollapsedUnits] = useState<Set<number>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const setUnitProgress = (updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
    if (typeof updater === 'function') {
      onUpdateProgress(updater(unitProgress));
    } else {
      onUpdateProgress(updater);
    }
  };




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
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [editingQuizSubUnitId, setEditingQuizSubUnitId] = useState<string | null>(null);

  // Quiz-taking state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeQuizSubUnitId, setActiveQuizSubUnitId] = useState<string | null>(null);
  const [quizCurrentQ, setQuizCurrentQ] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizEliminated, setQuizEliminated] = useState<Record<number, number[]>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizHintsShown, setQuizHintsShown] = useState<Set<number>>(new Set());
  const [dynamicHints, setDynamicHints] = useState<Record<number, string>>({});
  const [hintLoading, setHintLoading] = useState(false);
  const [answerExplanations, setAnswerExplanations] = useState<Record<string, string>>({});
  const [explanationLoadingKey, setExplanationLoadingKey] = useState<string | null>(null);
  const [quizAdvice, setQuizAdvice] = useState<string | null>(null);
  const [quizAdviceLoading, setQuizAdviceLoading] = useState(false);
  const [apPracticeLoading, setApPracticeLoading] = useState(false);
  const [showAPPracticeSetup, setShowAPPracticeSetup] = useState(false);
  const [apPracticeQuestionCount, setAPPracticeQuestionCount] = useState(18);
  const [apPracticeDifficulty, setAPPracticeDifficulty] = useState<APPracticeDifficulty>('mixed');
  const [apPracticeUnitIds, setAPPracticeUnitIds] = useState<string[]>(() => apPracticeUnits.map((unit) => unit.id));

  // Score history modal
  const [scoreHistoryQuiz, setScoreHistoryQuiz] = useState<Quiz | null>(null);
  const [scoreHistorySubUnitId, setScoreHistorySubUnitId] = useState<string | null>(null);

  const openQuizAttemptReview = useCallback((quiz: Quiz, attempt: QuizAttempt, subUnitId: string | null = null) => {
    if (!quiz.questionData || quiz.questionData.length === 0) return;
    setScoreHistoryQuiz(null);
    setScoreHistorySubUnitId(null);
    setActiveQuiz(quiz);
    setActiveQuizSubUnitId(subUnitId);
    setQuizCurrentQ(0);
    setQuizAnswers([...attempt.answers]);
    setQuizEliminated({});
    setQuizSubmitted(true);
    setQuizScore(attempt.score);
    setQuizHintsShown(new Set());
    setDynamicHints({});
    setQuizAdvice(quiz.lastAdvice || null);
    setQuizAdviceLoading(false);
  }, []);

  const openLatestQuizAttempt = useCallback((quiz: Quiz, subUnitId: string | null = null) => {
    const latestAttempt = quiz.scoreHistory?.[quiz.scoreHistory.length - 1];
    if (latestAttempt) {
      openQuizAttemptReview(quiz, latestAttempt, subUnitId);
    }
  }, [openQuizAttemptReview]);

  const openScoreHistory = useCallback((quiz: Quiz, subUnitId: string | null = null) => {
    setScoreHistoryQuiz(quiz);
    setScoreHistorySubUnitId(subUnitId);
  }, []);

  const explainQuizQuestion = useCallback(async (question: QuizQuestion, selectedIndex: number | null, key: string) => {
    if (answerExplanations[key] || explanationLoadingKey) return;
    setExplanationLoadingKey(key);
    const explanation = await generateAnswerExplanation(
      question.question,
      [...question.options],
      question.correctIndex,
      selectedIndex,
    );
    setAnswerExplanations((prev) => ({ ...prev, [key]: explanation }));
    setExplanationLoadingKey(null);
  }, [answerExplanations, explanationLoadingKey]);

  const tutorialGuide = tutorialStep === 3 ? {
    step: 3,
    title: 'See the class hub',
    body: 'Units and sections keep the class from turning into a pile. Next, open Files to see everything saved for this class in one place.',
  } : null;

  useEffect(() => {
    setAPPracticeUnitIds(apPracticeUnits.map((unit) => unit.id));
  }, [apPracticeUnits, classData.id]);

  const addQuiz = async () => {
    if (!selectedUnit || !activeSubUnitId) return;

    // Gather all notes from this sub-unit
    const subUnit = selectedUnit.subUnits.find((s) => s.id === activeSubUnitId);
    if (!subUnit || subUnit.notes.length === 0) {
      Alert.alert('No Notes', 'Add some notes to this section first, then generate a quiz from them.');
      return;
    }

    const count = parseInt(quizQuestionCount) || 5;
    const quizId = Date.now();
    const newQuiz: Quiz = {
      id: quizId,
      title: 'Generating quiz…',
      questions: count,
      date: formatToday(),
      status: 'generating',
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

    // Call Gemini to generate questions
    const noteInputs = subUnit.notes.map((n) => ({ title: n.title, content: n.content }));
    const result = await generateQuizFromNotes(noteInputs, count);

    if (result.success) {
      updateSelectedUnitDeferred((unit) => ({
        ...unit,
        subUnits: unit.subUnits.map((sub) => ({
          ...sub,
          quizzes: (sub.quizzes || []).map((q) =>
            q.id === quizId
              ? {
                ...q,
                title: result.title,
                status: 'ready' as const,
                questions: result.questions.length,
                questionData: result.questions.map((rq) => ({
                  question: rq.question,
                  options: rq.options,
                  correctIndex: rq.correctIndex,
                  hint: rq.hint,
                })),
              }
              : q
          ),
        })),
      }));
    } else {
      Alert.alert('Quiz Generation Failed', result.error || 'Please try again.');
      // Remove the failed quiz
      updateSelectedUnitDeferred((unit) => ({
        ...unit,
        subUnits: unit.subUnits.map((sub) => ({
          ...sub,
          quizzes: (sub.quizzes || []).filter((q) => q.id !== quizId),
        })),
      }));
    }
  };

  const startQuiz = (subUnitId: string | null, quiz: Quiz) => {
    if (!quiz.questionData || quiz.questionData.length === 0) return;
    setActiveQuiz(quiz);
    setActiveQuizSubUnitId(subUnitId);
    setQuizCurrentQ(0);
    setQuizAnswers(new Array(quiz.questionData.length).fill(null));
    setQuizEliminated({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizHintsShown(new Set());
    setDynamicHints({});
  };

  const startAPPractice = useCallback(async () => {
    if (apPracticeLoading) return;

    const selectedFrameworkUnits = apPracticeUnits.length > 0 ? apPracticeUnits : [{
      id: 'standard-ap-framework',
      title: `${classData.title} full course framework`,
      sections: [],
    }];
    const selectedUnitIds = apPracticeUnitIds.length > 0
      ? apPracticeUnitIds
      : selectedFrameworkUnits.map((unit) => unit.id);
    const selectedOutline = selectedFrameworkUnits
      .filter((unit) => selectedUnitIds.includes(unit.id))
      .map((unit) => ({
        unitTitle: unit.title,
        sections: unit.sections,
      }));
    const questionCount = Math.max(5, Math.min(40, apPracticeQuestionCount));

    setShowAPPracticeSetup(false);
    setApPracticeLoading(true);
    const result = await generateAPPracticeTest(classData.title, selectedOutline, questionCount, apPracticeDifficulty);
    setApPracticeLoading(false);

    if (!result.success || result.questions.length === 0) {
      Alert.alert('Could Not Build AP Practice', result.error || 'Please try again in a moment.');
      return;
    }

    const practiceQuiz: Quiz = {
      id: Date.now(),
      title: result.title || `AP Practice: ${classData.title}`,
      questions: result.questions.length,
      date: formatToday(),
      type: 'ap-practice',
      status: 'ready',
      questionData: result.questions,
    };

    onUpdateClass({
      ...classData,
      apPracticeTests: [practiceQuiz, ...(classData.apPracticeTests || [])],
    });
    setActiveQuiz(practiceQuiz);
    setActiveQuizSubUnitId(null);
    setQuizCurrentQ(0);
    setQuizAnswers(new Array(result.questions.length).fill(null));
    setQuizEliminated({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizHintsShown(new Set());
    setDynamicHints({});
  }, [apPracticeDifficulty, apPracticeLoading, apPracticeQuestionCount, apPracticeUnitIds, apPracticeUnits, classData, onUpdateClass]);

  const submitQuiz = async () => {
    if (!activeQuiz?.questionData) return;

    let correct = 0;
    activeQuiz.questionData.forEach((q, i) => {
      if (quizAnswers[i] === q.correctIndex) correct++;
    });
    const totalQ = activeQuiz.questionData.length;
    const score = Math.round((correct / totalQ) * 100);

    setQuizScore(score);
    setQuizSubmitted(true);

    // Generate AI study advice
    setQuizAdvice(null);
    setQuizAdviceLoading(true);
    generateQuizAdvice(activeQuiz.questionData, quizAnswers)
      .then((advice) => {
        setQuizAdvice(advice);
        // Persist advice into quiz data
        setActiveQuiz((prev) => prev ? { ...prev, lastAdvice: advice } : prev);
        // Save to class data — use classDataRef.current to avoid overwriting concurrent grading save
        const freshData = classDataRef.current;
        if (!activeQuizSubUnitId) {
          // AP practice test path
          onUpdateClass({
            ...freshData,
            apPracticeTests: (freshData.apPracticeTests || []).map((q) =>
              q.id === activeQuiz.id ? { ...q, lastAdvice: advice } : q
            ),
          });
        } else {
          // Section quiz path
          const updatedUnits = freshData.units.map((unit) => ({
            ...unit,
            subUnits: unit.subUnits.map((sub) =>
              sub.id === activeQuizSubUnitId
                ? {
                  ...sub,
                  quizzes: (sub.quizzes || []).map((q) =>
                    q.id === activeQuiz.id ? { ...q, lastAdvice: advice } : q
                  ),
                }
                : sub
            ),
          }));
          onUpdateClass({ ...freshData, units: updatedUnits });
        }
      })
      .finally(() => setQuizAdviceLoading(false));

    // Get current user info for the attempt record
    let userId = 'unknown';
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || 'unknown';
    } catch { /* fallback */ }

    const attempt: QuizAttempt = {
      userId,
      userName: userName || 'You',
      score,
      correct,
      total: totalQ,
      date: formatToday(),
      answers: [...quizAnswers],
    };

    if (!activeQuizSubUnitId) {
      const history = [...(activeQuiz.scoreHistory || []), attempt];
      const userAttempts = history.filter((a) => a.userId === userId);
      const bestScore = Math.max(...userAttempts.map((a) => a.score));
      const updatedPracticeQuiz: Quiz = {
        ...activeQuiz,
        score: bestScore,
        status: 'graded',
        scoreHistory: history,
        questionData: activeQuiz.questionData.map((qd, i) => ({
          ...qd,
          selectedIndex: quizAnswers[i] ?? undefined,
        })),
      };

      onUpdateClass({
        ...classDataRef.current,
        apPracticeTests: (classDataRef.current.apPracticeTests || []).some((quiz) => quiz.id === activeQuiz.id)
          ? (classDataRef.current.apPracticeTests || []).map((quiz) =>
            quiz.id === activeQuiz.id ? updatedPracticeQuiz : quiz
          )
          : [updatedPracticeQuiz, ...(classDataRef.current.apPracticeTests || [])],
      });
      setActiveQuiz(updatedPracticeQuiz);
      return;
    }

    // Save attempt to score history and update best score
    // Use onUpdateClass directly (not updateSelectedUnit) to avoid silent failures when selectedUnit is null
    const currentData = classDataRef.current;
    const updatedUnits = currentData.units.map((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) =>
        sub.id === activeQuizSubUnitId
          ? {
            ...sub,
            quizzes: (sub.quizzes || []).map((q) => {
              if (q.id !== activeQuiz.id) return q;
              const history = [...(q.scoreHistory || []), attempt];
              const userAttempts = history.filter((a) => a.userId === userId);
              const bestScore = Math.max(...userAttempts.map((a) => a.score));
              return {
                ...q,
                score: bestScore,
                status: 'graded' as const,
                scoreHistory: history,
                questionData: q.questionData?.map((qd, i) => ({
                  ...qd,
                  selectedIndex: quizAnswers[i] ?? undefined,
                })),
              };
            }),
          }
          : sub
      ),
    }));
    onUpdateClass({ ...currentData, units: updatedUnits });
    // Keep selectedUnit in sync if it's active
    if (selectedUnit) {
      const refreshed = updatedUnits.find((u) => u.id === selectedUnit.id);
      if (refreshed) setSelectedUnit(refreshed);
    }
  };

  const retakeQuiz = () => {
    if (!activeQuiz?.questionData) return;
    setQuizCurrentQ(0);
    setQuizAnswers(new Array(activeQuiz.questionData.length).fill(null));
    setQuizEliminated({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizHintsShown(new Set());
    setDynamicHints({});
    setQuizAdvice(null);
    setQuizAdviceLoading(false);
  };

  const closeQuizModal = useCallback(() => {
    setActiveQuiz(null);
    setActiveQuizSubUnitId(null);
    setQuizCurrentQ(0);
    setQuizAnswers([]);
    setQuizEliminated({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizHintsShown(new Set());
    setDynamicHints({});
    setQuizAdvice(null);
    setQuizAdviceLoading(false);
  }, []);

  const selectQuizAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    setQuizAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
    setQuizEliminated((prev) => {
      const current = prev[questionIndex] || [];
      if (!current.includes(optionIndex)) return prev;
      const remaining = current.filter((idx) => idx !== optionIndex);
      const next = { ...prev };
      if (remaining.length > 0) next[questionIndex] = remaining;
      else delete next[questionIndex];
      return next;
    });
  }, []);

  const toggleEliminatedAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    setQuizEliminated((prev) => {
      const current = prev[questionIndex] || [];
      const nextForQuestion = current.includes(optionIndex)
        ? current.filter((idx) => idx !== optionIndex)
        : [...current, optionIndex];
      const next = { ...prev };
      if (nextForQuestion.length > 0) next[questionIndex] = nextForQuestion;
      else delete next[questionIndex];
      return next;
    });
    setQuizAnswers((prev) => {
      if (prev[questionIndex] !== optionIndex) return prev;
      const next = [...prev];
      next[questionIndex] = null;
      return next;
    });
  }, []);

  const openEditQuiz = (quiz: Quiz, subUnitId: string) => {
    setEditingQuizId(quiz.id);
    setEditingQuizSubUnitId(subUnitId);
    setQuizTitle(quiz.title);
    setQuizQuestionCount(String(quiz.questions));
    setShowAddQuiz(true);
  };

  const saveQuizEdit = () => {
    if (!selectedUnit || !editingQuizSubUnitId || !quizTitle.trim()) return;
    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) =>
        sub.id === editingQuizSubUnitId
          ? {
            ...sub,
            quizzes: (sub.quizzes || []).map((q) =>
              q.id === editingQuizId
                ? { ...q, title: quizTitle.trim(), questions: parseInt(quizQuestionCount) || 5 }
                : q
            ),
          }
          : sub
      ),
    }));
    setShowAddQuiz(false);
    setEditingQuizId(null);
    setEditingQuizSubUnitId(null);
    setQuizTitle('');
  };

  const deleteQuiz = (subUnitId: string, quizId: number) => {
    Alert.alert('Delete Quiz', 'Remove this quiz? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateSelectedUnit((unit) => ({
            ...unit,
            subUnits: unit.subUnits.map((sub) =>
              sub.id === subUnitId
                ? { ...sub, quizzes: (sub.quizzes || []).filter((q) => q.id !== quizId) }
                : sub
            ),
          }));
        },
      },
    ]);
  };

  const deleteAPPractice = (quizId: number) => {
    Alert.alert('Delete AP Practice', 'Remove this AP practice test and its scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onUpdateClass({
            ...classData,
            apPracticeTests: (classData.apPracticeTests || []).filter((quiz) => quiz.id !== quizId),
          });
        },
      },
    ]);
  };

  // === Copy icon morph microinteraction ===
  const [copyIconDone, setCopyIconDone] = useState(false);
  const copyIconScale = useRef(new Animated.Value(1)).current;

  // === Checkbox completion ripple ===
  const checkRippleScale = useRef(new Animated.Value(0)).current;
  const checkRippleOpacity = useRef(new Animated.Value(0)).current;
  const [checkRippleKey, setCheckRippleKey] = useState<string | null>(null);

  const isNewClass = classData.classmates === 0;
  const classmatesList = useMemo(
    () => buildClassmateList(classData.classmates, classData.classmateNames, classData.classCode),
    [classData.classCode, classData.classmateNames, classData.classmates]
  );

  const selectedUnitTotalSections = selectedUnit?.subUnits.length || 0;
  const selectedUnitCompletedSections = useMemo(() => {
    if (!selectedUnit) return 0;
    return selectedUnit.subUnits.filter((sub) => unitProgress[`${classData.id}-${selectedUnit.id}-${sub.id}`]).length;
  }, [selectedUnit, unitProgress]);

  const selectedUnitProgress =
    selectedUnitTotalSections > 0 ? selectedUnitCompletedSections / selectedUnitTotalSections : 0;

  const canSaveAddedNote = useMemo(() => {
    if (!activeSubUnitId) return false;
    const hasTypedText = newNoteContent.trim().length > 0 || newNoteTitle.trim().length > 0;
    return hasTypedText || !!localUpload;
  }, [activeSubUnitId, localUpload, newNoteContent, newNoteTitle]);

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

  const openBlockEditModal = () => {
    setDraftBlock(classData.block);
    setShowBlockEditModal(true);
  };

  const saveBlockEdit = () => {
    onUpdateClass({
      ...classData,
      block: draftBlock.trim() || classData.block,
    });
    setShowBlockEditModal(false);
  };

  const openCodeEditModal = () => {
    setDraftCode(classData.classCode);
    setShowCodeEditModal(true);
  };

  const saveCodeEdit = () => {
    onUpdateClass({
      ...classData,
      classCode: draftCode.trim().toUpperCase() || classData.classCode,
    });
    setShowCodeEditModal(false);
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

  // Deferred version that reads from refs — safe to call inside setTimeout
  const updateSelectedUnitDeferred = useCallback((updater: (unit: UnitData) => UnitData) => {
    const currentUnit = selectedUnitRef.current;
    const currentData = classDataRef.current;
    if (!currentUnit) return;
    const updatedUnits = currentData.units.map((unit) => (unit.id === currentUnit.id ? updater(unit) : unit));
    const refreshed = updatedUnits.find((unit) => unit.id === currentUnit.id) || currentUnit;
    onUpdateClass({ ...currentData, units: updatedUnits });
    setSelectedUnit(refreshed);
  }, [onUpdateClass]);

  const openAddNoteModal = (subUnitId: string) => {
    setActiveSubUnitId(subUnitId);
    setNoteSource('phone');
    setLocalUpload(null);
    setNewNoteAuthor(userName || 'You');
    setNewNoteTitle('');
    setNewNoteContent('');
    setScannedNotePages([]);
    setOcrProcessingNote(false);
    setNoteStep(1);
    setShowAddNoteModal(true);
  };

  const [isScanningNote, setIsScanningNote] = useState(false);

  // Multi-page scan: capture first page with camera and go to staging step
  const scanNoteWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera Permission', 'Camera access is needed to scan notes.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      mediaTypes: ['images'],
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    let base64Data = asset.base64 || undefined;
    if (!base64Data && asset.uri) {
      try {
        base64Data = await FileSystemLegacy.readAsStringAsync(asset.uri, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });
      } catch { /* fallback */ }
    }

    if (base64Data) {
      const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
      setScannedNotePages([{ uri: asset.uri, base64: base64Data, mimeType }]);
      setNoteStep(2); // Go to multi-page staging step
    }
  };

  // Multi-page scan: pick first page from library and go to staging step
  const scanNoteFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      mediaTypes: ['images'],
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    let base64Data = asset.base64 || undefined;
    if (!base64Data && asset.uri) {
      try {
        base64Data = await FileSystemLegacy.readAsStringAsync(asset.uri, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });
      } catch { /* fallback */ }
    }

    if (base64Data) {
      const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
      setScannedNotePages([{ uri: asset.uri, base64: base64Data, mimeType }]);
      setNoteStep(2); // Go to multi-page staging step
    }
  };

  // Add additional page from camera
  const addNotePageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      mediaTypes: ['images'],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64 || undefined;
      if (!base64Data && asset.uri) {
        try {
          base64Data = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: FileSystemLegacy.EncodingType.Base64 });
        } catch { /* fallback */ }
      }
      if (base64Data) {
        const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        setScannedNotePages(prev => [...prev, { uri: asset.uri, base64: base64Data!, mimeType }]);
      }
    }
  };

  // Add additional page from photo library
  const addNotePageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      mediaTypes: ['images'],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64Data = asset.base64 || undefined;
      if (!base64Data && asset.uri) {
        try {
          base64Data = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: FileSystemLegacy.EncodingType.Base64 });
        } catch { /* fallback */ }
      }
      if (base64Data) {
        const mimeType = asset.uri?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        setScannedNotePages(prev => [...prev, { uri: asset.uri, base64: base64Data!, mimeType }]);
      }
    }
  };

  // Remove a page from the staging area
  const removeNotePage = (index: number) => {
    setScannedNotePages(prev => prev.filter((_, i) => i !== index));
  };

  // Finalize: run OCR on all scanned pages, then save as a note in the unit
  const finalizeNotePages = async () => {
    if (scannedNotePages.length === 0 || !selectedUnit || !activeSubUnitId) return;

    setShowAddNoteModal(false);
    setIsScanningNote(true);
    setOcrProcessingNote(true);

    let noteTitle = `Scanned Note — ${formatToday()}`;
    let noteContent = '';

    try {
      if (scannedNotePages.length === 1) {
        const ocrResult = await extractTextFromImage(scannedNotePages[0].base64, scannedNotePages[0].mimeType);
        if (ocrResult.success && ocrResult.text.trim().length > 0) {
          noteTitle = ocrResult.title;
          noteContent = ocrResult.text;
        }
      } else {
        const ocrResult = await extractTextFromMultipleImages(
          scannedNotePages.map(p => ({ base64: p.base64, mimeType: p.mimeType }))
        );
        if (ocrResult.success && ocrResult.text.trim().length > 0) {
          noteTitle = ocrResult.title;
          noteContent = ocrResult.text;
        }
      }
    } catch (ocrErr) {
      console.warn('OCR failed:', ocrErr);
    }

    if (!noteContent.trim()) {
      noteContent = 'OCR could not extract text from these images. The scanned images are saved.';
      Alert.alert('OCR Notice', 'Could not extract text from the images. The scan has been saved, but you may want to re-scan with clearer text.');
    }

    const scanName = `Scan_${Date.now()}.jpg`;
    const wordCount = noteContent.trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 180));

    // Upload first page image to Supabase so classmates can view it
    let thumbnailUrl = scannedNotePages[0].uri;
    try {
      const publicUrl = await uploadScanImage(scannedNotePages[0].uri, `note_${Date.now()}`);
      if (publicUrl) {
        thumbnailUrl = publicUrl;
      }
    } catch (e) {
      console.log('Note image upload failed, using local URI:', e);
    }

    // Save as file in class files tab
    const file = {
      id: Date.now(),
      name: scanName,
      date: formatToday(),
      thumbnail: thumbnailUrl,
      pages: scannedNotePages.length,
      size: '1.0MB',
      readTime: `${readTime} Min Read`,
      previewTitle: noteTitle,
      previewText: noteContent,
      source: 'camera' as const,
    };

    // Save as note in the target unit/subUnit
    const updatedUnits = classData.units.map((unit) =>
      unit.id === selectedUnit.id
        ? {
          ...unit,
          subUnits: unit.subUnits.map((sub) =>
            sub.id === activeSubUnitId
              ? {
                ...sub,
                notes: [
                  ...sub.notes,
                  {
                    id: Date.now() + 1,
                    title: noteTitle,
                    author: userName || 'You',
                    date: formatToday(),
                    pages: scannedNotePages.length,
                    content: noteContent,
                  },
                ],
              }
              : sub
          ),
        }
        : unit
    );

    const updatedClass = {
      ...classData,
      units: updatedUnits,
      files: [file, ...classData.files],
      documents: classData.documents + 1,
    };

    onUpdateClass(updatedClass);
    setSelectedUnit(updatedUnits.find((u) => u.id === selectedUnit.id) || selectedUnit);
    setIsScanningNote(false);
    setOcrProcessingNote(false);
    setScannedNotePages([]);
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

  // Sync notes to class_code_registry for cross-user sharing
  const syncNotesToRegistry = async (updatedClassData: ClassData) => {
    try {
      const normalized = updatedClassData.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      await supabase.from('class_code_registry')
        .update({ class_data: updatedClassData })
        .eq('class_code', normalized);
    } catch (e) {
      // Registry may not exist, that's ok
    }
  };

  // Fetch remote notes and files from registry and merge any new ones
  const fetchRemoteNotes = useCallback(async () => {
    try {
      const normalized = classData.classCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      // Get current user ID so we skip our own registry entry
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;

      const { data, error } = await supabase
        .from('class_code_registry')
        .select('class_data, owner_id')
        .eq('class_code', normalized);

      if (error || !data || data.length === 0) return;

      const allRemoteNotes = new Map<string, Map<number, any>>();

      for (const row of data) {
        // Skip our own entry — only merge content from classmates
        if (currentUserId && (row as any).owner_id === currentUserId) continue;

        const remoteClass = row.class_data as ClassData;
        if (!remoteClass) continue;

        // Collect remote notes
        if (remoteClass.units) {
          for (const remoteUnit of remoteClass.units) {
            for (const remoteSub of remoteUnit.subUnits) {
              if (!allRemoteNotes.has(remoteSub.id)) {
                allRemoteNotes.set(remoteSub.id, new Map());
              }
              const noteMap = allRemoteNotes.get(remoteSub.id)!;
              for (const note of remoteSub.notes) {
                if (!noteMap.has(note.id)) {
                  noteMap.set(note.id, note);
                }
              }
            }
          }
        }
      }

      let hasChanges = false;

      // Merge notes
      const mergedUnits = classData.units.map((localUnit) => {
        const mergedSubUnits = localUnit.subUnits.map((localSub) => {
          const remoteNoteMap = allRemoteNotes.get(localSub.id);
          if (!remoteNoteMap) return localSub;

          const localNoteIds = new Set(localSub.notes.map((n) => n.id));
          const newNotes = Array.from(remoteNoteMap.values()).filter(
            (rn) => !localNoteIds.has(rn.id)
          );

          if (newNotes.length > 0) {
            hasChanges = true;
            return { ...localSub, notes: [...localSub.notes, ...newNotes] };
          }
          return localSub;
        });

        return { ...localUnit, subUnits: mergedSubUnits };
      });

      if (hasChanges) {
        onUpdateClass({ ...classData, units: mergedUnits });
      }
    } catch (e) {
      // Silently fail
    }
  }, [classData, onUpdateClass]);

  // Fetch remote notes on mount and when switching units
  useEffect(() => {
    fetchRemoteNotes();
  }, []);

  const saveSectionNote = () => {
    if (!selectedUnit || !activeSubUnitId) return;

    const sourceTitle = localUpload
      ? `From Phone: ${localUpload.name}`
      : 'New Note';

    const sourceContent = localUpload?.content || '';
    const sourcePages = Math.max(1, localUpload?.pages || 1);

    const title = newNoteTitle.trim() || sourceTitle;
    const content = newNoteContent.trim() || sourceContent || 'New class note added.';

    const updatedUnits = classData.units.map((unit) =>
      unit.id === selectedUnit.id
        ? {
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
                    author: newNoteAuthor.trim() || userName || 'You',
                    date: formatToday(),
                    pages: sourcePages,
                    content,
                  },
                ],
              }
              : sub
          ),
        }
        : unit
    );

    const updatedClass = { ...classData, units: updatedUnits };
    onUpdateClass(updatedClass);
    setSelectedUnit(updatedUnits.find((u) => u.id === selectedUnit.id) || selectedUnit);

    // Sync to registry for other class members to see
    syncNotesToRegistry(updatedClass);

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

  const mergeSelectedNotes = async () => {
    if (!selectedUnit || !activeSubUnitId || selectedMergeNoteIds.length < 2) return;

    const sub = selectedUnit.subUnits.find((s) => s.id === activeSubUnitId);
    if (!sub) return;
    const chosen = sub.notes.filter((note) => selectedMergeNoteIds.includes(note.id));

    setIsMerging(true);
    const result = await mergeNotesWithAI(
      chosen.map((n) => ({ title: n.title, content: n.content, author: n.author }))
    );
    setIsMerging(false);

    if (!result.success) {
      setShowMergeModal(false);
      setNoteActionStatus(result.content);
      setTimeout(() => setNoteActionStatus(''), 2500);
      return;
    }

    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((s) => {
        if (s.id !== activeSubUnitId) return s;
        return {
          ...s,
          notes: [
            ...s.notes,
            {
              id: Date.now(),
              title: result.title,
              author: 'Citadel AI',
              date: formatToday(),
              pages: 1,
              content: result.content,
            },
          ],
        };
      }),
    }));

    setShowMergeModal(false);
    setMergedResult({ title: result.title, content: result.content });
    setShowMergedViewer(true);
  };

  const downloadMergedToDevice = async () => {
    if (!mergedResult) return;
    try {
      const fileName = mergedResult.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
      const fileUri = `${FileSystemLegacy.documentDirectory}${fileName}.txt`;
      await FileSystemLegacy.writeAsStringAsync(fileUri, `${mergedResult.title}\n\n${mergedResult.content}`);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Save ${mergedResult.title}`,
        });
      } else {
        setNoteActionStatus('Sharing not available on this device.');
        setTimeout(() => setNoteActionStatus(''), 1400);
      }
    } catch {
      setNoteActionStatus('Could not save to device.');
      setTimeout(() => setNoteActionStatus(''), 1400);
    }
  };

  const shareMergedNote = async () => {
    if (!mergedResult) return;
    await Share.share({
      title: mergedResult.title,
      message: `${mergedResult.title}\n\n${mergedResult.content}`,
    });
  };

  const openNoteModal = (note: SubUnitNote, sectionTitle: string) => {
    setActiveNote({ note, sectionTitle });
    setNoteActionStatus('');
    setIsEditingNote(false);
  };

  const shareActiveNote = async () => {
    if (!activeNote) return;
    await Share.share({
      title: activeNote.note.title,
      message: `${activeNote.note.title}\n${activeNote.note.author} • ${activeNote.note.date}\n\n${activeNote.note.content}`,
    });
  };

  const downloadActiveNote = async () => {
    if (!activeNote) return;
    try {
      const fileName = activeNote.note.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
      const fileUri = `${FileSystemLegacy.documentDirectory}${fileName}.txt`;
      const fileContent = `${activeNote.note.title}\n${activeNote.note.author} • ${activeNote.note.date}\n\n${activeNote.note.content}`;
      await FileSystemLegacy.writeAsStringAsync(fileUri, fileContent);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Save ${activeNote.note.title}`,
        });
      } else {
        setNoteActionStatus('Sharing not available on this device.');
        setTimeout(() => setNoteActionStatus(''), 1400);
      }
    } catch {
      setNoteActionStatus('Could not download note.');
      setTimeout(() => setNoteActionStatus(''), 1400);
    }
  };

  const startEditNote = () => {
    if (!activeNote) return;
    setEditNoteTitle(activeNote.note.title);
    setEditNoteContent(activeNote.note.content);
    setIsEditingNote(true);
  };

  const saveEditNote = () => {
    if (!activeNote || !selectedUnit) return;
    const newTitle = editNoteTitle.trim() || activeNote.note.title;
    const newContent = editNoteContent.trim() || activeNote.note.content;

    updateSelectedUnit((unit) => ({
      ...unit,
      subUnits: unit.subUnits.map((sub) => ({
        ...sub,
        notes: sub.notes.map((note) =>
          note.id === activeNote.note.id
            ? { ...note, title: newTitle, content: newContent }
            : note
        ),
      })),
    }));

    setActiveNote({
      ...activeNote,
      note: { ...activeNote.note, title: newTitle, content: newContent },
    });
    setIsEditingNote(false);
    setNoteActionStatus('Note updated.');
    setTimeout(() => setNoteActionStatus(''), 1400);
  };

  const deleteNote = () => {
    if (!activeNote || !selectedUnit) return;
    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${activeNote.note.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            updateSelectedUnit((unit) => ({
              ...unit,
              subUnits: unit.subUnits.map((sub) => ({
                ...sub,
                notes: sub.notes.filter((note) => note.id !== activeNote.note.id),
              })),
            }));
            setActiveNote(null);
          },
        },
      ]
    );
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

          {tutorialGuide && (
          <InlineTutorialCard
            step={tutorialGuide.step}
            totalSteps={TUTORIAL_TOTAL_STEPS}
            title={tutorialGuide.title}
            body={tutorialGuide.body}
            onDismiss={onTutorialSkip}
            onPrevious={onTutorialBack}
            onNext={onTutorialNext}
            nextLabel="Go to Files"
          />
        )}

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
            <Text style={styles.sectionTitle}>Sections</Text>
            <Text style={styles.sectionSub}>Track completion and upload notes from files or scans.</Text>
          </View>



          <View style={styles.flightPath}>
            {selectedUnit.subUnits.map((subUnit, idx) => {
              const key = `${classData.id}-${selectedUnit.id}-${subUnit.id}`;
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
                    <TouchableOpacity
                      style={styles.flightInfoTop}
                      onPress={() => {
                        setCollapsedSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(subUnit.id)) next.delete(subUnit.id);
                          else next.add(subUnit.id);
                          return next;
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.flightInfoTitle}>{subUnit.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.flightInfoMeta, { marginTop: 0 }]}>
                          {subUnit.notes.length} note{subUnit.notes.length !== 1 ? 's' : ''}{quizzes.length > 0 ? ` • ${quizzes.length} quiz${quizzes.length !== 1 ? 'zes' : ''}` : ''}
                        </Text>
                        <Ionicons
                          name={collapsedSections.has(subUnit.id) ? 'chevron-down' : 'chevron-up'}
                          size={14}
                          color={colors.textTertiary}
                        />
                      </View>
                    </TouchableOpacity>

                    {!collapsedSections.has(subUnit.id) && (
                      <>
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
                            style={[styles.subUnitAction, { backgroundColor: `${classAccent}12` }]}
                            onPress={() => { setActiveSubUnitId(subUnit.id); setQuizTitle(''); setShowAddQuiz(true); }}
                          >
                            <Ionicons name="school" size={14} color={classAccent} />
                            <Text style={[styles.subUnitActionText, { color: classAccent }]}>Quiz</Text>
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
                            {quizzes.map((quiz) => {
                              const isGenerating = quiz.status === 'generating';
                              const isGrading = quiz.status === 'grading';
                              const isGraded = quiz.status === 'graded';
                              const isReady = !quiz.status || quiz.status === 'ready';
                              return (
                                <TouchableOpacity
                                  key={quiz.id}
                                  style={[styles.quizRow, (isGenerating || isGrading) && styles.quizRowPending]}
                                  activeOpacity={isGraded && (quiz.scoreHistory?.length || 0) > 0 ? 0.72 : 1}
                                  onPress={() => isGraded ? openLatestQuizAttempt(quiz, subUnit.id) : undefined}
                                  disabled={isGenerating || isGrading}
                                >
                                  <View style={styles.quizIconSlot}>
                                    {isGenerating || isGrading ? (
                                      <ActivityIndicator size="small" color={classAccent} />
                                    ) : (
                                      <Ionicons name="school" size={14} color={classAccent} />
                                    )}
                                  </View>
                                  <View style={styles.quizBody}>
                                    <View style={styles.quizTextBlock}>
                                      <Text style={[styles.quizTitle, (isGenerating || isGrading) && { color: colors.textTertiary }]}>
                                        {isGenerating ? 'Generating…' : isGrading ? 'Grading…' : quiz.title}
                                      </Text>
                                      {!isGenerating && (
                                        <Text style={styles.quizMeta}>{quiz.questions} questions • {quiz.date}</Text>
                                      )}
                                    </View>
                                    {isGenerating || isGrading ? null : isGraded ? (
                                      <View style={styles.quizActions}>
                                        {quiz.score !== undefined && (
                                          <View style={[styles.quizScorePill, { backgroundColor: quiz.score >= 80 ? '#D1FAE5' : '#FEF3C7' }]}>
                                            <Text style={[styles.quizScoreText, { color: quiz.score >= 80 ? '#059669' : '#d97706' }]}>{quiz.score}%</Text>
                                          </View>
                                        )}
                                        {quiz.score === undefined && (
                                          <View style={[styles.quizScorePill, { backgroundColor: '#EDE9FE' }]}>
                                            <Text style={[styles.quizScoreText, { color: '#7c3aed' }]}>Awaiting AI</Text>
                                          </View>
                                        )}
                                        {(quiz.scoreHistory?.length || 0) > 0 && (
                                          <TouchableOpacity style={[styles.quizTakeBtn, { backgroundColor: `${classAccent}15` }]} onPress={() => openLatestQuizAttempt(quiz, subUnit.id)}>
                                            <Text style={[styles.quizTakeBtnText, { color: classAccent }]}>Review</Text>
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity style={styles.quizTakeBtn} onPress={() => startQuiz(subUnit.id, quiz)}>
                                          <Text style={styles.quizTakeBtnText}>Retake</Text>
                                        </TouchableOpacity>
                                        {(quiz.scoreHistory?.length || 0) > 1 && (
                                          <TouchableOpacity onPress={() => openScoreHistory(quiz, subUnit.id)} hitSlop={8} style={styles.quizIconAction}>
                                            <Ionicons name="stats-chart" size={15} color={classAccent} />
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={() => deleteQuiz(subUnit.id, quiz.id)} hitSlop={8} style={styles.quizIconAction}>
                                          <Ionicons name="trash-outline" size={15} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                      </View>
                                    ) : isReady ? (
                                      <View style={styles.quizActions}>
                                        <TouchableOpacity style={styles.quizTakeBtn} onPress={() => startQuiz(subUnit.id, quiz)}>
                                          <Text style={styles.quizTakeBtnText}>Take</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => openEditQuiz(quiz, subUnit.id)} hitSlop={8} style={styles.quizIconAction}>
                                          <Ionicons name="pencil" size={15} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => deleteQuiz(subUnit.id, quiz.id)} hitSlop={8} style={styles.quizIconAction}>
                                          <Ionicons name="trash-outline" size={15} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                      </View>
                                    ) : null}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </>
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


        </ScrollView>

        <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} highlightedTab={tutorialStep === 3 ? 'files' : undefined} />



        {/* Add / Edit Quiz Modal */}
        <Modal visible={showAddQuiz} transparent animationType="fade" onRequestClose={() => { setShowAddQuiz(false); setEditingQuizId(null); setEditingQuizSubUnitId(null); }}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.sosCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingQuizId ? '✏️ Edit Quiz' : '🧠 Generate Quiz'}</Text>
                <TouchableOpacity onPress={() => { setShowAddQuiz(false); setEditingQuizId(null); setEditingQuizSubUnitId(null); }}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.sosSubtitle}>
                {editingQuizId
                  ? 'Update the quiz details below.'
                  : 'AI will generate multiple-choice questions from your notes in this section.'}
              </Text>

              {editingQuizId ? (
                <>
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
                </>
              ) : (
                <>
                  <Text style={[styles.modalLabel, { marginTop: 14, marginBottom: 8 }]}>Number of Questions</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {['3', '5', '8', '10'].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.quizCountChip,
                          quizQuestionCount === n && { backgroundColor: classAccent, borderColor: classAccent },
                        ]}
                        onPress={() => setQuizQuestionCount(n)}
                      >
                        <Text style={[styles.quizCountChipText, quizQuestionCount === n && { color: 'white' }]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: classAccent, marginTop: 16 }]}
                onPress={editingQuizId ? saveQuizEdit : addQuiz}
              >
                <Ionicons name={editingQuizId ? 'checkmark' : 'sparkles'} size={16} color="white" />
                <Text style={styles.modalSaveBtnText}>  {editingQuizId ? 'Save Changes' : 'Generate with AI'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Quiz-Taking Modal */}
        <Modal visible={!!activeQuiz} transparent animationType="slide" onRequestClose={closeQuizModal}>
          <View style={styles.quizModalBackdrop}>
            <View style={styles.quizModalCard}>
              {activeQuiz?.questionData && (() => {
                const questions = activeQuiz.questionData!;
                const currentQuestion = questions[quizCurrentQ];
                const totalQ = questions.length;
                const isLast = quizCurrentQ === totalQ - 1;
                const allAnswered = quizAnswers.every((a) => a !== null);

                if (quizSubmitted && quizScore !== null) {
                  // Results view
                  const correct = questions.filter((q, i) => quizAnswers[i] === q.correctIndex).length;
                  return (
                    <View style={{ flex: 1 }}>
                      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Score Header */}
                        <View style={styles.quizResultHeader}>
                          <TouchableOpacity
                            style={styles.quizResultCloseBtn}
                            onPress={closeQuizModal}
                            accessibilityRole="button"
                            accessibilityLabel="Close quiz review"
                          >
                            <Ionicons name="close" size={20} color={colors.textPrimary} />
                          </TouchableOpacity>
                          <Text style={styles.quizResultScore}>{quizScore}%</Text>
                          <Text style={styles.quizResultSub}>{correct}/{totalQ} correct</Text>
                          <Text style={[styles.quizResultLabel, { color: quizScore >= 70 ? '#059669' : '#d97706' }]}>
                            {quizScore >= 90 ? 'Outstanding!' : quizScore >= 70 ? 'Great job!' : quizScore >= 50 ? 'Good effort!' : 'Keep studying!'}
                          </Text>
                        </View>

                        {/* AI Study Advice */}
                        <View style={[styles.quizAdviceCard, { borderColor: `${classAccent}30` }]}>
                          <View style={styles.quizAdviceHeader}>
                            <Ionicons name="sparkles" size={15} color={classAccent} />
                            <Text style={[styles.quizAdviceTitle, { color: classAccent }]}>Study Tip</Text>
                          </View>
                          {quizAdviceLoading ? (
                            <View style={styles.quizAdviceLoadingRow}>
                              <ActivityIndicator size="small" color={classAccent} />
                              <Text style={styles.quizAdviceLoadingText}>Analyzing your results...</Text>
                            </View>
                          ) : (
                            <Text style={styles.quizAdviceText}>{quizAdvice || 'Review the concepts you missed and try again!'}</Text>
                          )}
                        </View>

                        {/* Section Label */}
                        <View style={styles.quizResultSectionRow}>
                          <Ionicons name="list" size={16} color={colors.textSecondary} />
                          <Text style={styles.quizResultSectionLabel}>Review Answers</Text>
                        </View>

                        {/* Review each question */}
                        {questions.map((q, qi) => {
                          const userAnswer = quizAnswers[qi];
                          const isCorrect = userAnswer === q.correctIndex;
                          const explanationKey = `${activeQuiz.id}-${qi}-${userAnswer ?? 'none'}`;
                          const explanation = answerExplanations[explanationKey];
                          const explanationLoading = explanationLoadingKey === explanationKey;
                          return (
                            <View key={qi} style={[styles.quizReviewCard, { borderColor: isCorrect ? '#D1FAE5' : '#FEE2E2' }]}>
                              <View style={[styles.quizReviewAccent, { backgroundColor: isCorrect ? '#059669' : '#dc2626' }]} />
                              <View style={styles.quizReviewContent}>
                                <View style={styles.quizReviewHeader}>
                                  <View style={[styles.quizReviewBadge, { backgroundColor: isCorrect ? '#D1FAE5' : '#FEE2E2' }]}>
                                    <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={16} color={isCorrect ? '#059669' : '#dc2626'} />
                                    <Text style={[styles.quizReviewBadgeText, { color: isCorrect ? '#059669' : '#dc2626' }]}>
                                      {isCorrect ? 'Correct' : 'Incorrect'}
                                    </Text>
                                  </View>
                                  <Text style={styles.quizReviewQNum}>Question {qi + 1}</Text>
                                </View>
                                <Text style={styles.quizReviewQ}>{q.question}</Text>
                                <View style={styles.quizReviewOptsContainer}>
                                  {q.options.map((opt, oi) => {
                                    const isUserPick = userAnswer === oi;
                                    const isCorrectOpt = q.correctIndex === oi;
                                    const isNeutral = !isUserPick && !isCorrectOpt;
                                    return (
                                      <View key={oi} style={[
                                        styles.quizReviewOpt,
                                        isCorrectOpt && { backgroundColor: '#ECFDF5', borderColor: '#059669' },
                                        isUserPick && !isCorrectOpt && { backgroundColor: '#FEF2F2', borderColor: '#dc2626' },
                                        isNeutral && { opacity: 0.6 },
                                      ]}>
                                        <View style={[
                                          styles.quizReviewLetterCircle,
                                          isCorrectOpt && { backgroundColor: '#059669' },
                                          isUserPick && !isCorrectOpt && { backgroundColor: '#dc2626' },
                                        ]}>
                                          <Text style={[
                                            styles.quizReviewOptLetter,
                                            (isCorrectOpt || (isUserPick && !isCorrectOpt)) && { color: 'white' },
                                          ]}>
                                            {['A', 'B', 'C', 'D'][oi]}
                                          </Text>
                                        </View>
                                        <Text style={[
                                          styles.quizReviewOptText,
                                          isCorrectOpt && { color: '#065F46', fontFamily: fonts.semiBold },
                                          isUserPick && !isCorrectOpt && { color: '#991B1B' },
                                        ]}>
                                          {opt}
                                        </Text>
                                        {isCorrectOpt && <Ionicons name="checkmark-circle" size={16} color="#059669" />}
                                        {isUserPick && !isCorrectOpt && <Ionicons name="close-circle" size={16} color="#dc2626" />}
                                        {isUserPick && isCorrectOpt && (
                                          <View style={styles.quizReviewYourAnswer}>
                                            <Text style={styles.quizReviewYourAnswerText}>Your answer</Text>
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                                {explanation ? (
                                  <View style={[styles.quizExplanationBox, { backgroundColor: `${classAccent}08`, borderColor: `${classAccent}25` }]}>
                                    <Ionicons name="sparkles" size={15} color={classAccent} />
                                    <Text style={[styles.quizExplanationText, { color: classAccent }]}>{explanation}</Text>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={[styles.quizExplainBtn, { backgroundColor: `${classAccent}10`, borderColor: `${classAccent}30` }]}
                                    onPress={() => explainQuizQuestion(q, userAnswer, explanationKey)}
                                    disabled={!!explanationLoadingKey}
                                  >
                                    {explanationLoading ? (
                                      <ActivityIndicator size="small" color={classAccent} />
                                    ) : (
                                      <Ionicons name="sparkles-outline" size={14} color={classAccent} />
                                    )}
                                    <Text style={[styles.quizExplainBtnText, { color: classAccent }]}>
                                      {explanationLoading ? 'Explaining...' : 'Explain answer'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </ScrollView>

                      {/* Sticky Bottom Action Bar */}
                      <View style={styles.quizResultActionBar}>
                        <TouchableOpacity style={styles.quizResultDoneBtn} onPress={closeQuizModal}>
                          <Ionicons name="checkmark" size={18} color={colors.textPrimary} />
                          <Text style={styles.quizResultDoneBtnText}>Done</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.quizResultRetakeBtn, { backgroundColor: classAccent }]} onPress={retakeQuiz}>
                          <Ionicons name="refresh" size={18} color="white" />
                          <Text style={styles.quizResultRetakeBtnText}>Retake Quiz</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                // Question view
                return (
                  <>
                    <View style={styles.quizTopBar}>
                      <TouchableOpacity onPress={closeQuizModal}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <Text style={styles.quizTopTitle}>{activeQuiz.title}</Text>
                      <Text style={styles.quizTopProgress}>{quizCurrentQ + 1}/{totalQ}</Text>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.quizProgressBar}>
                      <View style={[styles.quizProgressFill, { width: `${((quizCurrentQ + 1) / totalQ) * 100}%`, backgroundColor: classAccent }]} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                      <Text style={styles.quizQuestionText}>{currentQuestion.question}</Text>

                      <View style={styles.quizOptionsContainer}>
                        {currentQuestion.options.map((option, oi) => {
                          const isSelected = quizAnswers[quizCurrentQ] === oi;
                          const isEliminated = (quizEliminated[quizCurrentQ] || []).includes(oi);
                          return (
                            <TouchableOpacity
                              key={oi}
                              style={[
                                styles.quizOptionBtn,
                                isSelected && { backgroundColor: `${classAccent}15`, borderColor: classAccent, borderWidth: 2 },
                                isEliminated && styles.quizOptionEliminated,
                              ]}
                              onPress={() => selectQuizAnswer(quizCurrentQ, oi)}
                            >
                              <View style={[styles.quizOptionLetter, isSelected && { backgroundColor: classAccent }, isEliminated && styles.quizOptionLetterEliminated]}>
                                <Text style={[styles.quizOptionLetterText, isSelected && { color: 'white' }, isEliminated && styles.quizOptionTextEliminated]}>
                                  {['A', 'B', 'C', 'D'][oi]}
                                </Text>
                              </View>
                              <Text style={[styles.quizOptionText, isSelected && { color: classAccent, fontFamily: fonts.semiBold }, isEliminated && styles.quizOptionTextEliminated]}>
                                {option}
                              </Text>
                              <TouchableOpacity
                                style={[styles.quizEliminateBtn, isEliminated && styles.quizEliminateBtnActive]}
                                onPress={() => toggleEliminatedAnswer(quizCurrentQ, oi)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={isEliminated ? `Restore answer ${['A', 'B', 'C', 'D'][oi]}` : `Cross out answer ${['A', 'B', 'C', 'D'][oi]}`}
                              >
                                <Ionicons
                                  name={isEliminated ? 'close-circle' : 'close-circle-outline'}
                                  size={18}
                                  color={isEliminated ? '#B45309' : colors.textTertiary}
                                />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Hint button */}
                      {(() => {
                        const hintText = currentQuestion.hint || dynamicHints[quizCurrentQ];
                        const isRevealed = quizHintsShown.has(quizCurrentQ);
                        if (isRevealed && hintText) {
                          return (
                            <View style={{
                              marginTop: 12, padding: 14, borderRadius: 14,
                              backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74',
                              flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                            }}>
                              <Ionicons name="bulb" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
                              <Text style={{ flex: 1, fontSize: 13, fontFamily: fonts.regular, color: '#92400E', lineHeight: 19 }}>
                                {hintText}
                              </Text>
                            </View>
                          );
                        }
                        return (
                          <TouchableOpacity
                            style={{
                              marginTop: 12, alignSelf: 'center',
                              flexDirection: 'row', alignItems: 'center', gap: 6,
                              paddingVertical: 8, paddingHorizontal: 16,
                              borderRadius: 20, backgroundColor: '#FFF7ED',
                              borderWidth: 1, borderColor: '#FDE68A',
                              opacity: hintLoading ? 0.6 : 1,
                            }}
                            disabled={hintLoading}
                            onPress={async () => {
                              if (currentQuestion.hint) {
                                // Pre-generated hint exists, just reveal
                                setQuizHintsShown(prev => { const n = new Set(prev); n.add(quizCurrentQ); return n; });
                              } else {
                                // Generate hint on-the-fly
                                setHintLoading(true);
                                const hint = await generateQuizHint(currentQuestion.question, [...currentQuestion.options]);
                                setDynamicHints(prev => ({ ...prev, [quizCurrentQ]: hint }));
                                setQuizHintsShown(prev => { const n = new Set(prev); n.add(quizCurrentQ); return n; });
                                setHintLoading(false);
                              }
                            }}
                          >
                            <Ionicons name={hintLoading ? 'hourglass-outline' : 'bulb-outline'} size={16} color="#F59E0B" />
                            <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: '#B45309' }}>
                              {hintLoading ? 'Generating hint…' : 'Need a hint?'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </ScrollView>

                    <View style={styles.quizNavRow}>
                      {quizCurrentQ > 0 && (
                        <TouchableOpacity style={[styles.quizNavBtn, { backgroundColor: '#F0E0D0' }]} onPress={() => setQuizCurrentQ((q) => q - 1)}>
                          <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                          <Text style={[styles.quizNavBtnText, { color: colors.textPrimary }]}>Back</Text>
                        </TouchableOpacity>
                      )}
                      <View style={{ flex: 1 }} />
                      {isLast ? (
                        <TouchableOpacity
                          style={[styles.quizNavBtn, { backgroundColor: allAnswered ? classAccent : '#D8C8B8' }]}
                          onPress={submitQuiz}
                          disabled={!allAnswered}
                        >
                          <Ionicons name="checkmark-circle" size={16} color="white" />
                          <Text style={styles.quizNavBtnText}>Submit</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.quizNavBtn, { backgroundColor: quizAnswers[quizCurrentQ] !== null ? classAccent : '#D8C8B8' }]}
                          onPress={() => setQuizCurrentQ((q) => q + 1)}
                          disabled={quizAnswers[quizCurrentQ] === null}
                        >
                          <Text style={styles.quizNavBtnText}>Next</Text>
                          <Ionicons name="arrow-forward" size={16} color="white" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>

        {/* Score History Modal */}
        <Modal visible={!!scoreHistoryQuiz} transparent animationType="slide" onRequestClose={() => { setScoreHistoryQuiz(null); setScoreHistorySubUnitId(null); }}>
          <View style={styles.viewerBackdrop}>
            <View style={styles.viewerCard}>
              <View style={styles.viewerHeader}>
                <View style={styles.viewerHeaderLeft}>
                  <View style={[styles.viewerBadge, { backgroundColor: classAccent }]}>
                    <Ionicons name="stats-chart" size={14} color="white" />
                  </View>
                  <Text style={styles.viewerLabel}>Quiz Scores</Text>
                </View>
                <TouchableOpacity onPress={() => { setScoreHistoryQuiz(null); setScoreHistorySubUnitId(null); }} style={styles.viewerCloseBtn}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {scoreHistoryQuiz && (
                <>
                  <Text style={styles.viewerTitle}>{scoreHistoryQuiz.title}</Text>
                  <View style={styles.viewerMetaRow}>
                    <Ionicons name="school" size={12} color={colors.textTertiary} />
                    <Text style={styles.viewerMeta}>
                      {scoreHistoryQuiz.questions} questions • {(scoreHistoryQuiz.scoreHistory || []).length} total attempt{(scoreHistoryQuiz.scoreHistory || []).length !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  <ScrollView style={styles.viewerScroll} showsVerticalScrollIndicator={false}>
                    {(() => {
                      const history = scoreHistoryQuiz.scoreHistory || [];
                      // Group by userId
                      const grouped = new Map<string, QuizAttempt[]>();
                      for (const attempt of history) {
                        const key = attempt.userId;
                        if (!grouped.has(key)) grouped.set(key, []);
                        grouped.get(key)!.push(attempt);
                      }
                      // Sort by best score descending
                      const entries = Array.from(grouped.entries()).sort((a, b) => {
                        const bestA = Math.max(...a[1].map((x) => x.score));
                        const bestB = Math.max(...b[1].map((x) => x.score));
                        return bestB - bestA;
                      });

                      if (entries.length === 0) {
                        return (
                          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                            <Ionicons name="school-outline" size={32} color={colors.textTertiary} />
                            <Text style={{ fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 8 }}>No attempts yet</Text>
                          </View>
                        );
                      }

                      return entries.map(([userId, attempts], groupIdx) => {
                        const best = Math.max(...attempts.map((a) => a.score));
                        const personName = attempts[0].userName;
                        return (
                          <View key={userId} style={{ marginBottom: groupIdx < entries.length - 1 ? 16 : 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <View style={{
                                width: 28, height: 28, borderRadius: 14,
                                backgroundColor: `${classAccent}20`, alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Ionicons name="person" size={14} color={classAccent} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: fonts.semiBold, fontSize: 14, color: colors.textPrimary }}>{personName}</Text>
                                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>
                                  {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} • Best: {best}%
                                </Text>
                              </View>
                              <View style={[styles.quizScorePill, { backgroundColor: best >= 80 ? '#D1FAE5' : best >= 50 ? '#FEF3C7' : '#FEE2E2' }]}>
                                <Text style={[styles.quizScoreText, { color: best >= 80 ? '#059669' : best >= 50 ? '#d97706' : '#dc2626' }]}>{best}%</Text>
                              </View>
                            </View>
                            {attempts.map((attempt, ai) => {
                              const prev = ai > 0 ? attempts[ai - 1].score : null;
                              const diff = prev !== null ? attempt.score - prev : 0;
                              return (
                                <TouchableOpacity key={ai} style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 8,
                                  paddingLeft: 36, paddingVertical: 4,
                                }} onPress={() => scoreHistoryQuiz && openQuizAttemptReview(scoreHistoryQuiz, attempt, scoreHistorySubUnitId)}>
                                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, width: 60 }}>
                                    #{ai + 1} • {attempt.date}
                                  </Text>
                                  <View style={{
                                    flex: 1, height: 6, borderRadius: 3,
                                    backgroundColor: '#F0E0D0',
                                  }}>
                                    <View style={{
                                      width: `${attempt.score}%`, height: 6, borderRadius: 3,
                                      backgroundColor: attempt.score >= 80 ? '#059669' : attempt.score >= 50 ? '#d97706' : '#dc2626',
                                    }} />
                                  </View>
                                  <Text style={{
                                    fontFamily: fonts.semiBold, fontSize: 12, width: 36, textAlign: 'right',
                                    color: attempt.score >= 80 ? '#059669' : attempt.score >= 50 ? '#d97706' : '#dc2626',
                                  }}>{attempt.score}%</Text>
                                  {diff > 0 && <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#059669' }}>↑{diff}</Text>}
                                  {diff < 0 && <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#dc2626' }}>↓{Math.abs(diff)}</Text>}
                                  {diff === 0 && ai > 0 && <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textTertiary }}>—</Text>}
                                </TouchableOpacity>
                              );
                            })}
                            {groupIdx < entries.length - 1 && (
                              <View style={{ height: 1, backgroundColor: '#F0E0D0', marginTop: 12 }} />
                            )}
                          </View>
                        );
                      });
                    })()}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showAddNoteModal} transparent animationType="fade" onRequestClose={() => setShowAddNoteModal(false)}>
          <View style={styles.modalBackdropCentered}>
            <View style={styles.noteModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Note</Text>
                <TouchableOpacity onPress={() => { setShowAddNoteModal(false); setScannedNotePages([]); }}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Step indicators */}
              <View style={styles.wizardSteps}>
                {(scannedNotePages.length > 0 ? [
                  { num: 1, label: 'Source' },
                  { num: 2, label: 'Pages' },
                ] : [
                  { num: 1, label: 'Source' },
                  { num: 3, label: 'Details' },
                ]).map((stepInfo, idx, arr) => (
                  <View key={stepInfo.num} style={styles.wizardStepRow}>
                    <View style={[
                      styles.wizardStepDot,
                      noteStep >= stepInfo.num && { backgroundColor: classAccent, borderColor: classAccent },
                    ]}>
                      {noteStep > stepInfo.num ? (
                        <Ionicons name="checkmark" size={12} color="white" />
                      ) : (
                        <Text style={[styles.wizardStepNum, noteStep >= stepInfo.num && { color: 'white' }]}>{idx + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.wizardStepLabel, noteStep >= stepInfo.num && { color: classAccent }]}>
                      {stepInfo.label}
                    </Text>
                    {idx < arr.length - 1 && <View style={[styles.wizardStepLine, noteStep > stepInfo.num && { backgroundColor: classAccent }]} />}
                  </View>
                ))}
              </View>

              {/* Step 1: Choose Source */}
              {noteStep === 1 && (
                <View>
                  <Text style={styles.wizardStepTitle}>How do you want to add your note?</Text>

                  <TouchableOpacity
                    style={[styles.sourceActionCard, { borderColor: `${classAccent}40` }]}
                    onPress={scanNoteWithCamera}
                  >
                    <View style={[styles.sourceActionIcon, { backgroundColor: `${classAccent}12` }]}>
                      <Ionicons name="camera" size={20} color={classAccent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sourceActionTitle}>Scan with Camera</Text>
                      <Text style={styles.sourceActionSub}>Capture one or more pages of notes</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sourceActionCard, { borderColor: `${classAccent}40` }]}
                    onPress={scanNoteFromLibrary}
                  >
                    <View style={[styles.sourceActionIcon, { backgroundColor: `${classAccent}12` }]}>
                      <Ionicons name="images" size={20} color={classAccent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sourceActionTitle}>Scan from Photos</Text>
                      <Text style={styles.sourceActionSub}>Pick note images from your gallery</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sourceActionCard, { borderColor: `${classAccent}40` }]}
                    onPress={async () => {
                      await pickNoteFromPhone();
                      setNoteStep(3);
                    }}
                  >
                    <View style={[styles.sourceActionIcon, { backgroundColor: `${classAccent}12` }]}>
                      <Ionicons name="folder-open" size={20} color={classAccent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sourceActionTitle}>Upload from Phone</Text>
                      <Text style={styles.sourceActionSub}>Pick a PDF, image, or text file</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sourceActionCard, { borderColor: `${classAccent}40` }]}
                    onPress={() => setNoteStep(3)}
                  >
                    <View style={[styles.sourceActionIcon, { backgroundColor: `${classAccent}12` }]}>
                      <Ionicons name="create" size={20} color={classAccent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sourceActionTitle}>Write Manually</Text>
                      <Text style={styles.sourceActionSub}>Type your own note content</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: Multi-Page Staging */}
              {noteStep === 2 && scannedNotePages.length > 0 && (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={styles.wizardStepTitle}>
                      {scannedNotePages.length} Page{scannedNotePages.length > 1 ? 's' : ''} Scanned
                    </Text>
                    <TouchableOpacity onPress={() => { setScannedNotePages([]); setNoteStep(1); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: colors.textTertiary }}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 12 }}>
                    Add more pages or tap "Analyze" when ready. AI will combine all pages into one note.
                  </Text>

                  {/* Page thumbnails */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                    {scannedNotePages.map((page, idx) => (
                      <View key={idx} style={{ position: 'relative' }}>
                        <Image source={{ uri: page.uri }} style={{ width: 80, height: 110, borderRadius: 10, backgroundColor: '#F3F4F6' }} />
                        <TouchableOpacity
                          onPress={() => removeNotePage(idx)}
                          style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 22, height: 22, borderRadius: 11,
                            backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: 'white',
                          }}
                        >
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                        <View style={{
                          position: 'absolute', bottom: 4, left: 4,
                          backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6,
                          paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: 'white' }}>P{idx + 1}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Add more pages buttons */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
                      }}
                      onPress={addNotePageFromCamera}
                    >
                      <Ionicons name="camera-outline" size={18} color={classAccent} />
                      <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary }}>Add Page</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
                      }}
                      onPress={addNotePageFromLibrary}
                    >
                      <Ionicons name="images-outline" size={18} color={classAccent} />
                      <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary }}>From Gallery</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity
                      style={[styles.wizardBackBtn, { borderColor: `${classAccent}40` }]}
                      onPress={() => { setScannedNotePages([]); setNoteStep(1); }}
                    >
                      <Text style={[styles.wizardBackBtnText, { color: classAccent }]}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1, backgroundColor: classAccent, borderRadius: 14,
                        paddingVertical: 14, alignItems: 'center', flexDirection: 'row',
                        justifyContent: 'center', gap: 8,
                      }}
                      onPress={finalizeNotePages}
                    >
                      <Ionicons name="sparkles" size={18} color="white" />
                      <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: 'white' }}>
                        Analyze {scannedNotePages.length} Page{scannedNotePages.length > 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 3: Details + Save (for manual / upload notes) */}
              {noteStep === 3 && (
                <View>
                  <Text style={styles.wizardStepTitle}>Note details</Text>

                  {localUpload && (
                    <View style={styles.uploadedFileBanner}>
                      <Ionicons name="document-attach" size={14} color={classAccent} />
                      <Text style={[styles.uploadedFileText, { color: classAccent }]} numberOfLines={1}>
                        {localUpload.name} ({localUpload.pages} page{localUpload.pages > 1 ? 's' : ''})
                      </Text>
                    </View>
                  )}

                  <Text style={styles.modalLabel}>Contributor Name</Text>
                  <TextInput style={styles.modalInput} value={newNoteAuthor} onChangeText={setNewNoteAuthor} placeholder="Your name" placeholderTextColor="#999999" />
                  <Text style={styles.modalLabel}>Note Title</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newNoteTitle}
                    onChangeText={setNewNoteTitle}
                    placeholder="Give this note a title"
                    placeholderTextColor="#999999"
                  />
                  <Text style={styles.modalLabel}>Content / Context</Text>
                  <TextInput
                    style={styles.modalInputMultiline}
                    value={newNoteContent}
                    onChangeText={setNewNoteContent}
                    placeholder="Add note content, highlights, or context"
                    placeholderTextColor="#999999"
                    multiline
                  />

                  <View style={styles.wizardNavRow}>
                    <TouchableOpacity
                      style={[styles.wizardBackBtn, { borderColor: `${classAccent}40` }]}
                      onPress={() => { setNoteStep(1); setLocalUpload(null); }}
                    >
                      <Text style={[styles.wizardBackBtnText, { color: classAccent }]}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSaveBtn, { backgroundColor: classAccent, flex: 1 }]}
                      onPress={saveSectionNote}
                    >
                      <Text style={styles.modalSaveBtnText}>Add to Section ✓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
                style={[styles.modalSaveBtn, { backgroundColor: classAccent }, (selectedMergeNoteIds.length < 2 || isMerging) && styles.modalSaveBtnDisabled]}
                onPress={mergeSelectedNotes}
                disabled={selectedMergeNoteIds.length < 2 || isMerging}
              >
                {isMerging ? (
                  <View style={styles.mergingRow}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.modalSaveBtnText}>  AI Merging…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalSaveBtnText}>✨ Merge with AI</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Merged Note Viewer */}
        <Modal visible={showMergedViewer} transparent animationType="slide" onRequestClose={() => setShowMergedViewer(false)}>
          <View style={styles.viewerBackdrop}>
            <View style={styles.viewerCard}>
              <View style={styles.viewerHeader}>
                <View style={styles.viewerHeaderLeft}>
                  <View style={[styles.viewerBadge, { backgroundColor: classAccent }]}>
                    <Ionicons name="sparkles" size={14} color="white" />
                  </View>
                  <Text style={styles.viewerLabel}>AI Merged Note</Text>
                </View>
                <TouchableOpacity onPress={() => setShowMergedViewer(false)} style={styles.viewerCloseBtn}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {mergedResult && (
                <>
                  <Text style={styles.viewerTitle}>{mergedResult.title}</Text>
                  <View style={styles.viewerMetaRow}>
                    <Ionicons name="document-text" size={12} color={colors.textTertiary} />
                    <Text style={styles.viewerMeta}>
                      {mergedResult.content.trim().split(/\s+/).length} words • {classData.title}
                    </Text>
                  </View>

                  <ScrollView style={styles.viewerScroll} showsVerticalScrollIndicator={false}>
                    <FormattedText accentColor={classAccent}>{mergedResult.content}</FormattedText>
                  </ScrollView>

                  {noteActionStatus.length > 0 && <Text style={styles.noteActionStatus}>{noteActionStatus}</Text>}

                  <View style={styles.viewerActions}>
                    <TouchableOpacity
                      style={[styles.noteActionBtn, { borderColor: `${classAccent}35`, backgroundColor: `${classAccent}10` }]}
                      onPress={downloadMergedToDevice}
                    >
                      <Ionicons name="download-outline" size={14} color={classAccent} />
                      <Text style={[styles.noteActionText, { color: classAccent }]}>Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.noteActionBtn, { borderColor: `${classAccent}35`, backgroundColor: `${classAccent}10` }]}
                      onPress={shareMergedNote}
                    >
                      <Ionicons name="share-social-outline" size={14} color={classAccent} />
                      <Text style={[styles.noteActionText, { color: classAccent }]}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={!!activeNote} transparent animationType="slide" onRequestClose={() => { setActiveNote(null); setIsEditingNote(false); }}>
          <View style={styles.viewerBackdrop}>
            <View style={styles.viewerCard}>
              <View style={styles.viewerHeader}>
                <View style={styles.viewerHeaderLeft}>
                  <View style={[styles.viewerBadge, { backgroundColor: classAccent }]}>
                    <Ionicons name="document-text" size={14} color="white" />
                  </View>
                  <Text style={styles.viewerLabel}>{isEditingNote ? 'Edit Note' : 'Note'}</Text>
                </View>
                <TouchableOpacity onPress={() => { setActiveNote(null); setIsEditingNote(false); }} style={styles.viewerCloseBtn}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {activeNote && (
                <>
                  {isEditingNote ? (
                    <>
                      <Text style={styles.modalLabel}>Title</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editNoteTitle}
                        onChangeText={setEditNoteTitle}
                        placeholder="Note title"
                        placeholderTextColor="#999999"
                      />
                      <Text style={[styles.modalLabel, { marginTop: 8 }]}>Content</Text>
                      <TextInput
                        style={[styles.modalInputMultiline, { minHeight: 200 }]}
                        value={editNoteContent}
                        onChangeText={setEditNoteContent}
                        placeholder="Note content"
                        placeholderTextColor="#999999"
                        multiline
                      />
                      <View style={[styles.noteActionsRow, { marginTop: 14 }]}>
                        <TouchableOpacity
                          style={[styles.noteActionBtn, { borderColor: '#E0D0C0' }]}
                          onPress={() => setIsEditingNote(false)}
                        >
                          <Text style={[styles.noteActionText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.noteActionBtn, { backgroundColor: classAccent, borderColor: classAccent }]}
                          onPress={saveEditNote}
                        >
                          <Ionicons name="checkmark" size={14} color="white" />
                          <Text style={[styles.noteActionText, { color: 'white' }]}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.viewerTitle}>{activeNote.note.title}</Text>
                      <View style={styles.viewerMetaRow}>
                        <Ionicons name="person" size={12} color={colors.textTertiary} />
                        <Text style={styles.viewerMeta}>
                          {activeNote.note.author} • {activeNote.sectionTitle} • {activeNote.note.date}
                        </Text>
                      </View>

                      <ScrollView style={styles.viewerScroll} showsVerticalScrollIndicator={false}>
                        <FormattedText accentColor={classAccent}>{activeNote.note.content}</FormattedText>
                      </ScrollView>

                      {noteActionStatus.length > 0 && <Text style={styles.noteActionStatus}>{noteActionStatus}</Text>}

                      <View style={styles.noteActionsRow}>
                        <TouchableOpacity
                          style={[styles.noteActionBtn, { borderColor: `${classAccent}35`, backgroundColor: `${classAccent}10` }]}
                          onPress={startEditNote}
                        >
                          <Ionicons name="pencil" size={14} color={classAccent} />
                          <Text style={[styles.noteActionText, { color: classAccent }]}>Edit</Text>
                        </TouchableOpacity>
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
                          style={[styles.noteActionBtn, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}
                          onPress={deleteNote}
                        >
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                          <Text style={[styles.noteActionText, { color: '#dc2626' }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Scanning OCR overlay */}
        {isScanningNote && (
          <View style={styles.scanOverlay}>
            <View style={styles.scanOverlayCard}>
              <ActivityIndicator size="large" color={classAccent} />
              <Text style={styles.scanOverlayTitle}>
                {scannedNotePages.length > 1
                  ? `Analyzing ${scannedNotePages.length} pages…`
                  : 'Reading your notes…'}
              </Text>
              <Text style={styles.scanOverlaySub}>
                {scannedNotePages.length > 1
                  ? 'AI is combining all pages into one note'
                  : 'AI is extracting text from your scan'}
              </Text>
            </View>
          </View>
        )}
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
            </View>
          </View>
        </View>

        {tutorialGuide && (
          <View style={styles.heroTutorialWrap}>
            <InlineTutorialCard
              step={tutorialGuide.step}
              totalSteps={TUTORIAL_TOTAL_STEPS}
              title={tutorialGuide.title}
              body={tutorialGuide.body}
              onDismiss={onTutorialSkip}
              onPrevious={onTutorialBack}
              onNext={onTutorialNext}
              nextLabel="Go to Files"
            />
          </View>
        )}

        <View style={[styles.sheet, tutorialGuide && styles.sheetWithTutorial]}>
          <Text style={styles.courseTitle}>{classData.title}</Text>
          <View style={styles.badgeRow}>
            <TouchableOpacity style={styles.badge} onPress={openBlockEditModal} activeOpacity={0.7}>
              <Text style={styles.badgeText}>{classData.block}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.codePill, { backgroundColor: `${classAccent}10` }]} onPress={openCodeEditModal} activeOpacity={0.7}>
              <Ionicons name="key" size={13} color={classAccent} />
              <Text style={[styles.codeText, { color: classAccent }]}>{classData.classCode}</Text>
            </TouchableOpacity>
            {!isNewClass && (
              <TouchableOpacity style={[styles.codePill, { backgroundColor: `${classAccent}10`, paddingHorizontal: 10 }]} onPress={() => setShowInviteModal(true)} activeOpacity={0.7}>
                <Ionicons name="person-add" size={13} color={classAccent} />
                <Text style={[styles.codeText, { color: classAccent }]}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isNewClass && (() => {
            const totalNotes = classData.units.reduce((a, u) => a + u.subUnits.reduce((b, s) => b + s.notes.length, 0), 0);
            const totalFiles = classData.files.length;
            const docCount = totalNotes + totalFiles;
            return (
              <View style={styles.stats}>
                <TouchableOpacity style={[styles.stat, styles.statPressable]} onPress={() => setShowClassmatesModal(true)} activeOpacity={0.8}>
                  <Ionicons name="people" size={16} color={classAccent} />
                  <Text style={styles.statText}>{classData.classmates} Classmates</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
                <View style={styles.stat}>
                  <Ionicons name="document-text" size={16} color={classAccent} />
                  <Text style={styles.statText}>{docCount} Documents</Text>
                </View>
              </View>
            );
          })()}

          {/* Teacher row */}
          {!isNewClass && (
            <View style={styles.teacherRow}>
              <Ionicons name="school-outline" size={16} color={classAccent} />
              {editingTeacher ? (
                <View style={styles.teacherEditRow}>
                  <TextInput
                    style={styles.teacherInput}
                    value={teacherDraft}
                    onChangeText={setTeacherDraft}
                    placeholder="Teacher name"
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.teacherSaveBtn, { backgroundColor: classAccent }]}
                    onPress={() => {
                      onUpdateClass({ ...classData, teacher: teacherDraft.trim() || undefined });
                      setEditingTeacher(false);
                    }}
                  >
                    <Ionicons name="checkmark" size={14} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingTeacher(false); setTeacherDraft(classData.teacher || ''); }}>
                    <Ionicons name="close" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.teacherDisplay} onPress={() => { setTeacherDraft(classData.teacher || ''); setEditingTeacher(true); }}>
                  <Text style={styles.teacherText}>
                    {classData.teacher ? classData.teacher : 'Add Teacher'}
                  </Text>
                  <Ionicons name="pencil" size={12} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {isAPClass && (
            <View style={styles.apPracticeSection}>
              <TouchableOpacity
                style={[styles.apPracticeCard, { borderColor: `${classAccent}33`, backgroundColor: `${classAccent}10` }]}
                onPress={() => setShowAPPracticeSetup(true)}
                activeOpacity={0.85}
                disabled={apPracticeLoading}
              >
                <View style={[styles.apPracticeIcon, { backgroundColor: classAccent }]}>
                  {apPracticeLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="ribbon" size={18} color="white" />
                  )}
                </View>
                <View style={styles.apPracticeText}>
                  <Text style={styles.apPracticeTitle}>
                    {apPracticeLoading ? 'Building AP practice...' : 'Practice for AP Test'}
                  </Text>
                  <Text style={styles.apPracticeBody}>
                    Comprehensive AI questions from the course topics, not class notes.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={classAccent} />
              </TouchableOpacity>

              {(classData.apPracticeTests || []).length > 0 && (
                <View style={styles.apPracticeHistory}>
                  {(classData.apPracticeTests || []).map((quiz) => {
                    const latestAttempt = quiz.scoreHistory?.[quiz.scoreHistory.length - 1];
                    const isGraded = quiz.status === 'graded' && latestAttempt;
                    return (
                      <TouchableOpacity
                        key={quiz.id}
                        style={styles.quizRow}
                        activeOpacity={isGraded ? 0.72 : 1}
                        onPress={() => isGraded ? openLatestQuizAttempt(quiz, null) : undefined}
                      >
                        <View style={styles.quizIconSlot}>
                          <Ionicons name="ribbon" size={14} color={classAccent} />
                        </View>
                        <View style={styles.quizBody}>
                          <View style={styles.quizTextBlock}>
                            <Text style={styles.quizTitle}>{quiz.title}</Text>
                            <Text style={styles.quizMeta}>
                              {quiz.questions} questions • {quiz.date}{latestAttempt ? ` • Last: ${latestAttempt.score}%` : ''}
                            </Text>
                          </View>
                          <View style={styles.quizActions}>
                            {quiz.score !== undefined && (
                              <View style={[styles.quizScorePill, { backgroundColor: quiz.score >= 80 ? '#D1FAE5' : quiz.score >= 50 ? '#FEF3C7' : '#FEE2E2' }]}>
                                <Text style={[styles.quizScoreText, { color: quiz.score >= 80 ? '#059669' : quiz.score >= 50 ? '#d97706' : '#dc2626' }]}>{quiz.score}%</Text>
                              </View>
                            )}
                            {(quiz.scoreHistory?.length || 0) > 0 && latestAttempt && (
                              <TouchableOpacity style={[styles.quizTakeBtn, { backgroundColor: `${classAccent}15` }]} onPress={() => openQuizAttemptReview(quiz, latestAttempt, null)}>
                                <Text style={[styles.quizTakeBtnText, { color: classAccent }]}>Review</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.quizTakeBtn} onPress={() => startQuiz(null, quiz)}>
                              <Text style={styles.quizTakeBtnText}>{quiz.scoreHistory?.length ? 'Retake' : 'Take'}</Text>
                            </TouchableOpacity>
                            {(quiz.scoreHistory?.length || 0) > 1 && (
                              <TouchableOpacity onPress={() => openScoreHistory(quiz, null)} hitSlop={8} style={styles.quizIconAction}>
                                <Ionicons name="stats-chart" size={15} color={classAccent} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => deleteAPPractice(quiz.id)} hitSlop={8} style={styles.quizIconAction}>
                              <Ionicons name="trash-outline" size={15} color={colors.textTertiary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
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
          ) : (() => {
            const totalNotes = classData.units.reduce((a, u) => a + u.subUnits.reduce((b, s) => b + s.notes.length, 0), 0);
            const totalSections = classData.units.reduce((a, u) => a + u.subUnits.length, 0);
            const completedSects = classData.units.reduce((a, u) =>
              a + u.subUnits.filter((s) => unitProgress[`${classData.id}-${u.id}-${s.id}`]).length, 0);
            const unitsWithNotes = classData.units.filter((u) => u.subUnits.some((s) => s.notes.length > 0)).length;
            const pct = totalSections > 0 ? Math.round((completedSects / totalSections) * 100) : 0;

            let msg = '';
            if (totalNotes === 0) {
              msg = `Getting started with ${classData.description}. Add your first notes to begin tracking progress.`;
            } else if (pct === 100) {
              msg = `All ${totalSections} sections complete across ${classData.units.length} units with ${totalNotes} notes. Great job mastering ${classData.description}!`;
            } else if (pct >= 60) {
              msg = `Strong progress — ${completedSects}/${totalSections} sections done (${pct}%). ${totalNotes} notes across ${unitsWithNotes} unit${unitsWithNotes !== 1 ? 's' : ''}. Keep pushing through ${classData.description}.`;
            } else {
              msg = `Building momentum — ${totalNotes} note${totalNotes !== 1 ? 's' : ''} across ${unitsWithNotes} unit${unitsWithNotes !== 1 ? 's' : ''}, ${completedSects}/${totalSections} sections marked complete. Focus on ${classData.description}.`;
            }

            return <Text style={styles.desc}>{msg}</Text>;
          })()}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>Path</Text>
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
                  (sub) => unitProgress[`${classData.id}-${unit.id}-${sub.id}`]
                ).length;
                const unitProg = sectionCount > 0 ? completedSections / sectionCount : 0;
                const isComplete = unitProg === 1;
                const isLast = idx === classData.units.length - 1;

                // Find "current" unit = first incomplete
                const isCurrentUnit = !isComplete && (idx === 0 || classData.units.slice(0, idx).every((u) => {
                  const c = u.subUnits.filter((s) => unitProgress[`${classData.id}-${u.id}-${s.id}`]).length;
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
                  <Text style={[styles.flightInfoTitle, { color: classAccent }]}>End of Course</Text>
                  <Text style={styles.flightInfoMeta}>You're done! Congrats.</Text>
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

      <BottomNav active="home" onHome={onBack} onScan={onScan} onFriends={onFriends} onFiles={onFilesOpen} highlightedTab={tutorialStep === 3 ? 'files' : undefined} />

      <Modal visible={showAPPracticeSetup} transparent animationType="fade" onRequestClose={() => setShowAPPracticeSetup(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.noteModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AP Practice Setup</Text>
              <TouchableOpacity onPress={() => setShowAPPracticeSetup(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.apSetupSub}>
              Build a comprehensive AP-style set from {apCourseFramework?.course || classData.title} units, separate from your class organization.
            </Text>

            <Text style={styles.modalLabel}>Number of Questions</Text>
            <View style={styles.apSetupChipGrid}>
              {AP_PRACTICE_COUNTS.map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[styles.filePickChip, apPracticeQuestionCount === count && styles.filePickChipActive]}
                  onPress={() => setAPPracticeQuestionCount(count)}
                >
                  <Text style={[styles.filePickChipText, apPracticeQuestionCount === count && styles.filePickChipTextActive]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Difficulty</Text>
            <View style={styles.apSetupChipGrid}>
              {AP_PRACTICE_DIFFICULTIES.map((difficulty) => (
                <TouchableOpacity
                  key={difficulty.value}
                  style={[styles.filePickChip, apPracticeDifficulty === difficulty.value && styles.filePickChipActive]}
                  onPress={() => setAPPracticeDifficulty(difficulty.value)}
                >
                  <Text style={[styles.filePickChipText, apPracticeDifficulty === difficulty.value && styles.filePickChipTextActive]}>
                    {difficulty.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Units to Include</Text>
            <ScrollView style={styles.apSetupUnits} showsVerticalScrollIndicator={false}>
              {apPracticeUnits.length > 0 ? apPracticeUnits.map((unit) => {
                const selected = apPracticeUnitIds.includes(unit.id);
                return (
                  <TouchableOpacity
                    key={unit.id}
                    style={[styles.apUnitRow, selected && { borderColor: classAccent, backgroundColor: `${classAccent}10` }]}
                    onPress={() => {
                      setAPPracticeUnitIds((prev) => {
                        if (prev.includes(unit.id)) {
                          return prev.length > 1 ? prev.filter((id) => id !== unit.id) : prev;
                        }
                        return [...prev, unit.id];
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.apUnitCheck, selected && { backgroundColor: classAccent, borderColor: classAccent }]}>
                      {selected && <Ionicons name="checkmark" size={13} color="white" />}
                    </View>
                    <View style={styles.apUnitText}>
                      <Text style={styles.apUnitTitle}>{unit.title}</Text>
                      <Text style={styles.apUnitMeta}>
                        {apCourseFramework?.course || 'AP course framework'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }) : (
                <Text style={styles.apSetupEmpty}>Citadel could not match this class to a known AP subject, so it will use the standard AP framework for the class title.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: classAccent }, apPracticeLoading && { opacity: 0.7 }]}
              onPress={startAPPractice}
              disabled={apPracticeLoading}
            >
              {apPracticeLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="sparkles" size={16} color="white" />
              )}
              <Text style={styles.modalSaveBtnText}>
                {apPracticeLoading ? 'Generating...' : 'Generate Practice'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quiz-Taking Modal */}
      <Modal visible={!!activeQuiz} transparent animationType="slide" onRequestClose={closeQuizModal}>
        <View style={styles.quizModalBackdrop}>
          <View style={styles.quizModalCard}>
            {activeQuiz?.questionData && (() => {
              const questions = activeQuiz.questionData!;
              const currentQuestion = questions[quizCurrentQ];
              const totalQ = questions.length;
              const isLast = quizCurrentQ === totalQ - 1;
              const allAnswered = quizAnswers.every((a) => a !== null);

              if (quizSubmitted && quizScore !== null) {
                const correct = questions.filter((q, i) => quizAnswers[i] === q.correctIndex).length;
                return (
                  <View style={{ flex: 1 }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                      {/* Score Header */}
                      <View style={styles.quizResultHeader}>
                        <TouchableOpacity
                          style={styles.quizResultCloseBtn}
                          onPress={closeQuizModal}
                          accessibilityRole="button"
                          accessibilityLabel="Close quiz review"
                        >
                          <Ionicons name="close" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.quizResultScore}>{quizScore}%</Text>
                        <Text style={styles.quizResultSub}>{correct}/{totalQ} correct</Text>
                        <Text style={[styles.quizResultLabel, { color: quizScore >= 70 ? '#059669' : '#d97706' }]}>
                          {quizScore >= 90 ? 'Outstanding!' : quizScore >= 70 ? 'Great job!' : quizScore >= 50 ? 'Good effort!' : 'Keep studying!'}
                        </Text>
                      </View>

                      {/* AI Study Advice */}
                      <View style={[styles.quizAdviceCard, { borderColor: `${classAccent}30` }]}>
                        <View style={styles.quizAdviceHeader}>
                          <Ionicons name="sparkles" size={15} color={classAccent} />
                          <Text style={[styles.quizAdviceTitle, { color: classAccent }]}>Study Tip</Text>
                        </View>
                        {quizAdviceLoading ? (
                          <View style={styles.quizAdviceLoadingRow}>
                            <ActivityIndicator size="small" color={classAccent} />
                            <Text style={styles.quizAdviceLoadingText}>Analyzing your results...</Text>
                          </View>
                        ) : (
                          <Text style={styles.quizAdviceText}>{quizAdvice || 'Review the concepts you missed and try again!'}</Text>
                        )}
                      </View>

                      {/* Section Label */}
                      <View style={styles.quizResultSectionRow}>
                        <Ionicons name="list" size={16} color={colors.textSecondary} />
                        <Text style={styles.quizResultSectionLabel}>Review Answers</Text>
                      </View>

                      {questions.map((q, qi) => {
                        const userAnswer = quizAnswers[qi];
                        const isCorrect = userAnswer === q.correctIndex;
                        const explanationKey = `${activeQuiz.id}-${qi}-${userAnswer ?? 'none'}`;
                        const explanation = answerExplanations[explanationKey];
                        const explanationLoading = explanationLoadingKey === explanationKey;
                        return (
                          <View key={qi} style={[styles.quizReviewCard, { borderColor: isCorrect ? '#D1FAE5' : '#FEE2E2' }]}>
                            <View style={[styles.quizReviewAccent, { backgroundColor: isCorrect ? '#059669' : '#dc2626' }]} />
                            <View style={styles.quizReviewContent}>
                              <View style={styles.quizReviewHeader}>
                                <View style={[styles.quizReviewBadge, { backgroundColor: isCorrect ? '#D1FAE5' : '#FEE2E2' }]}>
                                  <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={16} color={isCorrect ? '#059669' : '#dc2626'} />
                                  <Text style={[styles.quizReviewBadgeText, { color: isCorrect ? '#059669' : '#dc2626' }]}>
                                    {isCorrect ? 'Correct' : 'Incorrect'}
                                  </Text>
                                </View>
                                <Text style={styles.quizReviewQNum}>Question {qi + 1}</Text>
                              </View>
                              <Text style={styles.quizReviewQ}>{q.question}</Text>
                              <View style={styles.quizReviewOptsContainer}>
                                {q.options.map((opt, oi) => {
                                  const isUserPick = userAnswer === oi;
                                  const isCorrectOpt = q.correctIndex === oi;
                                  const isNeutral = !isUserPick && !isCorrectOpt;
                                  return (
                                    <View key={oi} style={[
                                      styles.quizReviewOpt,
                                      isCorrectOpt && { backgroundColor: '#ECFDF5', borderColor: '#059669' },
                                      isUserPick && !isCorrectOpt && { backgroundColor: '#FEF2F2', borderColor: '#dc2626' },
                                      isNeutral && { opacity: 0.6 },
                                    ]}>
                                      <View style={[
                                        styles.quizReviewLetterCircle,
                                        isCorrectOpt && { backgroundColor: '#059669' },
                                        isUserPick && !isCorrectOpt && { backgroundColor: '#dc2626' },
                                      ]}>
                                        <Text style={[
                                          styles.quizReviewOptLetter,
                                          (isCorrectOpt || (isUserPick && !isCorrectOpt)) && { color: 'white' },
                                        ]}>
                                          {['A', 'B', 'C', 'D'][oi]}
                                        </Text>
                                      </View>
                                      <Text style={[
                                        styles.quizReviewOptText,
                                        isCorrectOpt && { color: '#065F46', fontFamily: fonts.semiBold },
                                        isUserPick && !isCorrectOpt && { color: '#991B1B' },
                                      ]}>
                                        {opt}
                                      </Text>
                                      {isCorrectOpt && <Ionicons name="checkmark-circle" size={16} color="#059669" />}
                                      {isUserPick && !isCorrectOpt && <Ionicons name="close-circle" size={16} color="#dc2626" />}
                                      {isUserPick && isCorrectOpt && (
                                        <View style={styles.quizReviewYourAnswer}>
                                          <Text style={styles.quizReviewYourAnswerText}>Your answer</Text>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                              {explanation ? (
                                <View style={[styles.quizExplanationBox, { backgroundColor: `${classAccent}08`, borderColor: `${classAccent}25` }]}>
                                  <Ionicons name="sparkles" size={15} color={classAccent} />
                                  <Text style={[styles.quizExplanationText, { color: classAccent }]}>{explanation}</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.quizExplainBtn, { backgroundColor: `${classAccent}10`, borderColor: `${classAccent}30` }]}
                                  onPress={() => explainQuizQuestion(q, userAnswer, explanationKey)}
                                  disabled={!!explanationLoadingKey}
                                >
                                  {explanationLoading ? (
                                    <ActivityIndicator size="small" color={classAccent} />
                                  ) : (
                                    <Ionicons name="sparkles-outline" size={14} color={classAccent} />
                                  )}
                                  <Text style={[styles.quizExplainBtnText, { color: classAccent }]}>
                                    {explanationLoading ? 'Explaining...' : 'Explain answer'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>

                    {/* Sticky Bottom Action Bar */}
                    <View style={styles.quizResultActionBar}>
                      <TouchableOpacity style={styles.quizResultDoneBtn} onPress={closeQuizModal}>
                        <Ionicons name="checkmark" size={18} color={colors.textPrimary} />
                        <Text style={styles.quizResultDoneBtnText}>Done</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.quizResultRetakeBtn, { backgroundColor: classAccent }]} onPress={retakeQuiz}>
                        <Ionicons name="refresh" size={18} color="white" />
                        <Text style={styles.quizResultRetakeBtnText}>Retake Quiz</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              return (
                <>
                  <View style={styles.quizTopBar}>
                    <TouchableOpacity onPress={closeQuizModal}>
                      <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.quizTopTitle}>{activeQuiz.title}</Text>
                    <Text style={styles.quizTopProgress}>{quizCurrentQ + 1}/{totalQ}</Text>
                  </View>

                  <View style={styles.quizProgressBar}>
                    <View style={[styles.quizProgressFill, { width: `${((quizCurrentQ + 1) / totalQ) * 100}%`, backgroundColor: classAccent }]} />
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    <Text style={styles.quizQuestionText}>{currentQuestion.question}</Text>

                    <View style={styles.quizOptionsContainer}>
                      {currentQuestion.options.map((option, oi) => {
                        const isSelected = quizAnswers[quizCurrentQ] === oi;
                        const isEliminated = (quizEliminated[quizCurrentQ] || []).includes(oi);
                        return (
                          <TouchableOpacity
                            key={oi}
                            style={[
                              styles.quizOptionBtn,
                              isSelected && { backgroundColor: `${classAccent}15`, borderColor: classAccent, borderWidth: 2 },
                              isEliminated && styles.quizOptionEliminated,
                            ]}
                            onPress={() => selectQuizAnswer(quizCurrentQ, oi)}
                          >
                            <View style={[styles.quizOptionLetter, isSelected && { backgroundColor: classAccent }, isEliminated && styles.quizOptionLetterEliminated]}>
                              <Text style={[styles.quizOptionLetterText, isSelected && { color: 'white' }, isEliminated && styles.quizOptionTextEliminated]}>
                                {['A', 'B', 'C', 'D'][oi]}
                              </Text>
                            </View>
                            <Text style={[styles.quizOptionText, isSelected && { color: classAccent, fontFamily: fonts.semiBold }, isEliminated && styles.quizOptionTextEliminated]}>
                              {option}
                            </Text>
                            <TouchableOpacity
                              style={[styles.quizEliminateBtn, isEliminated && styles.quizEliminateBtnActive]}
                              onPress={() => toggleEliminatedAnswer(quizCurrentQ, oi)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={isEliminated ? `Restore answer ${['A', 'B', 'C', 'D'][oi]}` : `Cross out answer ${['A', 'B', 'C', 'D'][oi]}`}
                            >
                              <Ionicons
                                name={isEliminated ? 'close-circle' : 'close-circle-outline'}
                                size={18}
                                color={isEliminated ? '#B45309' : colors.textTertiary}
                              />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {(() => {
                      const hintText = currentQuestion.hint || dynamicHints[quizCurrentQ];
                      const isRevealed = quizHintsShown.has(quizCurrentQ);
                      if (isRevealed && hintText) {
                        return (
                          <View style={{
                            marginTop: 12, padding: 14, borderRadius: 14,
                            backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74',
                            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                          }}>
                            <Ionicons name="bulb" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
                            <Text style={{ flex: 1, fontSize: 13, fontFamily: fonts.regular, color: '#92400E', lineHeight: 19 }}>
                              {hintText}
                            </Text>
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          style={{
                            marginTop: 12, alignSelf: 'center',
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingVertical: 8, paddingHorizontal: 16,
                            borderRadius: 20, backgroundColor: '#FFF7ED',
                            borderWidth: 1, borderColor: '#FDE68A',
                            opacity: hintLoading ? 0.6 : 1,
                          }}
                          disabled={hintLoading}
                          onPress={async () => {
                            if (currentQuestion.hint) {
                              setQuizHintsShown(prev => { const n = new Set(prev); n.add(quizCurrentQ); return n; });
                            } else {
                              setHintLoading(true);
                              const hint = await generateQuizHint(currentQuestion.question, [...currentQuestion.options]);
                              setDynamicHints(prev => ({ ...prev, [quizCurrentQ]: hint }));
                              setQuizHintsShown(prev => { const n = new Set(prev); n.add(quizCurrentQ); return n; });
                              setHintLoading(false);
                            }
                          }}
                        >
                          <Ionicons name={hintLoading ? 'hourglass-outline' : 'bulb-outline'} size={16} color="#F59E0B" />
                          <Text style={{ fontSize: 13, fontFamily: fonts.medium, color: '#B45309' }}>
                            {hintLoading ? 'Generating hint…' : 'Need a hint?'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </ScrollView>

                  <View style={styles.quizNavRow}>
                    {quizCurrentQ > 0 && (
                      <TouchableOpacity style={[styles.quizNavBtn, { backgroundColor: '#F0E0D0' }]} onPress={() => setQuizCurrentQ((q) => q - 1)}>
                        <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                        <Text style={[styles.quizNavBtnText, { color: colors.textPrimary }]}>Back</Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }} />
                    {isLast ? (
                      <TouchableOpacity
                        style={[styles.quizNavBtn, { backgroundColor: allAnswered ? classAccent : '#D8C8B8' }]}
                        onPress={submitQuiz}
                        disabled={!allAnswered}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="white" />
                        <Text style={styles.quizNavBtnText}>Submit</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.quizNavBtn, { backgroundColor: quizAnswers[quizCurrentQ] !== null ? classAccent : '#D8C8B8' }]}
                        onPress={() => setQuizCurrentQ((q) => q + 1)}
                        disabled={quizAnswers[quizCurrentQ] === null}
                      >
                        <Text style={styles.quizNavBtnText}>Next</Text>
                        <Ionicons name="arrow-forward" size={16} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

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
            <View style={styles.colorGrid}>
              {themeColorChoices.map(({ hex, label }) => (
                <TouchableOpacity
                  key={hex}
                  style={[styles.colorSwatch, { backgroundColor: hex }, draftColor === hex && styles.colorSwatchActive]}
                  onPress={() => setDraftColor(hex)}
                >
                  {draftColor === hex && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </TouchableOpacity>
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

      <Modal visible={showBlockEditModal} transparent animationType="fade" onRequestClose={() => setShowBlockEditModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.noteModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Block</Text>
              <TouchableOpacity onPress={() => setShowBlockEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Select Block</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filePickRow}>
              {['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8'].map((block) => (
                <TouchableOpacity
                  key={block}
                  style={[styles.filePickChip, draftBlock === block && styles.filePickChipActive]}
                  onPress={() => setDraftBlock(block)}
                >
                  <Text style={[styles.filePickChipText, draftBlock === block && styles.filePickChipTextActive]}>{block}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: classAccent }]} onPress={saveBlockEdit}>
              <Text style={styles.modalSaveBtnText}>Save Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCodeEditModal} transparent animationType="fade" onRequestClose={() => setShowCodeEditModal(false)}>
        <View style={styles.modalBackdropCentered}>
          <View style={styles.noteModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Class Code</Text>
              <TouchableOpacity onPress={() => setShowCodeEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>New Code</Text>
            <TextInput
              style={styles.modalInput}
              value={draftCode}
              onChangeText={(text) => setDraftCode(text.toUpperCase())}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: classAccent }]} onPress={saveCodeEdit}>
              <Text style={styles.modalSaveBtnText}>Save Code</Text>
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
              <TouchableOpacity style={styles.inviteActionBtn} onPress={async () => {
                await Share.share({
                  message: `Join my class "${classData.title}" on Citadel! Use code: ${classData.classCode}`,
                });
              }}>
                <Ionicons name="share-outline" size={16} color={classAccent} />
                <Text style={[styles.inviteActionText, { color: classAccent }]}>Share</Text>
              </TouchableOpacity>
            </View>

            {friendsDirectory.length > 0 && (
              <View style={styles.friendsSection}>
                <Text style={styles.sosSectionLabel}>Or invite a friend:</Text>
                <ScrollView style={styles.friendsScroll} showsVerticalScrollIndicator={false}>
                  {friendsDirectory.map((friend) => {
                    const isSent = invitedFriends.includes(friend.id);
                    return (
                      <View key={friend.id} style={styles.friendRow}>
                        <View style={[styles.friendAvatar, { backgroundColor: friend.color + '20' }]}>
                          <Text style={[styles.friendInitial, { color: friend.color }]}>{friend.name.charAt(0)}</Text>
                        </View>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <TouchableOpacity
                          style={[styles.friendInviteBtn, isSent && styles.friendInviteBtnSent]}
                          onPress={() => {
                            if (!isSent) {
                              setInvitedFriends((prev) => [...prev, friend.id]);
                              if (onSendClassInvite) {
                                onSendClassInvite(friend.id, [classData]);
                              }
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.friendInviteText, isSent && styles.friendInviteTextSent]}>
                            {isSent ? 'Sent' : 'Invite'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
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

      {/* Scan-to-Unit Picker Modal */}
      <Modal visible={showScanUnitPicker && !!pendingScanNote} transparent animationType="slide" onRequestClose={() => { setShowScanUnitPicker(false); onClearPendingScanNote?.(); }}>
        <KeyboardAvoidingView style={scanToUnitStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={scanToUnitStyles.sheet}>
            <View style={scanToUnitStyles.handle} />
            <Text style={scanToUnitStyles.title}>Add Note to Unit</Text>
            <Text style={scanToUnitStyles.sub}>"{pendingScanNote?.title}" — choose where to save it</Text>

            {classData.units.length > 0 ? (
              <View>
                <Text style={scanToUnitStyles.label}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {classData.units.map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[scanToUnitStyles.chip, scanPickerUnitId === unit.id && scanToUnitStyles.chipActive]}
                      onPress={() => {
                        setScanPickerUnitId(unit.id);
                        setScanPickerSubUnitId(unit.subUnits[0]?.id || null);
                      }}
                    >
                      <Text style={[scanToUnitStyles.chipText, scanPickerUnitId === unit.id && scanToUnitStyles.chipTextActive]}>{unit.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {scanPickerUnitId && (() => {
                  const unit = classData.units.find(u => u.id === scanPickerUnitId);
                  if (!unit || unit.subUnits.length === 0) return null;
                  return (
                    <View style={{ marginTop: 14 }}>
                      <Text style={scanToUnitStyles.label}>Section</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {unit.subUnits.map((sub) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[scanToUnitStyles.chip, scanPickerSubUnitId === sub.id && scanToUnitStyles.chipActive]}
                            onPress={() => setScanPickerSubUnitId(sub.id)}
                          >
                            <Text style={[scanToUnitStyles.chipText, scanPickerSubUnitId === sub.id && scanToUnitStyles.chipTextActive]}>{sub.title}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })()}
              </View>
            ) : (
              <View>
                <Text style={scanToUnitStyles.label}>No units yet — create one</Text>
                <TextInput
                  style={scanToUnitStyles.input}
                  placeholder="Unit name (e.g. Unit 1: Basics)"
                  placeholderTextColor="#B8A090"
                  value={scanNewUnitTitle}
                  onChangeText={setScanNewUnitTitle}
                  autoFocus
                />
              </View>
            )}

            <View style={scanToUnitStyles.actions}>
              <TouchableOpacity style={scanToUnitStyles.cancelBtn} onPress={() => { setShowScanUnitPicker(false); onClearPendingScanNote?.(); }}>
                <Text style={scanToUnitStyles.cancelBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[scanToUnitStyles.confirmBtn, (!scanPickerSubUnitId && !scanNewUnitTitle.trim()) && { opacity: 0.4 }]}
                disabled={!scanPickerSubUnitId && !scanNewUnitTitle.trim()}
                onPress={confirmScanToUnit}
              >
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={scanToUnitStyles.confirmBtnText}>Add to Unit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  heroTutorialWrap: {
    marginTop: -78,
    paddingHorizontal: 24,
    zIndex: 3,
  },

  sheet: {
    backgroundColor: '#FFF8F2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  sheetWithTutorial: {
    marginTop: -10,
    paddingTop: 40,
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
  apPracticeSection: {
    marginTop: 18,
    gap: 8,
  },
  apPracticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  apPracticeHistory: {
    gap: 6,
  },
  apPracticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apPracticeText: {
    flex: 1,
    minWidth: 0,
  },
  apPracticeTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  apPracticeBody: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  apSetupSub: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  apSetupChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  apSetupUnits: {
    maxHeight: 230,
  },
  apSetupEmpty: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    paddingVertical: 10,
  },
  apUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  apUnitCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D8C8B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F2',
  },
  apUnitText: {
    flex: 1,
    minWidth: 0,
  },
  apUnitTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  apUnitMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },

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
    flexDirection: 'row',
    marginTop: 16,
    height: 52,
    borderRadius: 20,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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

  sourceActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'white',
    marginTop: 8,
  },
  sourceActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceActionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  sourceActionSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 },

  uploadedFileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#F0E0D0',
    marginBottom: 8,
  },
  uploadedFileText: { fontSize: 12, fontFamily: fonts.semiBold, flex: 1 },

  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  scanOverlayCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  scanOverlayTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  scanOverlaySub: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },

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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  colorSwatchActive: {
    borderColor: '#111',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    transform: [{ scale: 1.08 }],
  },

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

  friendsSection: { marginTop: 20, borderTopWidth: 2, borderTopColor: '#F0E0D0', paddingTop: 16 },
  friendsScroll: { maxHeight: 180, marginTop: 8 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  friendAvatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  friendInitial: { fontSize: 14, fontFamily: fonts.bold },
  friendName: { flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: fonts.semiBold },
  friendInviteBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: `${colors.maroon}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInviteBtnSent: { backgroundColor: '#FFF5ED', borderWidth: 1, borderColor: '#F0E0D0' },
  friendInviteText: { fontSize: 12, color: colors.maroon, fontFamily: fonts.bold },
  friendInviteTextSent: { color: colors.textTertiary },

  // === Flight Path ===
  flightPath: { paddingLeft: 20, paddingRight: 20, paddingBottom: 8, paddingTop: 12 },
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
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: `${colors.maroon}12`,
    borderRadius: 14,
    marginBottom: 6,
  },
  quizIconSlot: {
    width: 18,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  quizBody: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  quizTextBlock: {
    minWidth: 0,
  },
  quizTitle: { fontSize: 13, lineHeight: 18, fontFamily: fonts.bold, color: colors.textPrimary },
  quizMeta: { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 2 },
  quizScorePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  quizScoreText: { fontSize: 12, fontFamily: fonts.bold },
  quizTakeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.maroon,
  },
  quizTakeBtnText: { fontSize: 12, fontFamily: fonts.bold, color: 'white' },

  // Quiz count chips
  quizCountChip: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0',
    minWidth: 52, alignItems: 'center',
  },
  quizCountChipText: { fontSize: 16, fontFamily: fonts.bold, color: colors.textSecondary },

  // Quiz-taking modal
  quizModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  quizModalCard: {
    backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 22, paddingBottom: 40, maxHeight: '94%', flex: 1,
  },
  quizTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  quizTopTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  quizTopProgress: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary },
  quizProgressBar: { height: 6, backgroundColor: '#F0E0D0', borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
  quizProgressFill: { height: '100%', borderRadius: 3 },
  quizDismissZone: {
    minHeight: 44,
    marginTop: -6,
    marginBottom: 4,
  },
  quizTopCloseBtn: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0E0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizQuestionText: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 26, marginBottom: 20 },
  quizOptionsContainer: { gap: 12 },
  quizOptionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'white', borderRadius: 18, padding: 16,
    borderWidth: 2, borderColor: '#F0E0D0',
  },
  quizOptionEliminated: {
    backgroundColor: '#F8F2EC',
    borderColor: '#E7D5C5',
    opacity: 0.76,
  },
  quizOptionLetter: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0E0D0',
    alignItems: 'center', justifyContent: 'center',
  },
  quizOptionLetterEliminated: {
    backgroundColor: '#E7D5C5',
  },
  quizOptionLetterText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  quizOptionText: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 20 },
  quizOptionTextEliminated: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  quizEliminateBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F0E0D0',
  },
  quizEliminateBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  quizNavRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  quizNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16,
  },
  quizNavBtnText: { fontSize: 14, fontFamily: fonts.bold, color: 'white' },

  // Results — Header
  quizResultHeader: {
    alignItems: 'center' as const,
    paddingTop: 8,
    paddingBottom: 20,
    position: 'relative' as const,
  },
  quizResultCloseBtn: {
    position: 'absolute' as const,
    right: 0,
    top: 4,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0E0D0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  quizResultScore: {
    fontSize: 44,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  quizResultSub: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quizResultLabel: {
    fontSize: 17,
    fontFamily: fonts.bold,
    marginTop: 6,
  },

  // Results — AI Advice Card
  quizAdviceCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
  },
  quizAdviceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
  },
  quizAdviceTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  quizAdviceText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  quizAdviceLoadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  quizAdviceLoadingText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    fontStyle: 'italic' as const,
  },

  // Results — Section Label
  quizResultSectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  quizResultSectionLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },

  // Results — Sticky Action Bar
  quizResultActionBar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
    backgroundColor: '#FFF8F2',
    borderTopWidth: 1,
    borderTopColor: '#F0E0D0',
  },
  quizResultDoneBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F0E0D0',
  },
  quizResultDoneBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  quizResultRetakeBtn: {
    flex: 1.3,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
  },
  quizResultRetakeBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: 'white',
  },

  // Review
  quizReviewCard: {
    backgroundColor: 'white', borderRadius: 18, marginBottom: 14,
    borderWidth: 1.5, overflow: 'hidden' as const,
    flexDirection: 'row' as const,
  },
  quizReviewAccent: {
    width: 5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  quizReviewContent: {
    flex: 1,
    padding: 16,
  },
  quizReviewHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  quizReviewBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  quizReviewBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  quizReviewQNum: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
  },
  quizReviewQ: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary, lineHeight: 20, marginBottom: 12 },
  quizReviewOptsContainer: {
    gap: 6,
  },
  quizReviewOpt: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#F0E0D0',
    backgroundColor: '#FDFCFB',
  },
  quizReviewLetterCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#E7D5C5',
  },
  quizReviewOptLetter: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  quizReviewOptText: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 18 },
  quizReviewYourAnswer: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  quizReviewYourAnswerText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#059669',
  },
  quizExplainBtn: {
    marginTop: 12,
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  quizExplainBtnText: { fontSize: 12, fontFamily: fonts.semiBold, color: '#7c3aed' },
  quizExplanationBox: {
    marginTop: 12,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  quizExplanationText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: fonts.regular, color: '#4c1d95' },

  // Teacher
  teacherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 4,
  },
  teacherDisplay: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  teacherText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  teacherEditRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  teacherInput: {
    flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary,
    backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F0E0D0',
  },
  teacherSaveBtn: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  quizRowPending: { opacity: 0.6 },
  quizActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  quizIconAction: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

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

  // === Wizard Steps (Add Note) ===
  wizardSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
    marginTop: 4,
  },
  wizardStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wizardStepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#E0D0C0',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardStepNum: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  wizardStepLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
  },
  wizardStepLine: {
    width: 20,
    height: 2,
    backgroundColor: '#E0D0C0',
    borderRadius: 1,
    marginHorizontal: 2,
  },
  wizardStepTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  wizardNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  wizardBackBtn: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardBackBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  wizardPreviewCard: {
    backgroundColor: '#FFF5ED',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    marginTop: 4,
  },
  wizardPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wizardPreviewLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  wizardPreviewValue: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },

  mergingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // Merged Note Viewer
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  viewerCard: { backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: 40, maxHeight: '92%' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  viewerHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewerBadge: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewerLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  viewerCloseBtn: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0E0D0' },
  viewerTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 6 },
  viewerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  viewerMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary },
  viewerScroll: { maxHeight: 380, marginBottom: 16 },
  viewerBody: { fontSize: 15, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 24 },
  viewerActions: { flexDirection: 'row', gap: 8 },
});

const scanToUnitStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0D0C8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  sub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
    backgroundColor: '#FAFAF8',
  },
  chipActive: {
    borderColor: colors.maroon,
    backgroundColor: `${colors.maroon}0D`,
  },
  chipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.maroon,
    fontFamily: fonts.bold,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: 'white',
  },
});
