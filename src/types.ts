export interface UserData {
  name: string;
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
  classCode: string;
  image: string;
  classmates: number;
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
  | 'course-detail'
  | 'files'
  | 'scan'
  | 'friends';
