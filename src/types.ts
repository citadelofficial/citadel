export interface UserData {
  name: string;
  username: string;
  email: string;
  grade: string;
  school: string;
  profilePicture: string | null;
}

export interface FriendData {
  id: string;
  name: string;
  color: string;
  status: 'online' | 'studying' | 'offline';
  course?: string;
  lastMessage?: string;
  grade?: string;
  school?: string;
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
  source?: 'camera' | 'library' | 'document';
}

export interface SubUnitNote {
  id: number;
  title: string;
  author: string;
  date: string;
  pages: number;
  content: string;
}

export interface Quiz {
  id: number;
  title: string;
  questions: number;
  score?: number; // percentage 0-100 if taken
  date: string;
}

export interface SubUnit {
  id: string;
  title: string;
  notes: SubUnitNote[];
  quizzes?: Quiz[];
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
  classCode: string;
  image: string;
  classmates: number;
  classmateNames?: string[];
  documents: number;
  color: string;
  description: string;
  files: FileData[];
  units: UnitData[];
}

export type Screen =
  | 'splash'
  | 'onboarding'
  | 'signin'
  | 'home'
  | 'profile'
  | 'person-profile'
  | 'info-page'
  | 'course-detail'
  | 'files'
  | 'scan'
  | 'friends';
