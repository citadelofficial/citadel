import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SignInScreen } from './screens/SignInScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CourseDetailScreen } from './screens/CourseDetailScreen';
import { FilesScreen } from './screens/FilesScreen';
import { ScanScreen } from './screens/ScanScreen';
import { FriendsScreen } from './screens/FriendsScreen';

export type Screen = 'splash' | 'onboarding' | 'signin' | 'home' | 'course-detail' | 'files' | 'scan' | 'friends';

export interface UserData {
  name: string;
  grade: string;
  school: string;
  profilePicture: string | null;
}

export interface FileData {
  id: number;
  name: string;
  date: string;
  thumbnail: string;
  pages: number;
  size: string;
  readTime: string;
  previewTitle: string;
  previewText: string;
}

export interface SubUnitNote {
  id: number;
  title: string;
  author: string;
  date: string;
  pages: number;
  content: string;
}

export interface SubUnit {
  id: string;
  title: string;
  notes: SubUnitNote[];
}

export interface UnitData {
  id: number;
  title: string;
  pages: number;
  collaborators: number;
  examDate: string;
  daysLeft: number;
  subUnits: SubUnit[];
}

export interface ClassData {
  id: string;
  title: string;
  block: string;
  image: string;
  classmates: number;
  documents: number;
  color: string;
  description: string;
  files: FileData[];
  units: UnitData[];
}

