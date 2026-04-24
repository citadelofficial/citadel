import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BottomNav } from '../components/BottomNav';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { InlineTutorialCard } from '../components/InlineTutorialCard';
import { colors, fonts } from '../theme';
import type { ClassData, FriendData, UserData, UnitData, ClassInvite } from '../types';
import { friendsDirectory } from '../data/friends';
import { supabase } from '../lib/supabase';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48 - 56;
const CARD_GAP = 14;

type SearchFilter = 'all' | 'classes' | 'files' | 'friends' | 'actions';
type ShortcutType = 'class' | 'school';
type ClassTemplate = 'Standard' | 'AP Class';

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
  onProfileOpen: () => void;
  userName?: string;
  profilePicture?: string | null;
  grade?: string;
  school?: string;
  schools?: string[];
  onUpdateProfile: (updates: Partial<UserData>) => void;
  classes: ClassData[];
  onAddClass: (cls: ClassData) => void;
  onRemoveClass: (id: string) => void;
  onUpdateClass?: (cls: ClassData) => void;
  shortcuts: ShortcutItem[];
  onUpdateShortcuts: (shortcuts: ShortcutItem[]) => void;
  onSchoolOpen?: (schoolName: string) => void;
  classInvites?: ClassInvite[];
  onAcceptClassInvite?: (inviteId: string) => void;
  onDeclineClassInvite?: (inviteId: string) => void;
  tutorialStep?: number;
  onTutorialNext?: () => void;
  onTutorialBack?: () => void;
  onTutorialSkip?: () => void;
}

const blocks = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8'];
const classGoals = ['Notes', 'Projects', 'Exam Prep', 'Study Groups'];

const AP_COURSES = [
  'AP Biology', 'AP Chemistry', 'AP Physics 1', 'AP Physics 2',
  'AP Physics C: Mechanics', 'AP Physics C: E&M',
  'AP Calculus AB', 'AP Calculus BC', 'AP Statistics',
  'AP Computer Science A', 'AP Computer Science Principles',
  'AP English Language', 'AP English Literature',
  'AP US History', 'AP World History', 'AP European History',
  'AP Government', 'AP Macroeconomics', 'AP Microeconomics',
  'AP Psychology', 'AP Environmental Science',
  'AP Human Geography', 'AP Spanish', 'AP French', 'AP Art History',
];

const AP_COURSE_UNITS: Record<string, string[]> = {
  'AP Biology': ['Unit 1: Chemistry of Life', 'Unit 2: Cell Structure', 'Unit 3: Cellular Energetics'],
  'AP Chemistry': ['Unit 1: Atomic Structure', 'Unit 2: Molecular Bonding', 'Unit 3: Intermolecular Forces'],
  'AP Physics 1': ['Unit 1: Kinematics', 'Unit 2: Dynamics', 'Unit 3: Energy & Momentum'],
  'AP Physics 2': ['Unit 1: Fluids', 'Unit 2: Thermodynamics', 'Unit 3: Electric Force & Fields'],
  'AP Physics C: Mechanics': ['Unit 1: Kinematics', 'Unit 2: Newton\'s Laws', 'Unit 3: Work, Energy & Power'],
  'AP Physics C: E&M': ['Unit 1: Electrostatics', 'Unit 2: Conductors & Capacitors', 'Unit 3: Circuits'],
  'AP Calculus AB': ['Unit 1: Limits & Continuity', 'Unit 2: Differentiation', 'Unit 3: Integration'],
  'AP Calculus BC': ['Unit 1: Limits & Continuity', 'Unit 2: Advanced Differentiation', 'Unit 3: Integration Techniques'],
  'AP Statistics': ['Unit 1: Exploring Data', 'Unit 2: Sampling & Experimentation', 'Unit 3: Probability'],
  'AP Computer Science A': ['Unit 1: Primitive Types', 'Unit 2: Objects & Classes', 'Unit 3: Arrays & ArrayLists'],
  'AP Computer Science Principles': ['Unit 1: Creative Development', 'Unit 2: Data', 'Unit 3: Algorithms'],
  'AP English Language': ['Unit 1: Rhetorical Analysis', 'Unit 2: Argumentation', 'Unit 3: Synthesis'],
  'AP English Literature': ['Unit 1: Short Fiction', 'Unit 2: Poetry', 'Unit 3: Longer Fiction'],
  'AP US History': ['Unit 1: Colonial America', 'Unit 2: Revolution & Constitution', 'Unit 3: Expansion & Reform'],
  'AP World History': ['Unit 1: Ancient Civilizations', 'Unit 2: Networks of Exchange', 'Unit 3: Land-Based Empires'],
  'AP European History': ['Unit 1: Renaissance & Reformation', 'Unit 2: Absolutism', 'Unit 3: Revolutions'],
  'AP Government': ['Unit 1: Foundations of Democracy', 'Unit 2: Interactions Among Branches', 'Unit 3: Civil Liberties'],
  'AP Macroeconomics': ['Unit 1: Basic Economic Concepts', 'Unit 2: GDP & Unemployment', 'Unit 3: Monetary Policy'],
  'AP Microeconomics': ['Unit 1: Supply & Demand', 'Unit 2: Production & Costs', 'Unit 3: Market Structures'],
  'AP Psychology': ['Unit 1: Scientific Foundations', 'Unit 2: Biological Bases', 'Unit 3: Sensation & Perception'],
  'AP Environmental Science': ['Unit 1: The Living World', 'Unit 2: Populations', 'Unit 3: Land & Water Use'],
  'AP Human Geography': ['Unit 1: Thinking Geographically', 'Unit 2: Population & Migration', 'Unit 3: Cultural Patterns'],
  'AP Spanish': ['Unit 1: Families & Communities', 'Unit 2: Personal & Public Identities', 'Unit 3: Science & Technology'],
  'AP French': ['Unit 1: Families & Communities', 'Unit 2: Personal & Public Identities', 'Unit 3: Beauty & Aesthetics'],
  'AP Art History': ['Unit 1: Global Prehistory', 'Unit 2: Ancient Mediterranean', 'Unit 3: Early Europe & Americas'],
};

// Specific section names for each unit of each AP course
const AP_COURSE_SECTIONS: Record<string, string[][]> = {
  'AP Biology': [
    ['Water & Carbon', 'Macromolecules', 'Cell Membrane'],
    ['Organelles', 'Cell Transport', 'Cell Signaling'],
    ['Enzymes', 'Photosynthesis', 'Cellular Respiration'],
  ],
  'AP Chemistry': [
    ['Atomic Models', 'Electron Configuration', 'Periodic Trends'],
    ['Ionic & Covalent Bonds', 'Lewis Structures', 'VSEPR Theory'],
    ['States of Matter', 'Vapor Pressure', 'Solutions & Mixtures'],
  ],
  'AP Physics 1': [
    ['Motion in 1D', 'Vectors & 2D Motion', 'Projectile Motion'],
    ['Newton\'s Laws', 'Friction & Normal Force', 'Circular Motion'],
    ['Work & Kinetic Energy', 'Conservation of Energy', 'Momentum & Impulse'],
  ],
  'AP Physics 2': [
    ['Fluid Pressure', 'Buoyancy', 'Fluid Dynamics'],
    ['Heat Transfer', 'Ideal Gas Law', 'Laws of Thermodynamics'],
    ['Coulomb\'s Law', 'Electric Fields', 'Electric Potential'],
  ],
  'AP Physics C: Mechanics': [
    ['Position & Velocity', 'Acceleration', 'Calculus-Based Kinematics'],
    ['Force & Mass', 'Friction', 'Circular & Rotational Motion'],
    ['Work-Energy Theorem', 'Potential Energy', 'Power'],
  ],
  'AP Physics C: E&M': [
    ['Charge & Coulomb\'s Law', 'Electric Field Lines', 'Gauss\'s Law'],
    ['Capacitance', 'Dielectrics', 'Energy in Capacitors'],
    ['Current & Resistance', 'Kirchhoff\'s Rules', 'RC Circuits'],
  ],
  'AP Calculus AB': [
    ['Defining Limits', 'Continuity', 'Squeeze Theorem'],
    ['Power Rule', 'Chain Rule', 'Implicit Differentiation'],
    ['Riemann Sums', 'Fundamental Theorem', 'U-Substitution'],
  ],
  'AP Calculus BC': [
    ['Limits at Infinity', 'Continuity & IVT', 'L\'Hôpital\'s Rule'],
    ['Parametric Derivatives', 'Polar Derivatives', 'Related Rates'],
    ['Integration by Parts', 'Partial Fractions', 'Improper Integrals'],
  ],
  'AP Statistics': [
    ['Categorical Data', 'Distributions', 'Describing Quantitative Data'],
    ['Sampling Methods', 'Designing Experiments', 'Bias & Variability'],
    ['Random Variables', 'Binomial Distribution', 'Normal Distribution'],
  ],
  'AP Computer Science A': [
    ['Variables & Data Types', 'Expressions', 'Type Casting'],
    ['Creating Objects', 'Methods', 'String Class'],
    ['Array Traversal', 'ArrayList Methods', 'Searching & Sorting'],
  ],
  'AP Computer Science Principles': [
    ['Collaboration', 'Program Design', 'Debugging'],
    ['Binary & Data Types', 'Data Compression', 'Extracting Info'],
    ['Sequencing', 'Selection & Iteration', 'Developing Algorithms'],
  ],
  'AP English Language': [
    ['Reading Rhetoric', 'Tone & Purpose', 'Appeals & Evidence'],
    ['Building Arguments', 'Counterarguments', 'Logical Fallacies'],
    ['Synthesizing Sources', 'Integrating Evidence', 'Developing Commentary'],
  ],
  'AP English Literature': [
    ['Character & Setting', 'Narrative Perspective', 'Theme Analysis'],
    ['Figurative Language', 'Structure & Form', 'Tone & Mood'],
    ['Novel Analysis', 'Complex Characters', 'Broader Implications'],
  ],
  'AP US History': [
    ['European Contact', 'Colonial Societies', 'Colonial Governance'],
    ['Causes of Revolution', 'The Constitution', 'Early Republic'],
    ['Manifest Destiny', 'Slavery Debate', 'Antebellum Reform'],
  ],
  'AP World History': [
    ['Early Societies', 'Classical Empires', 'Belief Systems'],
    ['Silk Roads', 'Indian Ocean Trade', 'Trans-Saharan Trade'],
    ['Ottoman Empire', 'Mughal Empire', 'Ming Dynasty'],
  ],
  'AP European History': [
    ['Italian Renaissance', 'Northern Renaissance', 'Protestant Reformation'],
    ['Absolute Monarchies', 'Constitutional Government', 'Enlightenment'],
    ['French Revolution', 'Industrial Revolution', 'Nationalism'],
  ],
  'AP Government': [
    ['Constitutional Principles', 'Federalism', 'Democratic Ideals'],
    ['Congress', 'Presidency', 'Judiciary'],
    ['Bill of Rights', 'Due Process', 'Equal Protection'],
  ],
  'AP Macroeconomics': [
    ['Scarcity & Opportunity Cost', 'Production Possibilities', 'Comparative Advantage'],
    ['Measuring GDP', 'Inflation', 'Unemployment Types'],
    ['Federal Reserve', 'Money Supply', 'Interest Rates'],
  ],
  'AP Microeconomics': [
    ['Demand Curves', 'Supply Curves', 'Market Equilibrium'],
    ['Short-Run Costs', 'Long-Run Costs', 'Diminishing Returns'],
    ['Perfect Competition', 'Monopoly', 'Oligopoly'],
  ],
  'AP Psychology': [
    ['Research Methods', 'Ethics in Research', 'Statistical Analysis'],
    ['Neurons & Neurotransmitters', 'Brain Structure', 'Genetics & Behavior'],
    ['Sensory Processing', 'Visual Perception', 'Attention'],
  ],
  'AP Environmental Science': [
    ['Ecosystems', 'Energy Flow', 'Biogeochemical Cycles'],
    ['Population Ecology', 'Human Population', 'Carrying Capacity'],
    ['Agriculture', 'Forestry', 'Water Resources'],
  ],
  'AP Human Geography': [
    ['Maps & Spatial Data', 'Geographic Concepts', 'Regions & Scales'],
    ['Population Density', 'Migration Patterns', 'Demographic Transition'],
    ['Cultural Landscapes', 'Language & Religion', 'Diffusion'],
  ],
  'AP Spanish': [
    ['Family Structure', 'Community Values', 'Traditions'],
    ['Identity & Belonging', 'National Identity', 'Multiculturalism'],
    ['Innovation', 'Ethics of Tech', 'Future Challenges'],
  ],
  'AP French': [
    ['Family Dynamics', 'Community Life', 'Social Customs'],
    ['Self-Image', 'Cultural Identity', 'Citizenship'],
    ['Art Movements', 'Architecture', 'Literature & Film'],
  ],
  'AP Art History': [
    ['Paleolithic Art', 'Neolithic Structures', 'Early Civilizations'],
    ['Egyptian Art', 'Greek Art', 'Roman Art'],
    ['Medieval Art', 'Romanesque', 'Gothic Architecture'],
  ],
};

