export interface UserData {
  name: string;
  username: string;
  email: string;
  grade: string;
  schools: string[];
  primarySchool: string;
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
  schools?: string[];
  avatarUrl?: string | null;
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

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0-3
  selectedIndex?: number; // user's answer
  hint?: string; // AI-generated hint
}

export interface QuizAttempt {
  userId: string;
  userName: string;
  score: number;           // percentage 0-100
  correct: number;
  total: number;
  date: string;            // formatted date string
  answers: (number | null)[];
}

export interface Quiz {
  id: number;
  title: string;
  questions: number;
  score?: number; // best score for current user (percentage 0-100)
  date: string;
  status?: 'generating' | 'ready' | 'grading' | 'graded';
  questionData?: QuizQuestion[];
  scoreHistory?: QuizAttempt[];
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
  school?: string;
  teacher?: string;
}

export interface ClassInvite {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_display_name: string;
  class_title: string;
  class_code: string;
  class_data: ClassData;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
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
  | 'friends'
  | 'school';
