import type { ClassData, SubUnit } from '../types';

type CourseKey = 'hug' | 'bio' | 'eng';

const authorPools: Record<CourseKey, string[]> = {
  hug: ['Laasya Potuluri', 'Anya Vulupala', 'Andrew Boldea', 'Saraa Rana'],
  bio: ['Risha Guru', 'Annika Shah', 'Jack Swartz', 'Will Caling'],
  eng: ['Catalina Nemes', 'Roshan Shah', 'Zayyan Masud', 'Laasya Potuluri'],
};

let noteIdSeed = 1000;

function sectionNotes(course: CourseKey, sectionTitle: string, sectionIndex: number) {
  const baseTitle = sectionTitle.replace(/^\d+\.\d+\s*/, '');
  const pool = authorPools[course];
  const authorA = pool[sectionIndex % pool.length];
  const authorB = pool[(sectionIndex + 1) % pool.length];
  const dayA = String((sectionIndex % 9) + 1).padStart(2, '0');
  const dayB = String(((sectionIndex + 2) % 9) + 10).padStart(2, '0');

  return [
    {
      id: noteIdSeed++,
      title: `${baseTitle} - Core Guide`,
      author: authorA,
      date: `02/${dayA}/2026`,
      pages: 2,
      content: `Key ideas for ${baseTitle}: vocabulary, diagrams, and a concise summary for fast review before quizzes.`,
    },
    {
      id: noteIdSeed++,
      title: `${baseTitle} - Practice Notes`,
      author: authorB,
      date: `02/${dayB}/2026`,
      pages: 2,
      content: `Worked examples and common mistakes for ${baseTitle}, plus short checkpoints to verify understanding.`,
    },
  ];
}

function withSeededNotes(course: CourseKey, subUnits: SubUnit[]) {
  return subUnits.map((subUnit, index) => ({
    ...subUnit,
    notes: sectionNotes(course, subUnit.title, index),
  }));
}