function buildStarterUnits(template: ClassTemplate, apCourse?: string): UnitData[] {
  const isAP = template === 'AP Class';
  const base =
    isAP && apCourse && AP_COURSE_UNITS[apCourse]
      ? AP_COURSE_UNITS[apCourse]
      : isAP
        ? ['Unit 1 Review', 'Unit 2 Review', 'Unit 3 Review']
        : ['Unit 1', 'Unit 2', 'Unit 3'];

  const sectionNames = isAP && apCourse ? AP_COURSE_SECTIONS[apCourse] : undefined;

  return base.map((title, idx) => {
    const unitNum = idx + 1;

    // Build section names
    let subUnits;
    if (sectionNames && sectionNames[idx]) {
      // AP class with specific section names
      subUnits = sectionNames[idx].map((sectionTitle, sIdx) => ({
        id: `${unitNum}.${sIdx + 1}`,
        title: sectionTitle,
        notes: [],
      }));
    } else {
      // Non-AP or fallback: numbered sections
      subUnits = [
        { id: `${unitNum}.1`, title: `${unitNum}.1`, notes: [] },
        { id: `${unitNum}.2`, title: `${unitNum}.2`, notes: [] },
        { id: `${unitNum}.3`, title: `${unitNum}.3`, notes: [] },
      ];
    }

    return {
      id: unitNum,
      title,
      pages: 0,
      collaborators: 0,
      examDate: 'TBD',
      daysLeft: 0,
      subUnits,
    };
  });
}

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

function normalizeClassCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

const TUTORIAL_TOTAL_STEPS = 7;

type GuideContent = {
  step: number;
  title: string;
  body: string;
};