const defaultClasses: ClassData[] = [
  {
    id: '1',
    title: 'AP Human Geography',
    block: 'Block 4',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=500&fit=crop',
    classmates: 15,
    documents: 42,
    color: '#3D0C11',
    description: 'Unit 6 - Cities and Urban Land Use',
    files: [
      {
        id: 1, name: 'AP_HUG_Unit3.pdf', date: '01/31/2026',
        thumbnail: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=120&h=80&fit=crop',
        pages: 5, size: '2.4MB', readTime: '4 Min Read',
        previewTitle: 'Geography as a Field of Study',
        previewText: 'Geography is the study of the physical features of the earth and its atmosphere, as well as human activity as it affects and is affected by these. The discipline encompasses the study of patterns and processes associated with the natural environment and human society...',
      },
      {
        id: 2, name: 'AP_HUG_Unit2.pdf', date: '12/19/2025',
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&h=80&fit=crop',
        pages: 8, size: '3.1MB', readTime: '6 Min Read',
        previewTitle: 'Population and Migration Patterns',
        previewText: 'Population geography examines the distribution, composition, and growth of populations in relation to the nature of places. Key concepts include population density, demographic transition, and push-pull factors of migration...',
      },
      {
        id: 3, name: 'AP_HUG_Unit1.pdf', date: '11/05/2025',
        thumbnail: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=120&h=80&fit=crop',
        pages: 6, size: '1.8MB', readTime: '3 Min Read',
        previewTitle: 'Thinking Geographically',
        previewText: 'This introductory unit covers the foundational concepts of human geography including maps, spatial analysis, and geographic tools used to analyze populations and landscapes...',
      },
    ],
    units: [
      {
        id: 1, title: 'Unit 1', pages: 8, collaborators: 9, examDate: '04/20/2026', daysLeft: 85,
        subUnits: [
          { id: '1.1', title: '1.1 Introduction to Geography', notes: [
            { id: 101, title: 'Geography Overview Notes', author: 'Zara Ramadan', date: '01/15/2026', pages: 3, content: 'Geography is the study of places and the relationships between people and their environments. Geographers explore both the physical properties of Earth\'s surface and the human societies spread across it.' },
            { id: 102, title: 'Map Types & Projections', author: 'Jack Swartz', date: '01/18/2026', pages: 2, content: 'Different map projections include Mercator, Robinson, and Peters. Each distorts some aspect of the globe—shape, area, distance, or direction—when representing it on a flat surface.' },
          ]},
          { id: '1.2', title: '1.2 Geographic Tools & Methods', notes: [
            { id: 103, title: 'GIS and Remote Sensing', author: 'Annika Shah', date: '01/20/2026', pages: 4, content: 'Geographic Information Systems (GIS) allow us to visualize, question, analyze, and interpret data to understand relationships, patterns, and trends. Remote sensing uses satellite imagery to gather data.' },
          ]},
          { id: '1.3', title: '1.3 Scale of Analysis', notes: [] },
        ],
      },
      {
        id: 2, title: 'Unit 2', pages: 12, collaborators: 7, examDate: '05/15/2026', daysLeft: 110,
        subUnits: [
          { id: '2.1', title: '2.1 Population Distribution', notes: [
            { id: 201, title: 'World Population Density', author: 'Will Caling', date: '02/01/2026', pages: 3, content: 'Population distribution is uneven across the globe. Major population clusters include East Asia, South Asia, and Europe. Factors include climate, resources, and historical development patterns.' },
          ]},
          { id: '2.2', title: '2.2 Population Growth', notes: [
            { id: 202, title: 'Demographic Transition Model', author: 'Zara Ramadan', date: '02/05/2026', pages: 5, content: 'The DTM describes population change over time through five stages, from high birth/death rates to low birth/death rates. Countries progress through stages as they industrialize and develop.' },
          ]},
          { id: '2.3', title: '2.3 Migration Patterns', notes: [] },
        ],
      },
      {
        id: 3, title: 'Unit 3', pages: 6, collaborators: 11, examDate: '06/01/2026', daysLeft: 127,
        subUnits: [
          { id: '3.1', title: '3.1 Cultural Landscapes', notes: [] },
          { id: '3.2', title: '3.2 Cultural Diffusion', notes: [
            { id: 301, title: 'Types of Diffusion', author: 'Nick Burrus', date: '02/20/2026', pages: 2, content: 'Cultural diffusion includes relocation, expansion, hierarchical, contagious, and stimulus diffusion. Each describes how cultural traits spread from their origin to other places.' },
          ]},
        ],
      },
      {
        id: 4, title: 'Unit 4', pages: 10, collaborators: 5, examDate: '06/20/2026', daysLeft: 146,
        subUnits: [
          { id: '4.1', title: '4.1 Political Geography', notes: [] },
          { id: '4.2', title: '4.2 Boundaries & Borders', notes: [] },
        ],
      },
    ],
  },
  {
    id: '2',
    title: 'AP Biology',
    block: 'Block 2',
    image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&h=500&fit=crop',
    classmates: 22,
    documents: 28,
    color: '#065f46',
    description: 'Unit 4 - Cell Communication',
    files: [
      {
        id: 10, name: 'AP_Bio_Unit4.pdf', date: '02/10/2026',
        thumbnail: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=120&h=80&fit=crop',
        pages: 7, size: '3.2MB', readTime: '5 Min Read',
        previewTitle: 'Cell Communication and Signaling',
        previewText: 'Cell communication involves signal transduction pathways that allow cells to receive, process, and respond to information from other cells. This includes ligand-receptor interactions, secondary messengers, and feedback mechanisms...',
      },
      {
        id: 11, name: 'AP_Bio_Unit3.pdf', date: '01/15/2026',
        thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=120&h=80&fit=crop',
        pages: 10, size: '4.1MB', readTime: '7 Min Read',
        previewTitle: 'Cellular Energetics',
        previewText: 'Cellular energetics covers the processes of photosynthesis and cellular respiration. ATP is the primary energy currency of the cell, produced through glycolysis, the Krebs cycle, and oxidative phosphorylation...',
      },
      {
        id: 12, name: 'AP_Bio_Unit2.pdf', date: '12/01/2025',
        thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=120&h=80&fit=crop',
        pages: 9, size: '2.8MB', readTime: '6 Min Read',
        previewTitle: 'Cell Structure and Function',
        previewText: 'Eukaryotic cells contain membrane-bound organelles including the nucleus, mitochondria, endoplasmic reticulum, and Golgi apparatus. Each organelle has specific functions that contribute to cell homeostasis...',
      },
    ],
    units: [
      {
        id: 1, title: 'Unit 1', pages: 9, collaborators: 12, examDate: '03/25/2026', daysLeft: 60,
        subUnits: [
          { id: '1.1', title: '1.1 Chemistry of Life', notes: [
            { id: 1001, title: 'Water & Macromolecules', author: 'Annika Shah', date: '01/10/2026', pages: 4, content: 'Water is essential for life due to its properties: cohesion, adhesion, high specific heat, and solvent capabilities. The four macromolecules—carbohydrates, lipids, proteins, and nucleic acids—are the building blocks of life.' },
          ]},
          { id: '1.2', title: '1.2 Structure of Water', notes: [] },
        ],
      },
      {
        id: 2, title: 'Unit 2', pages: 11, collaborators: 8, examDate: '04/10/2026', daysLeft: 76,
        subUnits: [
          { id: '2.1', title: '2.1 Cell Structure', notes: [
            { id: 1002, title: 'Organelle Functions', author: 'Jack Swartz', date: '01/22/2026', pages: 5, content: 'The nucleus contains DNA and controls cell activities. Mitochondria produce ATP through cellular respiration. The endoplasmic reticulum processes proteins (rough ER) and lipids (smooth ER).' },
          ]},
          { id: '2.2', title: '2.2 Cell Membranes', notes: [] },
        ],
      },
      {
        id: 3, title: 'Unit 3', pages: 14, collaborators: 10, examDate: '05/01/2026', daysLeft: 97,
        subUnits: [
          { id: '3.1', title: '3.1 Enzyme Structure', notes: [] },
          { id: '3.2', title: '3.2 Environmental Impacts on Enzymes', notes: [] },
        ],
      },
    ],
  },
  {
    id: '3',
    title: 'DE English',
    block: 'Block 6',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=500&fit=crop',
    classmates: 18,
    documents: 19,
    color: '#92400e',
    description: 'Essay 3 - Rhetorical Analysis',
    files: [
      {
        id: 20, name: 'DE_ENG_Essay3.pdf', date: '02/05/2026',
        thumbnail: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=120&h=80&fit=crop',
        pages: 4, size: '1.5MB', readTime: '3 Min Read',
        previewTitle: 'Rhetorical Analysis Essay',
        previewText: 'This essay analyzes the rhetorical strategies employed in Martin Luther King Jr.\'s "Letter from Birmingham Jail," examining his use of ethos, pathos, and logos to persuade his audience of the moral imperative of civil disobedience...',
      },
      {
        id: 21, name: 'DE_ENG_Essay2.pdf', date: '01/08/2026',
        thumbnail: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120&h=80&fit=crop',
        pages: 6, size: '1.9MB', readTime: '4 Min Read',
        previewTitle: 'Comparative Literature Analysis',
        previewText: 'A comparative study of themes of identity and belonging in "The Great Gatsby" and "Their Eyes Were Watching God," exploring how each author uses narrative voice and symbolism to convey meaning...',
      },
      {
        id: 22, name: 'DE_ENG_Essay1.pdf', date: '11/20/2025',
        thumbnail: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=120&h=80&fit=crop',
        pages: 3, size: '1.1MB', readTime: '2 Min Read',
        previewTitle: 'Personal Narrative',
        previewText: 'A personal narrative exploring the intersection of cultural heritage and modern identity, reflecting on formative experiences that shaped the author\'s worldview and academic pursuits...',
      },
    ],
    units: [
      {
        id: 1, title: 'Essay 1', pages: 3, collaborators: 4, examDate: '03/15/2026', daysLeft: 50,
        subUnits: [
          { id: '1.1', title: '1.1 Thesis Development', notes: [
            { id: 2001, title: 'Crafting a Strong Thesis', author: 'Paul Van Haver', date: '01/05/2026', pages: 2, content: 'A strong thesis statement should be specific, arguable, and provide a roadmap for the essay. It should address the "so what?" question and guide the reader through your argument.' },
          ]},
          { id: '1.2', title: '1.2 Evidence & Analysis', notes: [] },
        ],
      },
      {
        id: 2, title: 'Essay 2', pages: 6, collaborators: 6, examDate: '04/20/2026', daysLeft: 86,
        subUnits: [
          { id: '2.1', title: '2.1 Comparative Methods', notes: [] },
          { id: '2.2', title: '2.2 Literary Devices', notes: [
            { id: 2002, title: 'Symbolism & Imagery Notes', author: 'Zara Ramadan', date: '01/25/2026', pages: 3, content: 'Symbolism uses objects, figures, or colors to represent abstract ideas. Imagery appeals to the five senses to create vivid descriptions. Both are powerful tools for literary analysis.' },
          ]},
        ],
      },
      {
        id: 3, title: 'Essay 3', pages: 4, collaborators: 5, examDate: '05/10/2026', daysLeft: 106,
        subUnits: [
          { id: '3.1', title: '3.1 Rhetorical Strategies', notes: [] },
          { id: '3.2', title: '3.2 Audience Analysis', notes: [] },
        ],
      },
    ],
  },
];

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [direction, setDirection] = useState(1);
  const [userData, setUserData] = useState<UserData>({ name: '', grade: '', school: '', profilePicture: null });
  const [classes, setClasses] = useState<ClassData[]>(defaultClasses);
  const [selectedClassId, setSelectedClassId] = useState<string>('1');

  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setDirection(1);
        setCurrentScreen('onboarding');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const navigate = (screen: Screen, dir: number = 1) => {
    setDirection(dir);
    setCurrentScreen(screen);
  };

  const handleOnboardingComplete = (data: { name: string; grade: string; school: string }) => {
    setUserData((prev) => ({ ...prev, ...data }));
    navigate('signin');
  };

  const handleSignIn = (profilePicture: string | null, displayName?: string) => {
    setUserData((prev) => ({
      ...prev,
      profilePicture,
      ...(displayName !== undefined ? { name: displayName } : {}),
    }));
    navigate('home');
  };

  const handleAddClass = (newClass: ClassData) => {
    setClasses((prev) => [...prev, newClass]);
  };

  const handleRemoveClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateClass = (updatedClass: ClassData) => {
    setClasses((prev) => prev.map((c) => c.id === updatedClass.id ? updatedClass : c));
  };

  const handleOpenCourse = (classId: string) => {
    setSelectedClassId(classId);
    navigate('course-detail');
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const variants = {
    enter: (d: number) => ({
      x: d > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a] p-4">
      <div className="relative w-[393px] h-[852px] bg-bg-secondary rounded-[3rem] overflow-hidden shadow-2xl border-[8px] border-[#222]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentScreen}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.35, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {currentScreen === 'splash' && <SplashScreen />}
            {currentScreen === 'onboarding' && (
              <OnboardingScreen onGetStarted={handleOnboardingComplete} />
            )}
            {currentScreen === 'signin' && (
              <SignInScreen
                onSignIn={handleSignIn}
                onBack={() => navigate('onboarding', -1)}
                userName={userData.name}
              />
            )}
            {currentScreen === 'home' && (
              <HomeScreen
                onCourseOpen={handleOpenCourse}
                onFilesOpen={() => navigate('files')}
                onScanOpen={() => navigate('scan')}
                onFriendsOpen={() => navigate('friends')}
                userName={userData.name}
                profilePicture={userData.profilePicture}
                classes={classes}
                onAddClass={handleAddClass}
                onRemoveClass={handleRemoveClass}
              />
            )}
            {currentScreen === 'course-detail' && selectedClass && (
              <CourseDetailScreen
                classData={selectedClass}
                onBack={() => navigate('home', -1)}
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
                onBack={() => navigate('course-detail', -1)}
                onHome={() => navigate('home', -1)}
                onScan={() => navigate('scan')}
                onFriends={() => navigate('friends')}
              />
            )}
            {currentScreen === 'scan' && (
              <ScanScreen
                onHome={() => navigate('home', -1)}
                onFiles={() => navigate('files')}
                onFriends={() => navigate('friends')}
              />
            )}
            {currentScreen === 'friends' && (
              <FriendsScreen
                onHome={() => navigate('home', -1)}
                onScan={() => navigate('scan', -1)}
                onFiles={() => navigate('files')}
                profilePicture={userData.profilePicture}
                userName={userData.name}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