export const defaultClasses: ClassData[] = [
  {
    id: '1',
    title: 'AP Human Geography',
    block: 'Block 4',
    classCode: 'HUG-4B9P',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=500&fit=crop',
    classmates: 15,
    documents: 42,
    color: '#3D0C11',
    description: 'Unit 6 - Cities and Urban Land Use',
    files: [
      {
        id: 1,
        name: 'AP_HUG_Unit3.pdf',
        date: '01/31/2026',
        thumbnail: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=120&h=80&fit=crop',
        pages: 5,
        size: '2.4MB',
        readTime: '4 Min Read',
        previewTitle: 'Geography as a Field of Study',
        previewText: 'Geography is the study of the physical features of the earth and its atmosphere...',
      },
      {
        id: 2,
        name: 'AP_HUG_Unit2.pdf',
        date: '12/19/2025',
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&h=80&fit=crop',
        pages: 8,
        size: '3.1MB',
        readTime: '6 Min Read',
        previewTitle: 'Population and Migration Patterns',
        previewText: 'Population geography examines the distribution, composition, and growth of populations...',
      },
      {
        id: 3,
        name: 'AP_HUG_Unit1.pdf',
        date: '11/05/2025',
        thumbnail: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=120&h=80&fit=crop',
        pages: 6,
        size: '1.8MB',
        readTime: '3 Min Read',
        previewTitle: 'Thinking Geographically',
        previewText: 'This introductory unit covers the foundational concepts of human geography...',
      },
    ],
    units: [
      {
        id: 1,
        title: 'Unit 1',
        pages: 8,
        collaborators: 9,
        examDate: '04/20/2026',
        daysLeft: 85,
        subUnits: withSeededNotes('hug', [
          { id: '1.1', title: '1.1 Introduction to Geography', notes: [] },
          { id: '1.2', title: '1.2 Geographic Tools & Methods', notes: [] },
          { id: '1.3', title: '1.3 Scale of Analysis', notes: [] },
        ]),
      },
      {
        id: 2,
        title: 'Unit 2',
        pages: 12,
        collaborators: 7,
        examDate: '05/15/2026',
        daysLeft: 110,
        subUnits: withSeededNotes('hug', [
          { id: '2.1', title: '2.1 Population Distribution', notes: [] },
          { id: '2.2', title: '2.2 Population Growth', notes: [] },
        ]),
      },
      {
        id: 3,
        title: 'Unit 3',
        pages: 6,
        collaborators: 11,
        examDate: '06/01/2026',
        daysLeft: 127,
        subUnits: withSeededNotes('hug', [
          { id: '3.1', title: '3.1 Cultural Landscapes', notes: [] },
          { id: '3.2', title: '3.2 Cultural Diffusion', notes: [] },
        ]),
      },
      {
        id: 4,
        title: 'Unit 4',
        pages: 10,
        collaborators: 5,
        examDate: '06/20/2026',
        daysLeft: 146,
        subUnits: withSeededNotes('hug', [
          { id: '4.1', title: '4.1 Political Geography', notes: [] },
          { id: '4.2', title: '4.2 Boundaries & Borders', notes: [] },
        ]),
      },
    ],
  },
  {
    id: '2',
    title: 'AP Biology',
    block: 'Block 2',
    classCode: 'BIO-2K7M',
    image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&h=500&fit=crop',
    classmates: 22,
    documents: 28,
    color: '#065f46',
    description: 'Unit 4 - Cell Communication',
    files: [
      {
        id: 10,
        name: 'AP_Bio_Unit4.pdf',
        date: '02/10/2026',
        thumbnail: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=120&h=80&fit=crop',
        pages: 7,
        size: '3.2MB',
        readTime: '5 Min Read',
        previewTitle: 'Cell Communication and Signaling',
        previewText: 'Cell communication involves signal transduction pathways...',
      },
      {
        id: 11,
        name: 'AP_Bio_Unit3.pdf',
        date: '01/15/2026',
        thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=120&h=80&fit=crop',
        pages: 10,
        size: '4.1MB',
        readTime: '7 Min Read',
        previewTitle: 'Cellular Energetics',
        previewText: 'Cellular energetics covers the processes of photosynthesis and cellular respiration...',
      },
    ],
    units: [
      {
        id: 1,
        title: 'Unit 1',
        pages: 9,
        collaborators: 12,
        examDate: '03/25/2026',
        daysLeft: 60,
        subUnits: withSeededNotes('bio', [
          { id: '1.1', title: '1.1 Chemistry of Life', notes: [] },
          { id: '1.2', title: '1.2 Structure of Water', notes: [] },
        ]),
      },
      {
        id: 2,
        title: 'Unit 2',
        pages: 11,
        collaborators: 8,
        examDate: '04/10/2026',
        daysLeft: 76,
        subUnits: withSeededNotes('bio', [
          { id: '2.1', title: '2.1 Cell Structure', notes: [] },
          { id: '2.2', title: '2.2 Cell Membranes', notes: [] },
        ]),
      },
      {
        id: 3,
        title: 'Unit 3',
        pages: 14,
        collaborators: 10,
        examDate: '05/01/2026',
        daysLeft: 97,
        subUnits: withSeededNotes('bio', [
          { id: '3.1', title: '3.1 Enzyme Structure', notes: [] },
          { id: '3.2', title: '3.2 Environmental Impacts on Enzymes', notes: [] },
        ]),
      },
    ],
  },
  {
    id: '3',
    title: 'DE English',
    block: 'Block 6',
    classCode: 'ENG-6Q3R',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=500&fit=crop',
    classmates: 18,
    documents: 19,
    color: '#92400e',
    description: 'Essay 3 - Rhetorical Analysis',
    files: [
      {
        id: 20,
        name: 'DE_ENG_Essay3.pdf',
        date: '02/05/2026',
        thumbnail: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=120&h=80&fit=crop',
        pages: 4,
        size: '1.5MB',
        readTime: '3 Min Read',
        previewTitle: 'Rhetorical Analysis Essay',
        previewText: 'This essay analyzes the rhetorical strategies...',
      },
      {
        id: 21,
        name: 'DE_ENG_Essay2.pdf',
        date: '01/08/2026',
        thumbnail: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120&h=80&fit=crop',
        pages: 6,
        size: '1.9MB',
        readTime: '4 Min Read',
        previewTitle: 'Comparative Literature Analysis',
        previewText: 'A comparative study of themes of identity and belonging...',
      },
    ],
    units: [
      {
        id: 1,
        title: 'Essay 1',
        pages: 3,
        collaborators: 4,
        examDate: '03/15/2026',
        daysLeft: 50,
        subUnits: withSeededNotes('eng', [
          { id: '1.1', title: '1.1 Thesis Development', notes: [] },
          { id: '1.2', title: '1.2 Evidence & Analysis', notes: [] },
        ]),
      },
      {
        id: 2,
        title: 'Essay 2',
        pages: 6,
        collaborators: 6,
        examDate: '04/20/2026',
        daysLeft: 86,
        subUnits: withSeededNotes('eng', [
          { id: '2.1', title: '2.1 Comparative Methods', notes: [] },
          { id: '2.2', title: '2.2 Literary Devices', notes: [] },
        ]),
      },
      {
        id: 3,
        title: 'Essay 3',
        pages: 4,
        collaborators: 5,
        examDate: '05/10/2026',
        daysLeft: 106,
        subUnits: withSeededNotes('eng', [
          { id: '3.1', title: '3.1 Rhetorical Strategies', notes: [] },
          { id: '3.2', title: '3.2 Audience Analysis', notes: [] },
        ]),
      },
    ],
  },
];