export function HomeScreen({
  onCourseOpen,
  onFilesOpen,
  onScanOpen,
  onFriendsOpen,
  onProfileOpen,
  userName,
  profilePicture,
  grade,
  school,
  schools,
  onUpdateProfile,
  classes,
  onAddClass,
  onRemoveClass,
  onUpdateClass,
  shortcuts,
  onUpdateShortcuts,
  onSchoolOpen,
  classInvites = [],
  onAcceptClassInvite,
  onDeclineClassInvite,
  tutorialStep = 0,
  onTutorialNext = () => { },
  onTutorialBack = () => { },
  onTutorialSkip = () => { },
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());

  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const setShortcuts = onUpdateShortcuts;

  const [showClassModal, setShowClassModal] = useState(false);
  const [classStep, setClassStep] = useState<1 | 2 | 3 | 4>(1);
  const [newClassName, setNewClassName] = useState('');
  const [newClassBlock, setNewClassBlock] = useState('Block 1');
  const [newClassTemplate, setNewClassTemplate] = useState<ClassTemplate>('Standard');
  const [newClassColor, setNewClassColor] = useState(colors.maroon);
  const [newClassGoal, setNewClassGoal] = useState('Notes');
  const [newClassImage, setNewClassImage] = useState<string | null>(null);
  const [selectedAPCourse, setSelectedAPCourse] = useState<string | null>(null);
  const [showAPPicker, setShowAPPicker] = useState(false);
  const [apSearchQuery, setApSearchQuery] = useState('');
  const [includeAPUnits, setIncludeAPUnits] = useState(true);
  const [showJoinClassModal, setShowJoinClassModal] = useState(false);
  const [joinClassCode, setJoinClassCode] = useState('');
  const [joinClassStatus, setJoinClassStatus] = useState('');
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [newClassSchool, setNewClassSchool] = useState(school || '');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  const [showNotificationTray, setShowNotificationTray] = useState(false);
  const [tutorialFocusClassId, setTutorialFocusClassId] = useState<string | null>(null);

  // === Block Manager ===
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [editingBlockClassId, setEditingBlockClassId] = useState<string | null>(null);
  const [editingBlockNewBlock, setEditingBlockNewBlock] = useState('');

  // === Tasks ===
  interface TaskItem { id: number; title: string; classId: string | null; done: boolean; date: string; dueDate: string | null; supaId?: string; }
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskClassId, setNewTaskClassId] = useState<string | null>(null);
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(null);
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskClassId, setEditTaskClassId] = useState<string | null>(null);
  const [editTaskDueDate, setEditTaskDueDate] = useState<string | null>(null);
  const [showEditTaskDatePicker, setShowEditTaskDatePicker] = useState(false);

  const formatToday = () => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Load tasks from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) return;
        const { data, error } = await supabase
          .from('homework_tasks')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false });
        if (error) { console.log('Error loading tasks:', error); return; }
        if (data) {
          setTasks(data.map((row: any) => ({
            id: row.id,
            title: row.title,
            classId: row.class_id || null,
            done: row.done ?? false,
            date: row.date_label || '',
            dueDate: row.due_date || null,
            supaId: String(row.id),
          })));
        }
      } catch (e) { console.log('Task load error:', e); }
    })();
  }, []);

  const formatDueDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const saveTask = async () => {
    if (!newTaskTitle.trim()) return;
    const dateLabel = formatToday();
    const localId = Date.now();
    const newItem: TaskItem = { id: localId, title: newTaskTitle.trim(), classId: newTaskClassId, done: false, date: dateLabel, dueDate: newTaskDueDate };
    setTasks((prev) => [newItem, ...prev]);
    setNewTaskTitle('');
    setNewTaskClassId(null);
    setNewTaskDueDate(null);
    setShowAddTask(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const { data, error } = await supabase.from('homework_tasks').insert({
        title: newItem.title,
        class_id: newItem.classId,
        done: false,
        date_label: dateLabel,
        due_date: newTaskDueDate,
        user_id: userId,
      }).select().single();
      if (error) console.log('Error saving task:', error);
      if (data) setTasks((prev) => prev.map((t) => t.id === localId ? { ...t, supaId: String(data.id) } : t));
    } catch (e) { console.log(e); }
  };

  const openEditTask = (task: TaskItem) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskClassId(task.classId);
    setEditTaskDueDate(task.dueDate);
  };

  const saveEditTask = async () => {
    if (!editingTask || !editTaskTitle.trim()) return;
    const id = editingTask.id;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, title: editTaskTitle.trim(), classId: editTaskClassId, dueDate: editTaskDueDate } : t));
    setEditingTask(null);
    try {
      if (editingTask.supaId) {
        await supabase.from('homework_tasks').update({
          title: editTaskTitle.trim(),
          class_id: editTaskClassId,
          due_date: editTaskDueDate,
        }).eq('id', editingTask.supaId);
      }
    } catch (e) { console.log(e); }
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: newDone } : t)));
    try {
      if (task.supaId) await supabase.from('homework_tasks').update({ done: newDone }).eq('id', task.supaId);
    } catch (e) { console.log(e); }
  };

  const removeTask = async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      if (task?.supaId) await supabase.from('homework_tasks').delete().eq('id', task.supaId);
    } catch (e) { console.log(e); }
  };

  const flatListRef = useRef<FlatList>(null);

  // === Staggered section entrance ===
  const sectionFade1 = useRef(new Animated.Value(0)).current;
  const sectionSlide1 = useRef(new Animated.Value(24)).current;
  const sectionFade2 = useRef(new Animated.Value(0)).current;
  const sectionSlide2 = useRef(new Animated.Value(24)).current;
  const sectionFade3 = useRef(new Animated.Value(0)).current;
  const sectionSlide3 = useRef(new Animated.Value(24)).current;

  // Stat cards pop in
  const statScale1 = useRef(new Animated.Value(0)).current;
  const statScale2 = useRef(new Animated.Value(0)).current;
  const statScale3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeSectionAnim = (fade: Animated.Value, slide: Animated.Value) =>
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
      ]);

    Animated.stagger(120, [
      makeSectionAnim(sectionFade1, sectionSlide1),
      makeSectionAnim(sectionFade2, sectionSlide2),
      makeSectionAnim(sectionFade3, sectionSlide3),
    ]).start();

    // Stats pop after sections
    setTimeout(() => {
      Animated.stagger(100, [
        Animated.spring(statScale1, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }),
        Animated.spring(statScale2, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }),
        Animated.spring(statScale3, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }),
      ]).start();
    }, 500);
  }, [sectionFade1, sectionSlide1, sectionFade2, sectionSlide2, sectionFade3, sectionSlide3, statScale1, statScale2, statScale3]);

  // === Heart toggle microinteraction ===
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartRingScale = useRef(new Animated.Value(0.5)).current;
  const heartRingOpacity = useRef(new Animated.Value(0)).current;
  const [heartRingPos, setHeartRingPos] = useState<{ top: number; left: number } | null>(null);

  // === Success toast for class creation ===
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const toastSlide = useRef(new Animated.Value(80)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastScale = useRef(new Animated.Value(0.8)).current;

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message);
    toastSlide.setValue(80);
    toastOpacity.setValue(0);
    toastScale.setValue(0.8);
    Animated.parallel([
      Animated.spring(toastSlide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(toastScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(toastSlide, { toValue: 40, duration: 300, useNativeDriver: true }),
      ]).start(() => setSuccessToast(null));
    }, 2200);
  }, [toastSlide, toastOpacity, toastScale]);

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

  const tutorialGuide = useMemo<GuideContent | null>(() => {
    if (tutorialStep === 1) {
      return {
        step: 1,
        title: 'Create your first class',
        body: showClassModal
          ? 'Finish this class setup, then tap Create Class to continue.'
          : 'Tap the highlighted Create / Join Class card to start building your schedule.',
      };
    }

    if (tutorialStep === 2 && !showClassModal) {
      return {
        step: 2,
        title: 'Open your class',
        body: tutorialFocusClassId
          ? 'Tap the highlighted class card to open it and start working inside it.'
          : 'Tap any class card to open it and start working inside it.',
      };
    }

    return null;
  }, [showClassModal, tutorialFocusClassId, tutorialStep]);

  const shouldHighlightAddCard = tutorialStep === 1 && !showClassModal;

  useEffect(() => {
    if (tutorialStep === 0) {
      setTutorialFocusClassId(null);
    }
  }, [tutorialStep]);

  useEffect(() => {
    if (!shouldHighlightAddCard) return;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: classes.length * (CARD_WIDTH + CARD_GAP),
        animated: true,
      });
      setCurrentCardIndex(classes.length);
    }, 250);

    return () => clearTimeout(timer);
  }, [classes.length, shouldHighlightAddCard]);

  useEffect(() => {
    if (tutorialStep !== 2 || classes.length === 0) return;

    const targetIndex = tutorialFocusClassId
      ? Math.max(0, classes.findIndex((item) => item.id === tutorialFocusClassId))
      : 0;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: targetIndex * (CARD_WIDTH + CARD_GAP),
        animated: true,
      });
      setCurrentCardIndex(targetIndex);
    }, 250);

    return () => clearTimeout(timer);
  }, [classes, tutorialFocusClassId, tutorialStep]);

  const openCourse = useCallback((classId: string) => {
    if (tutorialStep === 2) {
      onTutorialNext();
    }
    onCourseOpen(classId);
  }, [onCourseOpen, onTutorialNext, tutorialStep]);

  const toggleLike = useCallback((id: string) => {
    const wasLiked = likedCards.has(id);
    setLikedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (!wasLiked) {
      // Heart pop: scale up then bounce back
      heartScale.setValue(0.3);
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 18,
      }).start();
      // Ring ripple
      heartRingScale.setValue(0.5);
      heartRingOpacity.setValue(0.6);
      Animated.parallel([
        Animated.timing(heartRingScale, { toValue: 2.5, duration: 500, useNativeDriver: true }),
        Animated.timing(heartRingOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [likedCards, heartScale, heartRingScale, heartRingOpacity]);

  const shortcutIcon = (item: ShortcutItem): keyof typeof Ionicons.glyphMap => {
    if (item.type === 'class') return 'document-text';
    if (item.type === 'school') return 'school';
    return 'bookmark';
  };

  const runShortcut = (item: ShortcutItem) => {
    if (item.type === 'class' && item.refId) {
      const classExists = classes.some(c => c.id === item.refId);
      if (!classExists) {
        Alert.alert('Class Not Found', 'This class has been removed.', [
          { text: 'Remove Shortcut', style: 'destructive', onPress: () => setShortcuts(shortcuts.filter(s => s.id !== item.id)) },
          { text: 'OK', style: 'cancel' },
        ]);
        return;
      }
      openCourse(item.refId);
      return;
    }
    if (item.type === 'school' && item.refId && onSchoolOpen) {
      onSchoolOpen(item.refId);
      return;
    }
  };

  const longPressShortcut = (item: ShortcutItem) => {
    Alert.alert(
      item.label,
      'Remove this shortcut?',
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setShortcuts(shortcuts.filter(s => s.id !== item.id)),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const addShortcut = (type: ShortcutType, label: string, refId?: string) => {
    const isDuplicate = shortcuts.some(s => s.type === type && s.refId === refId);
    if (isDuplicate) {
      setShowShortcutModal(false);
      return;
    }
    const item: ShortcutItem = {
      id: `shortcut-${Date.now()}`,
      type,
      label,
      refId,
    };
    setShortcuts([...shortcuts, item]);
    setShowShortcutModal(false);
  };

  const resetNewClassDraft = useCallback(() => {
    setNewClassName('');
    setNewClassBlock('Block 1');
    setNewClassTemplate('Standard');
    setNewClassColor(colors.maroon);
    setNewClassGoal('Notes');
    setNewClassImage(null);
    setSelectedAPCourse(null);
    setApSearchQuery('');
    setShowAPPicker(false);
    setClassStep(1);
    setNewClassSchool(school || '');
    setNewClassTeacher('');
  }, [school]);

  const openAddClassModal = () => {
    resetNewClassDraft();
    setShowClassModal(true);
  };

  const closeClassModal = useCallback(() => {
    setShowClassModal(false);
    setShowAPPicker(false);
    if (tutorialStep > 0) {
      onTutorialSkip();
    }
  }, [onTutorialSkip, tutorialStep]);

  const handleTutorialAdvance = useCallback(() => {
    if (tutorialStep === 1) {
      openAddClassModal();
      return;
    }

    if (tutorialStep === 2) {
      const targetClassId = tutorialFocusClassId || classes[0]?.id;
      if (targetClassId) {
        openCourse(targetClassId);
      }
      return;
    }

    onTutorialNext();
  }, [classes, onTutorialNext, openAddClassModal, openCourse, tutorialFocusClassId, tutorialStep]);

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
      newClassTemplate === 'AP Class'
        ? 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=500&fit=crop'
        : 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=500&fit=crop';

    const newClass: ClassData = {
      id: Date.now().toString(),
      title: newClassTemplate === 'AP Class' && selectedAPCourse ? selectedAPCourse : title,
      block: newClassBlock,
      classCode: makeClassCode(title),
      image: newClassImage || templateImage,
      classmates: 1,
      classmateNames: userName ? [userName] : [],
      documents: 0,
      color: newClassColor,
      description: `${newClassTemplate} setup • Focus: ${newClassGoal}`,
      files: [],
      units: (newClassTemplate === 'AP Class' && !includeAPUnits) ? [] : buildStarterUnits(newClassTemplate, selectedAPCourse || undefined),
      school: newClassSchool || school || undefined,
      teacher: newClassTeacher.trim() || undefined,
    };

    const finishCreate = (replaceId?: string) => {
      if (replaceId) onRemoveClass(replaceId);
      setTutorialFocusClassId(newClass.id);
      onAddClass(newClass);
      setShowClassModal(false);
      const nextIndex = replaceId ? Math.max(classes.length - 1, 0) : classes.length;
      setCurrentCardIndex(nextIndex);
      showSuccessToast(`${newClass.title} created.`);
      if (tutorialStep === 1) {
        onTutorialNext();
      }
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: nextIndex * (CARD_WIDTH + CARD_GAP), animated: true });
      }, 120);
    };

    // Check for block conflict
    const existing = classes.find((c) => c.block === newClassBlock);
    if (existing) {
      Alert.alert(
        `${newClassBlock} already has a class`,
        `"${existing.title}" is already in ${newClassBlock}. What would you like to do?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => finishCreate(existing.id) },
          { text: 'Keep Both', onPress: () => finishCreate() },
        ]
      );
    } else {
      finishCreate();
    }
  };

  const handleSearchSelect = (item: SearchResult) => {
    if (item.type === 'class') {
      openCourse(item.classId);
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

  const openJoinClassModal = () => {
    setJoinClassCode('');
    setJoinClassStatus('');
    setShowJoinClassModal(true);
  };

  // School-gated class adding: check if user is in the class's school
  const addClassWithSchoolGate = (classData: ClassData, onSuccess: () => void) => {
    const classSchool = classData.school;
    const userSchools = schools || (school ? [school] : []);

    // If class has a school and user isn't in it, prompt to join
    if (classSchool && !userSchools.some(s => s.toLowerCase() === classSchool.toLowerCase())) {
      Alert.alert(
        'School Required',
        `This class belongs to "${classSchool}". You need to join this school first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Join School & Add Class',
            onPress: () => {
              // Add the school to user's schools list
              const newSchools = [...userSchools, classSchool];
              onUpdateProfile({
                schools: newSchools,
                primarySchool: userSchools.length === 0 ? classSchool : undefined,
              } as any);
              onAddClass(classData);
              onSuccess();
            },
          },
        ]
      );
    } else {
      onAddClass(classData);
      onSuccess();
    }
  };

  const joinExistingClass = async () => {
    const rawCode = joinClassCode.trim();

    if (!rawCode) {
      setJoinClassStatus('Enter a class code to continue.');
      return;
    }

    const normalized = normalizeClassCode(rawCode);

    // Check if user already has this class locally
    const localMatch = classes.find((cls) => normalizeClassCode(cls.classCode) === normalized);
    if (localMatch) {
      setShowJoinClassModal(false);
      setJoinClassStatus('');
      openCourse(localMatch.id);
      return;
    }

    // Try to decode as Base64 class data (for shared invite codes)
    try {
      // Guard against excessively large payloads
      if (rawCode.length > 5000) throw new Error('Code too long');
      const decoded = atob(rawCode);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.title === 'string' && typeof parsed.classCode === 'string') {
        // Sanitize: only pick known ClassData fields to prevent property injection
        const joinedClass: ClassData = {
          id: Date.now().toString(),
          title: String(parsed.title || '').slice(0, 200),
          description: String(parsed.description || '').slice(0, 500),
          block: String(parsed.block || ''),
          color: typeof parsed.color === 'string' ? parsed.color.slice(0, 20) : '',
          classCode: String(parsed.classCode || '').slice(0, 50),
          classmates: Math.max(0, Math.min(Number(parsed.classmates) || 0, 9999)) + 1,
          classmateNames: Array.isArray(parsed.classmateNames) ? parsed.classmateNames.filter((n: unknown) => typeof n === 'string').slice(0, 100).map((n: string) => n.slice(0, 100)) : [],
          units: Array.isArray(parsed.units) ? parsed.units : [],
          files: Array.isArray(parsed.files) ? parsed.files : [],
          documents: Number(parsed.documents) || 0,
          image: typeof parsed.image === 'string' ? parsed.image.slice(0, 500) : '',
          school: typeof parsed.school === 'string' ? parsed.school.slice(0, 200) : undefined,
        };
        addClassWithSchoolGate(joinedClass, () => {
          setShowJoinClassModal(false);
          setJoinClassStatus('');
          showSuccessToast(`Joined ${joinedClass.title}.`);
        });
        return;
      }
    } catch {
      // Not a Base64 code, continue with normal lookup
    }

    setJoinClassStatus('Looking up class code...');

    try {
      // Strategy 1: Check class_code_registry table (publicly readable)
      try {
        const { data: registryData, error: registryError } = await supabase
          .from('class_code_registry')
          .select('class_data')
          .eq('class_code', normalized)
          .limit(1);

        if (!registryError && registryData && registryData.length > 0) {
          const classData = registryData[0].class_data as ClassData;
          const joinedClass: ClassData = {
            ...classData,
            id: Date.now().toString(),
            classmates: (classData.classmates || 0) + 1,
            classmateNames: [...(classData.classmateNames || []), ...(userName ? [userName] : [])],
          };
          addClassWithSchoolGate(joinedClass, () => {
            setShowJoinClassModal(false);
            setJoinClassStatus('');
            showSuccessToast(`Joined ${joinedClass.title}.`);
          });
          return;
        }
      } catch {
        // Registry table may not exist, try next strategy
      }

      // Strategy 2: Search profiles' class_codes field (profiles are publicly readable)
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('class_codes')
          .not('class_codes', 'is', null);

        if (!profilesError && profiles && profiles.length > 0) {
          for (const profile of profiles) {
            const codes = profile.class_codes as Record<string, any> | null;
            if (codes && codes[normalized]) {
              const classData = codes[normalized] as ClassData;
              const joinedClass: ClassData = {
                ...classData,
                id: Date.now().toString(),
                classmates: (classData.classmates || 0) + 1,
                classmateNames: [...(classData.classmateNames || []), ...(userName ? [userName] : [])],
              };
              addClassWithSchoolGate(joinedClass, () => {
                setShowJoinClassModal(false);
                setJoinClassStatus('');
                showSuccessToast(`Joined ${joinedClass.title}.`);
              });
              return;
            }
          }
        }
      } catch {
        // class_codes column may not exist, try next strategy
      }

      // Strategy 3: Try user_classes table (works if RLS allows cross-user read)
      try {
        const { data, error } = await supabase.from('user_classes').select('class_data');
        if (!error && data && data.length > 0) {
          const found = data.find((row: any) => {
            const code = row.class_data?.classCode;
            return code && normalizeClassCode(code) === normalized;
          });
          if (found) {
            const classData = found.class_data as ClassData;
            const joinedClass: ClassData = { ...classData, id: Date.now().toString(), classmates: (classData.classmates || 0) + 1, classmateNames: [...(classData.classmateNames || []), ...(userName ? [userName] : [])] };
            addClassWithSchoolGate(joinedClass, () => {
              setShowJoinClassModal(false);
              setJoinClassStatus('');
              showSuccessToast(`Joined ${joinedClass.title}.`);
            });
            return;
          }
        }
      } catch {
        // RLS may block this, that's ok
      }

      setJoinClassStatus('Class code not found. Double-check the code and try again.');
    } catch (e) {
      setJoinClassStatus('Something went wrong. Try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{userName ? `Hello, ${userName}` : 'Welcome Back'}</Text>
            <Text style={styles.subtitle}>Welcome to Citadel</Text>
          </View>
          <TouchableOpacity style={styles.avatarWrap} onPress={onProfileOpen}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={28} color={colors.textTertiary} />
            )}
            {classInvites.length > 0 && (
              <View style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 20, height: 20, borderRadius: 10,
                backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 4, borderWidth: 2, borderColor: '#FFF8F2',
              }}>
                <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: 'white' }}>{classInvites.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

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

        {/* Notification Banner */}
        {classInvites.length > 0 && (
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: 'white', borderRadius: 20, padding: 14,
              borderWidth: 2, borderColor: '#F0E0D0', marginTop: 12,
            }}
            onPress={() => setShowNotificationTray(true)}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 14,
              backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="notifications" size={18} color="#dc2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary }}>
                {classInvites.length} class invite{classInvites.length !== 1 ? 's' : ''}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 1 }}>
                Tap to view and accept
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

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

        <Animated.View style={{ opacity: sectionFade1, transform: [{ translateY: sectionSlide1 }] }}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Shortcuts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcuts} contentContainerStyle={styles.shortcutsContent}>
            <AnimatedPressable style={styles.shortcutAdd} onPress={() => setShowShortcutModal(true)} scaleDown={0.88}>
              <Ionicons name="add" size={24} color="white" />
            </AnimatedPressable>

            {shortcuts.map((shortcut) => (
              <AnimatedPressable key={shortcut.id} style={styles.shortcut} onPress={() => runShortcut(shortcut)} onLongPress={() => longPressShortcut(shortcut)} scaleDown={0.92}>
                <Ionicons name={shortcutIcon(shortcut)} size={16} color={colors.maroon} />
                <Text style={styles.shortcutLabel} numberOfLines={1}>
                  {shortcut.label}
                </Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View style={{ opacity: sectionFade2, transform: [{ translateY: sectionSlide2 }] }}>
          <View style={styles.carouselHeader}>
            <View style={styles.classesHeaderLeft}>
              <Text style={styles.sectionTitle}>My Classes</Text>
              <AnimatedPressable style={styles.joinClassBtn} onPress={openJoinClassModal} scaleDown={0.93}>
                <Ionicons name="log-in-outline" size={15} color="white" />
                <Text style={styles.joinClassBtnText}>Join Existing Class</Text>
              </AnimatedPressable>
            </View>
            {classes.length > 0 && (
              <Text style={styles.counter}>
                {currentCardIndex + 1} / {classes.length + 1}
              </Text>
            )}
          </View>

          {tutorialGuide && !showClassModal && (
            <InlineTutorialCard
              step={tutorialGuide.step}
              totalSteps={TUTORIAL_TOTAL_STEPS}
              title={tutorialGuide.title}
              body={tutorialGuide.body}
              onDismiss={onTutorialSkip}
              onPrevious={tutorialStep > 1 ? onTutorialBack : undefined}
              onNext={handleTutorialAdvance}
              nextLabel={tutorialStep === 2 ? 'Open' : 'Next'}
            />
          )}

          <FlatList
            ref={flatListRef}
            data={[...classes, { id: 'add', isAdd: true }] as (ClassData | { id: string; isAdd: true })[]}
            horizontal
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={3}
            removeClippedSubviews={false}
            getItemLayout={(data, index) => ({
              length: CARD_WIDTH + CARD_GAP,
              offset: (CARD_WIDTH + CARD_GAP) * index,
              index,
            })}
            contentContainerStyle={styles.carouselContent}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
              setCurrentCardIndex(Math.min(index, classes.length));
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if ('isAdd' in item && item.isAdd) {
                return (
                  <TouchableOpacity
                    style={[
                      styles.classCard,
                      styles.addCard,
                      { width: CARD_WIDTH },
                      shouldHighlightAddCard && styles.tutorialTargetCard,
                    ]}
                    onPress={openAddClassModal}
                  >
                    <View style={styles.addCardInner}>
                      {shouldHighlightAddCard && (
                        <View style={styles.tutorialTargetBadge}>
                          <Text style={styles.tutorialTargetBadgeText}>
                            Start here
                          </Text>
                        </View>
                      )}
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
                <AnimatedPressable
                  style={[
                    styles.classCard,
                    { width: CARD_WIDTH, shadowColor: cls.color },
                    tutorialStep === 2 && (!tutorialFocusClassId || tutorialFocusClassId === cls.id) && styles.tutorialTargetCard,
                  ]}
                  onPress={() => openCourse(cls.id)}
                  scaleDown={0.96}
                >
                  <Image source={{ uri: cls.image }} style={styles.classImage} />
                  <View style={styles.classOverlay} />
                  {tutorialStep === 2 && (!tutorialFocusClassId || tutorialFocusClassId === cls.id) && (
                    <View style={styles.tutorialClassBadge}>
                      <Text style={styles.tutorialClassBadgeText}>Open this class</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.heartBtn} onPress={() => toggleLike(cls.id)} activeOpacity={1}>
                    <Animated.View style={{ transform: [{ scale: isLiked ? heartScale : 1 }] }}>
                      <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? '#ff4d6d' : 'white'} />
                    </Animated.View>
                    {/* Ring ripple */}
                    <Animated.View
                      style={{
                        position: 'absolute',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        borderWidth: 2,
                        borderColor: '#ff4d6d',
                        opacity: heartRingOpacity,
                        transform: [{ scale: heartRingScale }],
                      }}
                    />
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
                    <View style={styles.classHighlights}>
                      <View style={styles.classHighlightPill}>
                        <Ionicons name="people" size={13} color="white" />
                        <Text style={styles.classHighlightText}>{cls.classmates} classmates</Text>
                      </View>
                      <View style={styles.classHighlightPill}>
                        <Ionicons name="documents" size={13} color="white" />
                        <Text style={styles.classHighlightText}>{cls.files.length} files</Text>
                      </View>
                    </View>
                  </View>
                </AnimatedPressable>
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
        </Animated.View>

        {/* Schedule & Tasks Section */}
        <View style={{ marginTop: 28 }}>
          <Text style={styles.sectionTitle}>My Schedule</Text>

          {/* Block Schedule Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 10, paddingRight: 24 }}>
            {blocks.map((block) => {
              const blockClasses = classes.filter((c) => c.block === block);
              return (
                <TouchableOpacity
                  key={block}
                  activeOpacity={0.7}
                  onPress={() => setActiveBlock(block)}
                  style={[styles.blockCard, blockClasses.length > 0 && { borderColor: blockClasses[0].color }]}
                >
                  <Text style={[styles.blockLabel, blockClasses.length > 0 && { color: blockClasses[0].color }]}>{block}</Text>
                  {blockClasses.length === 0 ? (
                    <Text style={styles.blockClass} numberOfLines={1}>Free</Text>
                  ) : blockClasses.length === 1 ? (
                    <Text style={styles.blockClass} numberOfLines={1}>{blockClasses[0].title}</Text>
                  ) : (
                    <View style={{ gap: 2 }}>
                      {blockClasses.map((bc) => (
                        <Text key={bc.id} style={[styles.blockClass, { fontSize: 10 }]} numberOfLines={1}>{bc.title}</Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Block Manager Modal */}
          <Modal visible={!!activeBlock} transparent animationType="slide" onRequestClose={() => { setActiveBlock(null); setEditingBlockClassId(null); }}>
            <TouchableOpacity style={styles.blockModalOverlay} activeOpacity={1} onPress={() => { setActiveBlock(null); setEditingBlockClassId(null); }}>
              <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.blockModalContent}>
                <View style={styles.blockModalHandle} />
                <Text style={styles.blockModalTitle}>{activeBlock}</Text>
                <Text style={styles.blockModalSub}>{(() => {
                  const bc = classes.filter(c => c.block === activeBlock);
                  return bc.length === 0 ? 'No classes in this block' : `${bc.length} class${bc.length > 1 ? 'es' : ''}`;
                })()}</Text>

                {activeBlock && classes.filter(c => c.block === activeBlock).map((cls) => (
                  <View key={cls.id} style={styles.blockModalClassRow}>
                    <View style={[styles.blockModalClassDot, { backgroundColor: cls.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockModalClassName}>{cls.title}</Text>
                      {cls.teacher ? <Text style={styles.blockModalClassTeacher}>{cls.teacher}</Text> : null}
                    </View>

                    {editingBlockClassId === cls.id ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary }}>Move to:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                          {blocks.filter(b => b !== activeBlock).map((b) => (
                            <TouchableOpacity
                              key={b}
                              style={[styles.blockMoveBtn, editingBlockNewBlock === b && styles.blockMoveBtnActive]}
                              onPress={() => setEditingBlockNewBlock(b)}
                            >
                              <Text style={[styles.blockMoveBtnText, editingBlockNewBlock === b && styles.blockMoveBtnTextActive]}>{b.replace('Block ', '')}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        <TouchableOpacity
                          style={[styles.blockMoveConfirm, !editingBlockNewBlock && { opacity: 0.4 }]}
                          disabled={!editingBlockNewBlock}
                          onPress={() => {
                            if (editingBlockNewBlock && onUpdateClass) {
                              onUpdateClass({ ...cls, block: editingBlockNewBlock });
                              setEditingBlockClassId(null);
                              setEditingBlockNewBlock('');
                            }
                          }}
                        >
                          <Ionicons name="checkmark" size={14} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingBlockClassId(null); setEditingBlockNewBlock(''); }}>
                          <Ionicons name="close" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => onCourseOpen(cls.id)} hitSlop={8}>
                          <Ionicons name="open-outline" size={18} color={colors.maroon} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingBlockClassId(cls.id); setEditingBlockNewBlock(''); }} hitSlop={8}>
                          <Ionicons name="swap-horizontal-outline" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                          Alert.alert('Remove Class', `Remove "${cls.title}" from ${activeBlock}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => onRemoveClass(cls.id) },
                          ]);
                        }} hitSlop={8}>
                          <Ionicons name="trash-outline" size={18} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.blockModalAddBtn}
                  onPress={() => {
                    setActiveBlock(null);
                    setEditingBlockClassId(null);
                    setNewClassBlock(activeBlock || 'Block 1');
                    setShowClassModal(true);
                    setClassStep(1);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.maroon} />
                  <Text style={styles.blockModalAddBtnText}>Add Class to {activeBlock}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* Tasks */}
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.schedSubTitle}>Tasks & Homework</Text>
              <TouchableOpacity onPress={() => setShowAddTask(true)} style={styles.addTaskBtn}>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addTaskBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {tasks.length === 0 && !showAddTask ? (
              <View style={styles.emptyTasks}>
                <Ionicons name="checkmark-done" size={28} color={colors.textTertiary} />
                <Text style={styles.emptyTasksText}>No tasks yet — add homework or to-dos above.</Text>
              </View>
            ) : (
              <View style={{ marginTop: 10, gap: 8 }}>
                {tasks.map((task) => {
                  const taskClass = classes.find((c) => c.id === task.classId);
                  return (
                    <View key={task.id} style={[styles.taskRow, task.done && styles.taskRowDone]}>
                      <TouchableOpacity onPress={() => toggleTask(task.id)} style={styles.taskCheck}>
                        <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={task.done ? '#059669' : colors.textTertiary} />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          {taskClass && (
                            <View style={[styles.taskClassPill, { backgroundColor: `${taskClass.color}14` }]}>
                              <Text style={[styles.taskClassPillText, { color: taskClass.color }]}>{taskClass.title}</Text>
                            </View>
                          )}
                          {task.dueDate && (
                            <View style={styles.dueDatePill}>
                              <Ionicons name="calendar-outline" size={10} color="#b45309" />
                              <Text style={styles.dueDateText}>Due {formatDueDate(task.dueDate)}</Text>
                            </View>
                          )}
                          <Text style={styles.taskDate}>{task.date}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => openEditTask(task)} hitSlop={8} style={{ marginRight: 8 }}>
                        <Ionicons name="pencil-outline" size={15} color={colors.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeTask(task.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {showAddTask && (
              <View style={styles.addTaskRow}>
                <TextInput
                  style={styles.addTaskInput}
                  placeholder="What's due?"
                  placeholderTextColor={colors.textTertiary}
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                  autoFocus
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.taskClassChip, !newTaskClassId && styles.taskClassChipActive]}
                    onPress={() => setNewTaskClassId(null)}
                  >
                    <Text style={[styles.taskClassChipText, !newTaskClassId && styles.taskClassChipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {classes.map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.taskClassChip, newTaskClassId === cls.id && styles.taskClassChipActive]}
                      onPress={() => setNewTaskClassId(cls.id)}
                    >
                      <Text style={[styles.taskClassChipText, newTaskClassId === cls.id && styles.taskClassChipTextActive]}>{cls.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.dueDatePickerBtn}
                  onPress={() => setShowTaskDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={14} color={newTaskDueDate ? '#b45309' : colors.textTertiary} />
                  <Text style={[styles.dueDatePickerText, newTaskDueDate && { color: '#b45309' }]}>
                    {newTaskDueDate ? `Due ${formatDueDate(newTaskDueDate)}` : 'Set due date'}
                  </Text>
                  {newTaskDueDate && (
                    <TouchableOpacity onPress={() => setNewTaskDueDate(null)} hitSlop={6}>
                      <Ionicons name="close-circle" size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <DateTimePickerModal
                  isVisible={showTaskDatePicker}
                  mode="date"
                  onConfirm={(date) => {
                    setNewTaskDueDate(date.toISOString());
                    setShowTaskDatePicker(false);
                  }}
                  onCancel={() => setShowTaskDatePicker(false)}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={styles.cancelTaskBtn} onPress={() => { setShowAddTask(false); setNewTaskTitle(''); setNewTaskDueDate(null); }}>
                    <Text style={styles.cancelTaskBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveTaskBtn, !newTaskTitle.trim() && { opacity: 0.5 }]} onPress={saveTask} disabled={!newTaskTitle.trim()}>
                    <Text style={styles.saveTaskBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <Animated.View style={{ opacity: sectionFade3, transform: [{ translateY: sectionSlide3 }] }}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Overview</Text>
          <View style={styles.statsRow}>
            <Animated.View style={[styles.statCard, styles.statCardClasses, { transform: [{ scale: statScale1 }] }]}>
              <View style={[styles.statIcon, styles.statIconClasses]}>
                <Ionicons name="book" size={20} color={colors.maroon} />
              </View>
              <Text style={styles.statValue}>{classes.length}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </Animated.View>
            <Animated.View style={[styles.statCard, styles.statCardDocs, { transform: [{ scale: statScale2 }] }]}>
              <View style={[styles.statIcon, styles.statIconDocs]}>
                <Ionicons name="document-text" size={20} color="#2563eb" />
              </View>
              <Text style={styles.statValue}>{classes.reduce((a, c) => a + c.documents, 0)}</Text>
              <Text style={styles.statLabel}>Documents</Text>
            </Animated.View>
            <Animated.View style={[styles.statCard, styles.statCardFriends, { transform: [{ scale: statScale3 }] }]}>
              <View style={[styles.statIcon, styles.statIconFriends]}>
                <Ionicons name="people" size={20} color="#059669" />
              </View>
              <Text style={styles.statValue}>{friendsDirectory.length}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </Animated.View>
          </View>
          {school ? (
            <View style={styles.schoolBanner}>
              <View style={styles.schoolBannerIcon}>
                <Ionicons name="school" size={18} color={colors.maroon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.schoolBannerLabel}>Your School</Text>
                <Text style={styles.schoolBannerName} numberOfLines={1}>{school}</Text>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Success toast */}
      {
        successToast && (
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 120,
              left: 30,
              right: 30,
              alignItems: 'center',
              zIndex: 1000,
              opacity: toastOpacity,
              transform: [{ translateY: toastSlide }, { scale: toastScale }],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.maroon,
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderRadius: 20,
                gap: 10,
                shadowColor: colors.maroon,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={{ color: 'white', fontFamily: fonts.bold, fontSize: 14 }}>{successToast}</Text>
            </View>
          </Animated.View>
        )
      }

      <BottomNav active="home" onHome={() => { }} onScan={onScanOpen} onFriends={onFriendsOpen} onFiles={() => onFilesOpen()} />

      {/* Notification Tray Modal */}
      <Modal visible={showNotificationTray} transparent animationType="fade" onRequestClose={() => setShowNotificationTray(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          activeOpacity={1}
          onPress={() => setShowNotificationTray(false)}
        >
          <View style={{
            position: 'absolute', top: 100, right: 20, left: 20,
            backgroundColor: '#FFF8F2', borderRadius: 24,
            padding: 20, maxHeight: 420,
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}>
            <TouchableOpacity activeOpacity={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 12,
                    backgroundColor: `${colors.maroon}12`, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="notifications" size={18} color={colors.maroon} />
                  </View>
                  <Text style={{ fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 }}>Notifications</Text>
                </View>
                <TouchableOpacity onPress={() => setShowNotificationTray(false)}>
                  <Ionicons name="close-circle" size={26} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {classInvites.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <View style={{
                    width: 60, height: 60, borderRadius: 20,
                    backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                  }}>
                    <Ionicons name="checkmark-circle-outline" size={28} color={colors.maroon} />
                  </View>
                  <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary }}>All Caught Up!</Text>
                  <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
                    No new notifications. Class invites{"\n"}from friends will appear here.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  {classInvites.map((invite) => (
                    <View key={invite.id} style={{
                      backgroundColor: 'white', borderRadius: 18, padding: 14,
                      borderWidth: 2, borderColor: '#F0E0D0', marginBottom: 10,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <View style={{
                          width: 36, height: 36, borderRadius: 12,
                          backgroundColor: (invite.class_data?.color || colors.maroon) + '18',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name="book" size={16} color={invite.class_data?.color || colors.maroon} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary }}>{invite.class_title}</Text>
                          <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 1 }}>
                            from {invite.from_display_name}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1, height: 38, borderRadius: 14,
                            backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center',
                          }}
                          onPress={() => {
                            onAcceptClassInvite?.(invite.id);
                            showSuccessToast(`Joined ${invite.class_title}.`);
                            if (classInvites.length <= 1) setShowNotificationTray(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: 'white' }}>Join Class</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            height: 38, paddingHorizontal: 16, borderRadius: 14,
                            backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1.5, borderColor: '#F0E0D0',
                          }}
                          onPress={() => onDeclineClassInvite?.(invite.id)}
                        >
                          <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary }}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>


      <Modal visible={showShortcutModal} transparent animationType="fade" onRequestClose={() => setShowShortcutModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowShortcutModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Shortcut</Text>
              <TouchableOpacity onPress={() => setShowShortcutModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 14 }}>
              Quick-access to your classes and schools from the home screen.
            </Text>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {/* Classes section */}
              {classes.length > 0 && (
                <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: colors.textTertiary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Classes</Text>
              )}
              {classes.map((cls) => {
                const alreadyAdded = shortcuts.some(s => s.type === 'class' && s.refId === cls.id);
                return (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.shortcutOptionRow, alreadyAdded && { opacity: 0.5 }]}
                    onPress={() => addShortcut('class', cls.title, cls.id)}
                    disabled={alreadyAdded}
                  >
                    <View style={[styles.shortcutOptionIcon, { backgroundColor: `${cls.color}18` }]}>
                      <Ionicons name="document-text" size={18} color={cls.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shortcutOptionLabel}>{cls.title}</Text>
                      <Text style={styles.shortcutOptionSub}>{cls.block}</Text>
                    </View>
                    {alreadyAdded ? (
                      <Ionicons name="checkmark-circle" size={20} color="#059669" />
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color={colors.maroon} />
                    )}
                  </TouchableOpacity>
                );
              })}
              {classes.length === 0 && (
                <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, paddingVertical: 8 }}>No classes yet — create one first.</Text>
              )}

              {/* Schools section */}
              {(schools && schools.length > 0) && (
                <>
                  <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: colors.textTertiary, marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Schools</Text>
                  {schools.map((schoolName) => {
                    const alreadyAdded = shortcuts.some(s => s.type === 'school' && s.refId === schoolName);
                    return (
                      <TouchableOpacity
                        key={schoolName}
                        style={[styles.shortcutOptionRow, alreadyAdded && { opacity: 0.5 }]}
                        onPress={() => addShortcut('school', schoolName, schoolName)}
                        disabled={alreadyAdded}
                      >
                        <View style={[styles.shortcutOptionIcon, { backgroundColor: '#FFF0E6' }]}>
                          <Ionicons name="school" size={18} color={colors.maroon} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shortcutOptionLabel}>{schoolName}</Text>
                          <Text style={styles.shortcutOptionSub}>Open school page</Text>
                        </View>
                        {alreadyAdded ? (
                          <Ionicons name="checkmark-circle" size={20} color="#059669" />
                        ) : (
                          <Ionicons name="add-circle-outline" size={20} color={colors.maroon} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showJoinClassModal} transparent animationType="fade" onRequestClose={() => setShowJoinClassModal(false)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Join Existing Class</Text>
                <TouchableOpacity onPress={() => setShowJoinClassModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Class Code</Text>
              <TextInput
                style={styles.modalInput}
                value={joinClassCode}
                onChangeText={(text) => {
                  setJoinClassCode(text);
                  if (joinClassStatus) setJoinClassStatus('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Ex: HUG-4B9P"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.joinHint}>Use the exact class code shared by your teacher/classmate.</Text>
              {joinClassStatus.length > 0 && <Text style={styles.joinStatus}>{joinClassStatus}</Text>}
              <TouchableOpacity style={styles.modalSaveBtn} onPress={joinExistingClass}>
                <Text style={styles.modalSaveBtnText}>Join Class</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showClassModal} transparent animationType="slide" onRequestClose={closeClassModal}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            {/* AP Picker sub-modal */}
            {showAPPicker ? (
              <View style={styles.modalCardLarge}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose AP Course</Text>
                  <TouchableOpacity onPress={() => setShowAPPicker(false)}>
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: 12 }}>Pick your AP course to personalize units.</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Search AP courses..."
                  placeholderTextColor={colors.textTertiary}
                  value={apSearchQuery}
                  onChangeText={setApSearchQuery}
                  autoFocus
                />
                <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.optionRow}>
                    {AP_COURSES
                      .filter((c) => c.toLowerCase().includes(apSearchQuery.toLowerCase()))
                      .map((course) => (
                        <TouchableOpacity
                          key={course}
                          style={[styles.pickChip, selectedAPCourse === course && styles.pickChipActive]}
                          onPress={() => {
                            setSelectedAPCourse(course);
                            setNewClassName(course);
                            setShowAPPicker(false);
                          }}
                        >
                          <Text style={[styles.pickChipText, selectedAPCourse === course && styles.pickChipTextActive]}>{course}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              </View>
            ) : (
              <View style={styles.modalCardLarge}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Create New Class</Text>
                  <TouchableOpacity onPress={closeClassModal}>
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Step Indicators */}
                <View style={styles.wizardSteps}>
                  {[1, 2, 3, 4].map((step) => (
                    <View key={step} style={styles.wizardStepRow}>
                      <View style={[
                        styles.wizardStepDot,
                        classStep >= step && { backgroundColor: colors.maroon, borderColor: colors.maroon },
                      ]}>
                        {classStep > step ? (
                          <Ionicons name="checkmark" size={12} color="white" />
                        ) : (
                          <Text style={[styles.wizardStepNum, classStep >= step && { color: 'white' }]}>{step}</Text>
                        )}
                      </View>
                      <Text style={[styles.wizardStepLabel, classStep >= step && { color: colors.maroon }]}>
                        {step === 1 ? 'Type' : step === 2 ? 'Schedule' : step === 3 ? 'Details' : 'Review'}
                      </Text>
                      {step < 4 && <View style={[styles.wizardStepLine, classStep > step && { backgroundColor: colors.maroon }]} />}
                    </View>
                  ))}
                </View>

                {tutorialGuide && showClassModal && (
                  <InlineTutorialCard
                    step={tutorialGuide.step}
                    totalSteps={TUTORIAL_TOTAL_STEPS}
                    title={tutorialGuide.title}
                    body={tutorialGuide.body}
                    onDismiss={onTutorialSkip}
                    onPrevious={tutorialStep > 1 ? onTutorialBack : undefined}
                    onNext={undefined}
                  />
                )}

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>

                  {/* Step 1: Template & Name */}
                  {classStep === 1 && (
                    <View>
                      <Text style={styles.wizardStepTitle}>What kind of class is this?</Text>

                      <Text style={styles.modalLabel}>Template</Text>
                      <View style={styles.optionRow}>
                        {(['Standard', 'AP Class'] as ClassTemplate[]).map((template) => (
                          <TouchableOpacity
                            key={template}
                            style={[styles.pickChip, newClassTemplate === template && styles.pickChipActive]}
                            onPress={() => {
                              setNewClassTemplate(template);
                              if (template === 'AP Class') { setShowAPPicker(true); setApSearchQuery(''); }
                              else { setSelectedAPCourse(null); setApSearchQuery(''); }
                            }}
                          >
                            <Text style={[styles.pickChipText, newClassTemplate === template && styles.pickChipTextActive]}>{template}</Text>
                          </TouchableOpacity>
                        ))}
                        {newClassTemplate === 'AP Class' && selectedAPCourse && (
                          <TouchableOpacity
                            style={[styles.pickChip, { borderColor: colors.maroon, backgroundColor: `${colors.maroon}12` }]}
                            onPress={() => { setShowAPPicker(true); setApSearchQuery(''); }}
                          >
                            <Text style={[styles.pickChipText, { color: colors.maroon }]}>{selectedAPCourse}</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {newClassTemplate === 'AP Class' && selectedAPCourse && (
                        <View style={styles.apUnitsToggle}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.apUnitsToggleTitle}>Include starter units?</Text>
                            <Text style={styles.apUnitsToggleSub}>
                              {includeAPUnits
                                ? `3 units with sections will be added from ${selectedAPCourse}`
                                : 'Class will start empty — add units later'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.apUnitsToggleBtn, includeAPUnits && styles.apUnitsToggleBtnActive]}
                            onPress={() => setIncludeAPUnits(!includeAPUnits)}
                          >
                            <View style={[styles.apUnitsToggleDot, includeAPUnits && styles.apUnitsToggleDotActive]} />
                          </TouchableOpacity>
                        </View>
                      )}
                      <Text style={styles.modalLabel}>Class Name</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={newClassName}
                        onChangeText={(text) => {
                          setNewClassName(text);
                          // Auto-detect AP class when typing in Standard mode
                          if (newClassTemplate === 'Standard') {
                            const trimmed = text.trim();
                            // Exact match → switch immediately
                            const exactMatch = AP_COURSES.find(
                              (c) => c.toLowerCase() === trimmed.toLowerCase()
                            );
                            if (exactMatch) {
                              setNewClassTemplate('AP Class');
                              setSelectedAPCourse(exactMatch);
                              setNewClassName('');
                              return;
                            }
                            // Unique prefix match (e.g. "AP Bio" → "AP Biology")
                            if (trimmed.length >= 5) {
                              const prefixMatches = AP_COURSES.filter(
                                (c) => c.toLowerCase().startsWith(trimmed.toLowerCase())
                              );
                              if (prefixMatches.length === 1) {
                                setNewClassTemplate('AP Class');
                                setSelectedAPCourse(prefixMatches[0]);
                                setNewClassName('');
                                return;
                              }
                            }
                            // Starts with "AP " → switch to AP template and open picker
                            if (/^ap\s+/i.test(trimmed) && trimmed.length >= 3) {
                              setNewClassTemplate('AP Class');
                              setApSearchQuery(trimmed.replace(/^ap\s+/i, ''));
                              setShowAPPicker(true);
                              setNewClassName('');
                              return;
                            }
                          }
                        }}
                        placeholder="Ex: AP Physics"
                        placeholderTextColor={colors.textTertiary}
                      />

                      <View style={styles.wizardNavRow}>
                        <TouchableOpacity
                          style={[
                            styles.modalSaveBtn,
                            styles.wizardNextBtn,
                            tutorialStep > 0 && styles.tutorialTargetButton,
                          ]}
                          onPress={() => {
                            setClassStep(2);
                          }}
                        >
                          <Text style={styles.modalSaveBtnText}>Next</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Step 2: Block & Style */}
                  {classStep === 2 && (
                    <View>
                      <Text style={styles.wizardStepTitle}>Set your schedule & style</Text>

                      <Text style={styles.modalLabel}>Block</Text>
                      <View style={styles.optionRow}>
                        {blocks.map((block) => (
                          <TouchableOpacity
                            key={block}
                            style={[styles.pickChip, newClassBlock === block && styles.pickChipActive]}
                            onPress={() => setNewClassBlock(block)}
                          >
                            <Text style={[styles.pickChipText, newClassBlock === block && styles.pickChipTextActive]}>{block}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

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

                      <Text style={styles.modalLabel}>Class Background Image</Text>
                      <TouchableOpacity style={styles.imagePickerBtn} onPress={pickClassImage}>
                        <Ionicons name="image" size={16} color={colors.maroon} />
                        <Text style={styles.imagePickerBtnText}>Upload Background</Text>
                      </TouchableOpacity>
                      {newClassImage && <Image source={{ uri: newClassImage }} style={styles.newClassImagePreview} />}

                      <Text style={styles.modalLabel}>Teacher</Text>
                      <TextInput
                        style={[styles.modalInput, { marginTop: 4 }]}
                        placeholder="e.g. Mr. Smith"
                        placeholderTextColor={colors.textTertiary}
                        value={newClassTeacher}
                        onChangeText={setNewClassTeacher}
                      />
                      {!newClassTeacher.trim() && (
                        <Text style={{ fontSize: 11, fontFamily: fonts.regular, color: '#dc2626', marginTop: 4 }}>
                          Teacher name is required
                        </Text>
                      )}

                      <View style={styles.wizardNavRow}>
                        <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setClassStep(1)}>
                          <Text style={styles.wizardBackBtnText}>← Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modalSaveBtn,
                            styles.wizardNextBtn,
                            tutorialStep > 0 && styles.tutorialTargetButton,
                            !newClassTeacher.trim() && { opacity: 0.5 },
                          ]}
                          onPress={() => {
                            setClassStep(3);
                          }}
                          disabled={!newClassTeacher.trim()}
                        >
                          <Text style={styles.modalSaveBtnText}>Next</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Step 3: Focus & School */}
                  {classStep === 3 && (
                    <View>
                      <Text style={styles.wizardStepTitle}>Customize your class</Text>

                      <Text style={styles.modalLabel}>Primary Focus</Text>
                      <View style={styles.optionRow}>
                        {classGoals.map((goal) => (
                          <TouchableOpacity
                            key={goal}
                            style={[styles.pickChip, newClassGoal === goal && styles.pickChipActive]}
                            onPress={() => setNewClassGoal(goal)}
                          >
                            <Text style={[styles.pickChipText, newClassGoal === goal && styles.pickChipTextActive]}>{goal}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {schools && schools.length > 0 && (
                        <>
                          <Text style={styles.modalLabel}>School (optional)</Text>
                          <View style={styles.optionRow}>
                            <TouchableOpacity
                              style={[styles.pickChip, !newClassSchool && styles.pickChipActive]}
                              onPress={() => setNewClassSchool('')}
                            >
                              <Text style={[styles.pickChipText, !newClassSchool && styles.pickChipTextActive]}>None</Text>
                            </TouchableOpacity>
                            {schools.map((s) => (
                              <TouchableOpacity
                                key={s}
                                style={[styles.pickChip, newClassSchool === s && styles.pickChipActive]}
                                onPress={() => setNewClassSchool(s)}
                              >
                                <Text style={[styles.pickChipText, newClassSchool === s && styles.pickChipTextActive]}>{s}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      <View style={styles.wizardNavRow}>
                        <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setClassStep(2)}>
                          <Text style={styles.wizardBackBtnText}>← Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modalSaveBtn,
                            styles.wizardNextBtn,
                            tutorialStep > 0 && styles.tutorialTargetButton,
                          ]}
                          onPress={() => {
                            setClassStep(4);
                          }}
                        >
                          <Text style={styles.modalSaveBtnText}>Next</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Step 4: Review & Confirm */}
                  {classStep === 4 && (
                    <View>
                      <Text style={styles.wizardStepTitle}>Review your class</Text>

                      <View style={styles.wizardPreviewCard}>
                        <View style={styles.wizardPreviewRow}>
                          <Text style={styles.wizardPreviewLabel}>Name</Text>
                          <Text style={styles.wizardPreviewValue} numberOfLines={1}>{newClassName || 'New Class'}</Text>
                        </View>
                        <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                          <Text style={styles.wizardPreviewLabel}>Template</Text>
                          <Text style={styles.wizardPreviewValue}>{newClassTemplate}{selectedAPCourse ? ` • ${selectedAPCourse}` : ''}</Text>
                        </View>
                        {newClassTemplate === 'AP Class' && selectedAPCourse && (
                          <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                            <Text style={styles.wizardPreviewLabel}>Starter Units</Text>
                            <Text style={styles.wizardPreviewValue}>{includeAPUnits ? '3 units included' : 'None (empty class)'}</Text>
                          </View>
                        )}
                        <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                          <Text style={styles.wizardPreviewLabel}>Block</Text>
                          <Text style={styles.wizardPreviewValue}>{newClassBlock}</Text>
                        </View>
                        <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                          <Text style={styles.wizardPreviewLabel}>Focus</Text>
                          <Text style={styles.wizardPreviewValue}>{newClassGoal}</Text>
                        </View>
                        <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                          <Text style={styles.wizardPreviewLabel}>Color</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: newClassColor }} />
                          </View>
                        </View>
                        {newClassSchool ? (
                          <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                            <Text style={styles.wizardPreviewLabel}>School</Text>
                            <Text style={styles.wizardPreviewValue}>{newClassSchool}</Text>
                          </View>
                        ) : null}
                        {newClassTeacher.trim() ? (
                          <View style={[styles.wizardPreviewRow, { marginTop: 12 }]}>
                            <Text style={styles.wizardPreviewLabel}>Teacher</Text>
                            <Text style={styles.wizardPreviewValue}>{newClassTeacher.trim()}</Text>
                          </View>
                        ) : null}
                        {newClassImage ? (
                          <View style={{ marginTop: 12 }}>
                            <Text style={styles.wizardPreviewLabel}>Background</Text>
                            <Image source={{ uri: newClassImage }} style={{ height: 80, borderRadius: 14, marginTop: 6 }} />
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.wizardNavRow}>
                        <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setClassStep(3)}>
                          <Text style={styles.wizardBackBtnText}>← Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modalSaveBtn,
                            styles.wizardNextBtn,
                            tutorialStep > 0 && styles.tutorialTargetButton,
                          ]}
                          onPress={saveNewClass}
                        >
                          <Text style={styles.modalSaveBtnText}>Create Class</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                </ScrollView>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Task Modal */}
      <Modal visible={!!editingTask} transparent animationType="fade" onRequestClose={() => setEditingTask(null)}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <TouchableOpacity onPress={() => setEditingTask(null)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalInput}
                value={editTaskTitle}
                onChangeText={setEditTaskTitle}
                placeholder="Task name"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              <Text style={styles.modalLabel}>Class</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  style={[styles.taskClassChip, !editTaskClassId && styles.taskClassChipActive]}
                  onPress={() => setEditTaskClassId(null)}
                >
                  <Text style={[styles.taskClassChipText, !editTaskClassId && styles.taskClassChipTextActive]}>None</Text>
                </TouchableOpacity>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.taskClassChip, editTaskClassId === cls.id && styles.taskClassChipActive]}
                    onPress={() => setEditTaskClassId(cls.id)}
                  >
                    <Text style={[styles.taskClassChipText, editTaskClassId === cls.id && styles.taskClassChipTextActive]}>{cls.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.dueDatePickerBtn, { marginTop: 12 }]}
                onPress={() => setShowEditTaskDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={14} color={editTaskDueDate ? '#b45309' : colors.textTertiary} />
                <Text style={[styles.dueDatePickerText, editTaskDueDate && { color: '#b45309' }]}>
                  {editTaskDueDate ? `Due ${formatDueDate(editTaskDueDate)}` : 'Set due date'}
                </Text>
                {editTaskDueDate && (
                  <TouchableOpacity onPress={() => setEditTaskDueDate(null)} hitSlop={6}>
                    <Ionicons name="close-circle" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={showEditTaskDatePicker}
                mode="date"
                onConfirm={(date) => {
                  setEditTaskDueDate(date.toISOString());
                  setShowEditTaskDatePicker(false);
                }}
                onCancel={() => setShowEditTaskDatePicker(false)}
              />
              <TouchableOpacity
                style={[styles.modalSaveBtn, { marginTop: 16 }, !editTaskTitle.trim() && { opacity: 0.5 }]}
                onPress={saveEditTask}
                disabled={!editTaskTitle.trim()}
              >
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F2' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: 'white',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  avatar: { width: '100%', height: '100%' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 20, height: 54, gap: 12, borderWidth: 2, borderColor: '#F0E0D0' },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0, fontFamily: fonts.medium },
  filterBtn: { width: 54, height: 54, borderRadius: 20, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#7f1d1d' },
  filterMenu: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 14,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFF5ED' },
  filterChipActive: { backgroundColor: colors.maroon },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  filterChipTextActive: { color: 'white' },
  searchResultsBox: {
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF5ED',
  },
  searchResultIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center' },
  searchResultInfo: { flex: 1 },
  searchResultTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  searchResultSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  searchEmpty: { padding: 14, textAlign: 'center', color: colors.textSecondary, fontFamily: fonts.medium },
  sectionTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  tutorialCard: {
    marginTop: 16,
    marginBottom: 2,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFF5ED',
    borderWidth: 2,
    borderColor: '#F0D2B6',
  },
  tutorialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tutorialEyebrow: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.maroon,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tutorialTitle: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  tutorialSkip: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  tutorialBody: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  tutorialFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tutorialStepLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  tutorialProgressRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  tutorialProgressDot: {
    width: 16,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E8D8C8',
  },
  tutorialProgressDotActive: {
    backgroundColor: colors.maroon,
  },
  shortcuts: { marginTop: 10 },
  shortcutsContent: { paddingRight: 24, gap: 12, flexDirection: 'row', alignItems: 'center' },
  shortcutAdd: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 20, borderWidth: 2, borderColor: '#F0E0D0' },
  shortcutLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary, maxWidth: 130 },
  shortcutOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EDE5',
  },
  shortcutOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutOptionLabel: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  shortcutOptionSub: { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 1 },
  carouselHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, paddingHorizontal: 0 },
  classesHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carouselHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  joinClassBtn: {
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.maroon,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinClassBtnText: { fontSize: 11, fontFamily: fonts.bold, color: 'white' },
  counter: { fontSize: 12, color: colors.textTertiary, fontFamily: fonts.medium },
  carouselContent: { paddingRight: 24, gap: CARD_GAP, marginTop: 12 },
  classCard: {
    height: 404,
    borderRadius: 32,
    overflow: 'hidden',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  addCard: { backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0D0', borderStyle: 'dashed' },
  addCardInner: { flex: 1, position: 'relative', alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  tutorialTargetCard: {
    borderWidth: 3,
    borderColor: '#C0761E',
    shadowColor: '#C0761E',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tutorialTargetBadge: {
    position: 'absolute',
    top: 28,
    alignSelf: 'center',
    zIndex: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.maroon,
  },
  tutorialTargetBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: 'white',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  addCardIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: `${colors.maroon}14`, alignItems: 'center', justifyContent: 'center' },
  addCardTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  addCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', fontFamily: fonts.regular },
  addCardPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  addCardPill: { backgroundColor: '#FFF5ED', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2, borderColor: '#F0E0D0' },
  addCardPillText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.semiBold },
  classImage: { ...StyleSheet.absoluteFillObject },
  classOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.46)' },
  heartBtn: { position: 'absolute', top: 20, right: 20, width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  trashBtn: { position: 'absolute', top: 20, left: 20, width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  tutorialClassBadge: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF8F2',
    zIndex: 12,
  },
  tutorialClassBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.maroon,
  },
  classFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 },
  classBlock: { fontSize: 12, fontFamily: fonts.semiBold, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5 },
  classTitle: { fontSize: 28, fontFamily: fonts.bold, color: 'white', marginTop: 4, letterSpacing: -0.5 },
  classDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6, fontFamily: fonts.regular },
  classMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  classMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  classMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.82)', fontFamily: fonts.medium },
  classHighlights: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  classHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  classHighlightText: { fontSize: 10, fontFamily: fonts.bold, color: 'white' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8D8C8' },
  dotActive: { width: 28, backgroundColor: colors.maroon, borderRadius: 5 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statCardClasses: {
    backgroundColor: '#FFF5ED',
    borderColor: '#F0D2B6',
    shadowColor: colors.maroon,
  },
  statCardDocs: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    shadowColor: '#2563eb',
  },
  statCardFriends: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    shadowColor: '#059669',
  },
  statIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statIconClasses: { backgroundColor: `${colors.maroon}18` },
  statIconDocs: { backgroundColor: '#DBEAFE' },
  statIconFriends: { backgroundColor: '#D1FAE5' },
  statValue: { fontSize: 24, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  schoolBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    backgroundColor: '#FFF5ED',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F0D2B6',
  },
  schoolBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${colors.maroon}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolBannerLabel: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  schoolBannerName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 1,
  },
  modalKeyboard: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: 34 },
  modalCardLarge: { flexShrink: 1, backgroundColor: '#FFF8F2', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: 38, maxHeight: '86%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  modalScroll: { marginTop: 10, marginBottom: 16, flexShrink: 1 },
  modalLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  modalInput: { height: 52, borderRadius: 18, borderWidth: 2, borderColor: '#F0E0D0', backgroundColor: 'white', paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary, fontFamily: fonts.medium },
  modalSaveBtn: { marginTop: 16, height: 54, borderRadius: 20, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  tutorialTargetButton: {
    borderWidth: 2,
    borderColor: '#F3D3A7',
    shadowColor: '#B45309',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalSaveBtnText: { color: 'white', fontSize: 15, fontFamily: fonts.bold },
  joinHint: { marginTop: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 18, fontFamily: fonts.regular },
  joinStatus: { marginTop: 8, fontSize: 12, fontFamily: fonts.bold, color: '#b91c1c' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFF5ED', borderWidth: 2, borderColor: '#F0E0D0' },
  optionChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  optionChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  optionChipTextActive: { color: 'white' },
  pickChip: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 2, borderColor: '#F0E0D0', backgroundColor: 'white' },
  pickChipActive: { borderColor: colors.maroon, backgroundColor: `${colors.maroon}12` },
  pickChipText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.semiBold },
  pickChipTextActive: { color: colors.maroon },
  imagePickerBtn: {
    marginTop: 4,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${colors.maroon}40`,
    backgroundColor: `${colors.maroon}10`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  imagePickerBtnText: { fontSize: 13, color: colors.maroon, fontFamily: fonts.bold },
  newClassImagePreview: {
    marginTop: 8,
    width: '100%',
    height: 110,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
  },
  colorRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  colorDot: { width: 30, height: 30, borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#111' },
  // === Schedule & Tasks ===
  blockCard: {
    width: 100,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#F0E0D0',
    alignItems: 'center',
  },
  blockLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textTertiary, letterSpacing: 0.5 },
  blockClass: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary, marginTop: 4, textAlign: 'center' },
  schedSubTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.maroon,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  addTaskBtnText: { color: 'white', fontSize: 12, fontFamily: fonts.bold },
  emptyTasks: {
    marginTop: 14,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  emptyTasksText: { fontSize: 13, color: colors.textTertiary, fontFamily: fonts.medium, textAlign: 'center' },

  // Block Manager Modal
  blockModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  blockModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    minHeight: 200,
  },
  blockModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0D0C8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  blockModalTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  blockModalSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    marginTop: 2,
    marginBottom: 16,
  },
  blockModalClassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0EB',
  },
  blockModalClassDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  blockModalClassName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  blockModalClassTeacher: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  blockMoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E0D8',
    backgroundColor: '#FAFAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockMoveBtnActive: {
    borderColor: colors.maroon,
    backgroundColor: `${colors.maroon}12`,
  },
  blockMoveBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  blockMoveBtnTextActive: {
    color: colors.maroon,
  },
  blockMoveConfirm: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockModalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: `${colors.maroon}25`,
    backgroundColor: `${colors.maroon}06`,
  },
  blockModalAddBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.maroon,
  },
  apUnitsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF5ED',
    borderWidth: 1.5,
    borderColor: '#F0E0D0',
  },
  apUnitsToggleTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  apUnitsToggleSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  apUnitsToggleBtn: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D9D0C8',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  apUnitsToggleBtnActive: {
    backgroundColor: colors.maroon,
  },
  apUnitsToggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'white',
  },
  apUnitsToggleDotActive: {
    alignSelf: 'flex-end',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
  },
  taskRowDone: { opacity: 0.55 },
  taskCheck: { width: 28 },
  taskTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  taskTitleDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  taskClassPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  taskClassPillText: { fontSize: 10, fontFamily: fonts.bold },
  taskDate: { fontSize: 10, color: colors.textTertiary, fontFamily: fonts.medium },
  addTaskRow: {
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E0D0',
    padding: 14,
  },
  addTaskInput: { height: 44, borderRadius: 14, borderWidth: 2, borderColor: '#F0E0D0', paddingHorizontal: 14, fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary },
  taskClassChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 2, borderColor: '#F0E0D0', backgroundColor: '#FFF5ED' },
  taskClassChipActive: { borderColor: colors.maroon, backgroundColor: `${colors.maroon}12` },
  taskClassChipText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textSecondary },
  taskClassChipTextActive: { color: colors.maroon },
  cancelTaskBtn: { flex: 1, height: 42, borderRadius: 14, backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center' },
  cancelTaskBtnText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  saveTaskBtn: { flex: 1, height: 42, borderRadius: 14, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  saveTaskBtnText: { fontSize: 13, fontFamily: fonts.bold, color: 'white' },
  dueDatePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: '#fef3c7' },
  dueDateText: { fontSize: 10, fontFamily: fonts.bold, color: '#b45309' },
  dueDatePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFF5ED', borderWidth: 2, borderColor: '#F0E0D0' },
  dueDatePickerText: { fontSize: 12, fontFamily: fonts.medium, color: colors.textTertiary },

  // === Wizard Steps (Create Class) ===
  wizardSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
    marginTop: 2,
  },
  wizardStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wizardStepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0D0C0',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardStepNum: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textTertiary,
  },
  wizardStepLabel: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
  },
  wizardStepLine: {
    width: 14,
    height: 2,
    backgroundColor: '#E0D0C0',
    borderRadius: 1,
    marginHorizontal: 1,
  },
  wizardStepTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 4,
  },
  wizardNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  wizardNextBtn: {
    flex: 1,
    marginTop: 0,
  },
  wizardBackBtn: {
    height: 54,
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
    borderRadius: 20,
    padding: 18,
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
});
