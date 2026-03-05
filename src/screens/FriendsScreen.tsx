import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Phone, Video, MessageCircle, UserPlus, Check, X,
  Wifi, User, Send, ArrowLeft, Calendar, Clock, Users, Plus, Mic,
} from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

interface Props {
  onHome: () => void;
  onScan: () => void;
  onFiles: () => void;
  profilePicture: string | null;
  userName: string;
}

type Tab = 'friends' | 'requests' | 'discover' | 'sessions';

interface Friend {
  id: number;
  name: string;
  color: string;
  iconColor: string;
  status: 'online' | 'studying' | 'offline';
  course?: string;
  school: string;
  mutualFriends?: number;
}

interface ChatMessage {
  id: number;
  text: string;
  fromMe: boolean;
  time: string;
}

interface StudySession {
  id: number;
  title: string;
  course: string;
  hostId: number;
  date: string;
  time: string;
  participantIds: number[];
  maxParticipants: number;
  isLive: boolean;
}

// Avatar component — colored person icon outline
function Avatar({ color, iconColor, size = 48, className = '' }: { color: string; iconColor: string; size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <User className={iconColor} style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.5} />
    </div>
  );
}

// === Friend Data ===
const friends: Friend[] = [
  {
    id: 1, name: 'Zara Ramadan',
    color: '#DBEAFE', iconColor: 'text-blue-500',
    status: 'online', course: 'AP Human Geo', school: 'Westlake High',
  },
  {
    id: 2, name: 'Annika Shah',
    color: '#FCE7F3', iconColor: 'text-pink-500',
    status: 'studying', course: 'AP Biology', school: 'Westlake High',
  },
  {
    id: 3, name: 'Jack Swartz',
    color: '#D1FAE5', iconColor: 'text-emerald-500',
    status: 'online', course: 'DE English', school: 'Westlake High',
  },
  {
    id: 4, name: 'Will Caling',
    color: '#FEF3C7', iconColor: 'text-amber-500',
    status: 'studying', course: 'AP Calculus', school: 'Westlake High',
  },
  {
    id: 5, name: 'Nick Burrus',
    color: '#EDE9FE', iconColor: 'text-violet-500',
    status: 'offline', school: 'Lightridge High School',
  },
  {
    id: 6, name: 'Paul Van Haver',
    color: '#CCFBF1', iconColor: 'text-teal-500',
    status: 'offline', school: 'Loudoun Valley High School',
  },
];

const getFriendById = (id: number) => friends.find((f) => f.id === id);

// === Request Data ===
const incomingRequests = [
  {
    id: 101, name: 'James Faust',
    color: '#ECFCCB', iconColor: 'text-lime-600',
    school: 'Riverside High School', mutualFriends: 4,
  },
  {
    id: 102, name: 'Saraa Rana',
    color: '#FAE8FF', iconColor: 'text-fuchsia-500',
    school: 'Independence High School', mutualFriends: 7,
  },
];

// === Discover Data ===
const discoverPeople: Friend[] = [
  {
    id: 201, name: 'Rick Reaves',
    color: '#E0E7FF', iconColor: 'text-indigo-500',
    status: 'online', school: 'Loudoun County High School', mutualFriends: 3,
  },
  {
    id: 202, name: 'Roshan Shah',
    color: '#CFFAFE', iconColor: 'text-cyan-500',
    status: 'offline', school: 'Dominion High School', mutualFriends: 5,
  },
  {
    id: 203, name: 'Grayson Bishop',
    color: '#FFEDD5', iconColor: 'text-orange-500',
    status: 'studying', school: 'Rock Ridge High School', mutualFriends: 2,
  },
];

// === Sessions (hosted by friends) ===
const defaultSessions: StudySession[] = [
  {
    id: 1, title: 'AP HUG Unit 6 Review', course: 'AP Human Geography',
    hostId: 1, // Zara
    date: 'Today', time: '7:00 PM', maxParticipants: 8, isLive: true,
    participantIds: [2, 3, 4], // Annika, Jack, Will
  },
  {
    id: 2, title: 'Bio Exam Prep', course: 'AP Biology',
    hostId: 2, // Annika
    date: 'Tomorrow', time: '4:30 PM', maxParticipants: 6, isLive: false,
    participantIds: [1], // Zara
  },
  {
    id: 3, title: 'English Essay Workshop', course: 'DE English',
    hostId: 3, // Jack
    date: 'Fri, Mar 14', time: '6:00 PM', maxParticipants: 10, isLive: false,
    participantIds: [4, 1], // Will, Zara
  },
];

// === Default Chats ===
const defaultChats: Record<number, ChatMessage[]> = {
  1: [
    { id: 1, text: 'Hey, did you finish the Unit 6 notes?', fromMe: false, time: '3:42 PM' },
    { id: 2, text: 'Almost done! Just the urban models section left', fromMe: true, time: '3:44 PM' },
    { id: 3, text: 'Nice, want to study together later?', fromMe: false, time: '3:45 PM' },
  ],
  2: [
    { id: 1, text: 'The bio lab report is due Friday right?', fromMe: true, time: '1:20 PM' },
    { id: 2, text: 'Yes! Do you have the data from experiment 3?', fromMe: false, time: '1:25 PM' },
  ],
  3: [
    { id: 1, text: 'Can you share the English essay rubric?', fromMe: true, time: '11:00 AM' },
  ],
};

export function FriendsScreen({ onHome, onScan, onFiles, profilePicture, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [callingFriend, setCallingFriend] = useState<Friend | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [sentRequests, setSentRequests] = useState<number[]>([]);
  const [dismissedRequests, setDismissedRequests] = useState<number[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<number[]>([]);

  // Chat state
  const [chattingWith, setChattingWith] = useState<Friend | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>(defaultChats);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Study session state
  const [sessions, setSessions] = useState<StudySession[]>(defaultSessions);
  const [joinedSessions, setJoinedSessions] = useState<Set<number>>(new Set());
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionCourse, setNewSessionCourse] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('');
  const [inGroupCall, setInGroupCall] = useState<StudySession | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chattingWith]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'friends', label: 'Friends', count: friends.length },
    { id: 'requests', label: 'Requests', count: incomingRequests.length - dismissedRequests.length - acceptedRequests.length },
    { id: 'sessions', label: 'Sessions', count: sessions.filter((s) => s.isLive).length },
    { id: 'discover', label: 'Discover' },
  ];

  const statusColor = (status: string) => {
    switch (status) { case 'online': return 'bg-green-400'; case 'studying': return 'bg-amber-400'; default: return 'bg-gray-300'; }
  };

  const statusLabel = (status: string) => {
    switch (status) { case 'online': return 'Online'; case 'studying': return 'Studying'; default: return 'Offline'; }
  };

  const startCall = (friend: Friend, type: 'audio' | 'video') => {
    setCallType(type);
    setCallingFriend(friend);
  };

  const endCall = () => { setCallingFriend(null); };

  const openChat = (friend: Friend) => {
    setChattingWith(friend);
    if (!chatMessages[friend.id]) {
      setChatMessages((prev) => ({ ...prev, [friend.id]: [] }));
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !chattingWith) return;
    const msg: ChatMessage = {
      id: Date.now(),
      text: newMessage.trim(),
      fromMe: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => ({
      ...prev,
      [chattingWith.id]: [...(prev[chattingWith.id] || []), msg],
    }));
    setNewMessage('');
  };

  const joinSession = (sessionId: number) => {
    setJoinedSessions((prev) => new Set(prev).add(sessionId));
  };

  const createSession = () => {
    if (!newSessionTitle.trim() || !newSessionCourse.trim()) return;
    const session: StudySession = {
      id: Date.now(), title: newSessionTitle, course: newSessionCourse,
      hostId: 0, // user-created
      date: newSessionDate || 'Today', time: newSessionTime || '5:00 PM',
      participantIds: [], maxParticipants: 8, isLive: false,
    };
    setSessions((prev) => [session, ...prev]);
    setShowCreateSession(false);
    setNewSessionTitle('');
    setNewSessionCourse('');
    setNewSessionDate('');
    setNewSessionTime('');
  };

  const filteredFriends = friends.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const onlineFriends = filteredFriends.filter((f) => f.status !== 'offline');
  const offlineFriends = filteredFriends.filter((f) => f.status === 'offline');

  // ===== Chat View =====
  if (chattingWith) {
    const messages = chatMessages[chattingWith.id] || [];
    return (
      <div className="h-full w-full bg-white relative flex flex-col">
        {/* Chat Header */}
        <div className="px-4 pt-14 pb-3 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setChattingWith(null)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-4.5 h-4.5 text-text-primary" />
          </button>
          <div className="relative">
            <Avatar color={chattingWith.color} iconColor={chattingWith.iconColor} size={40} />
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColor(chattingWith.status)}`} />
          </div>
          <div className="flex-1">
            <p className="font-body text-sm font-semibold text-text-primary">{chattingWith.name}</p>
            <p className="font-body text-[11px] text-text-tertiary">{statusLabel(chattingWith.status)}{chattingWith.course ? ` • ${chattingWith.course}` : ''}</p>
          </div>
          <button onClick={() => startCall(chattingWith, 'audio')} className="w-9 h-9 rounded-full bg-maroon/5 flex items-center justify-center">
            <Phone className="w-4 h-4 text-maroon" />
          </button>
          <button onClick={() => startCall(chattingWith, 'video')} className="w-9 h-9 rounded-full bg-maroon/5 flex items-center justify-center">
            <Video className="w-4 h-4 text-maroon" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-text-tertiary" />
              </div>
              <p className="font-body text-sm text-text-secondary">No messages yet</p>
              <p className="font-body text-xs text-text-tertiary mt-1">Say hi to {chattingWith.name.split(' ')[0]}!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex mb-3 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${msg.fromMe ? 'bg-maroon text-white rounded-br-md' : 'bg-bg-secondary text-text-primary rounded-bl-md'}`}>
                <p className="font-body text-sm">{msg.text}</p>
                <p className={`font-body text-[10px] mt-1 ${msg.fromMe ? 'text-white/60' : 'text-text-tertiary'}`}>{msg.time}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-6 pt-2 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center shrink-0">
              <Plus className="w-4.5 h-4.5 text-text-tertiary" />
            </button>
            <div className="flex-1 flex items-center bg-bg-secondary rounded-full px-4 h-11">
              <input
                type="text" placeholder="Message..." value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none bg-transparent"
              />
              <button className="ml-2"><Mic className="w-4 h-4 text-text-tertiary" /></button>
            </div>
            <button onClick={sendMessage} disabled={!newMessage.trim()} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${newMessage.trim() ? 'bg-maroon' : 'bg-gray-200'}`}>
              <Send className={`w-4 h-4 ${newMessage.trim() ? 'text-white' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {/* Call overlay */}
        <AnimatePresence>
          {callingFriend && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-maroon flex flex-col items-center justify-center">
              <div className="absolute inset-0 opacity-5"><div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} /></div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <motion.div className="absolute inset-0 rounded-full border-2 border-white/20" animate={{ scale: [1, 1.6, 1.6], opacity: [0.4, 0, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} style={{ margin: '-20px' }} />
                  <Avatar color={callingFriend.color} iconColor={callingFriend.iconColor} size={112} className="border-[3px] border-white/30 shadow-2xl" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white mt-8">{callingFriend.name}</h2>
                <div className="flex items-center gap-2 mt-2"><Wifi className="w-3.5 h-3.5 text-white/50" /><p className="font-body text-sm text-white/60">{callType === 'video' ? 'Video' : 'Audio'} Calling...</p></div>
                <motion.p animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="font-body text-xs text-white/40 mt-1">Connecting</motion.p>
              </motion.div>
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="absolute bottom-20 flex items-center gap-6">
                <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><MessageCircle className="w-6 h-6 text-white" /></button>
                <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40"><Phone className="w-7 h-7 text-white rotate-[135deg]" /></button>
                <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><Video className="w-6 h-6 text-white" /></button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== Group Call View =====
  if (inGroupCall) {
    const host = getFriendById(inGroupCall.hostId);
    const participants = inGroupCall.participantIds.map((pid) => getFriendById(pid)).filter(Boolean) as Friend[];
    return (
      <div className="h-full w-full bg-[#1a1a1a] relative flex flex-col items-center justify-center">
        <div className="absolute top-14 left-0 right-0 px-6 text-center">
          <p className="font-body text-xs text-white/50 uppercase tracking-wider">{inGroupCall.course}</p>
          <h2 className="font-display text-xl font-bold text-white mt-1">{inGroupCall.title}</h2>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="font-body text-xs text-white/60">{participants.length + 2} in session</p>
          </div>
        </div>
        {/* Participant grid */}
        <div className="grid grid-cols-2 gap-4 px-8 mt-8">
          {/* You */}
          <div className="bg-white/10 rounded-3xl aspect-square flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-green-400 mb-2 flex items-center justify-center bg-maroon/30">
              {profilePicture ? <img src={profilePicture} alt="You" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-white/60" />}
            </div>
            <p className="font-body text-sm font-medium text-white">You</p>
            <div className="flex items-center gap-1 mt-1"><Mic className="w-3 h-3 text-green-400" /><p className="font-body text-[10px] text-white/50">Speaking</p></div>
          </div>
          {/* Host */}
          {host && (
            <div className="bg-white/10 rounded-3xl aspect-square flex flex-col items-center justify-center p-4">
              <div className="border-2 border-amber-400 rounded-full mb-2">
                <Avatar color={host.color} iconColor={host.iconColor} size={64} />
              </div>
              <p className="font-body text-sm font-medium text-white">{host.name.split(' ')[0]}</p>
              <div className="flex items-center gap-1 mt-1"><span className="font-body text-[10px] text-amber-400">Host</span></div>
            </div>
          )}
          {!host && (
            <div className="bg-white/10 rounded-3xl aspect-square flex flex-col items-center justify-center p-4">
              <div className="w-16 h-16 rounded-full border-2 border-amber-400 mb-2 flex items-center justify-center bg-maroon/30">
                {profilePicture ? <img src={profilePicture} alt="You" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-white/60" />}
              </div>
              <p className="font-body text-sm font-medium text-white">You</p>
              <div className="flex items-center gap-1 mt-1"><span className="font-body text-[10px] text-amber-400">Host</span></div>
            </div>
          )}
          {/* Other participants */}
          {participants.slice(0, 2).map((p) => (
            <div key={p.id} className="bg-white/10 rounded-3xl aspect-square flex flex-col items-center justify-center p-4">
              <div className="border-2 border-white/20 rounded-full mb-2">
                <Avatar color={p.color} iconColor={p.iconColor} size={64} />
              </div>
              <p className="font-body text-sm font-medium text-white">{p.name.split(' ')[0]}</p>
              <div className="flex items-center gap-1 mt-1"><Mic className="w-3 h-3 text-white/30" /></div>
            </div>
          ))}
        </div>
        {/* Controls */}
        <div className="absolute bottom-16 flex items-center gap-4">
          <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><Mic className="w-6 h-6 text-white" /></button>
          <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><Video className="w-6 h-6 text-white" /></button>
          <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><MessageCircle className="w-6 h-6 text-white" /></button>
          <button onClick={() => setInGroupCall(null)} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40"><Phone className="w-6 h-6 text-white rotate-[135deg]" /></button>
        </div>
      </div>
    );
  }

  // ===== Main Friends View =====
  return (
    <div className="h-full w-full bg-bg-secondary relative">
      {/* Call overlay */}
      <AnimatePresence>
        {callingFriend && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-maroon flex flex-col items-center justify-center">
            <div className="absolute inset-0 opacity-5"><div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} /></div>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="relative z-10 flex flex-col items-center">
              <div className="relative">
                <motion.div className="absolute inset-0 rounded-full border-2 border-white/20" animate={{ scale: [1, 1.6, 1.6], opacity: [0.4, 0, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} style={{ margin: '-20px' }} />
                <motion.div className="absolute inset-0 rounded-full border-2 border-white/15" animate={{ scale: [1, 1.8, 1.8], opacity: [0.3, 0, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }} style={{ margin: '-20px' }} />
                <Avatar color={callingFriend.color} iconColor={callingFriend.iconColor} size={112} className="border-[3px] border-white/30 shadow-2xl" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white mt-8">{callingFriend.name}</h2>
              <div className="flex items-center gap-2 mt-2"><Wifi className="w-3.5 h-3.5 text-white/50" /><p className="font-body text-sm text-white/60">{callType === 'video' ? 'Video' : 'Audio'} Calling...</p></div>
              <motion.p animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="font-body text-xs text-white/40 mt-1">Connecting</motion.p>
            </motion.div>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="absolute bottom-20 flex items-center gap-6">
              <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><MessageCircle className="w-6 h-6 text-white" /></button>
              <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40"><Phone className="w-7 h-7 text-white rotate-[135deg]" /></button>
              <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"><Video className="w-6 h-6 text-white" /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 h-full overflow-y-auto hide-scrollbar pb-28">
        {/* Header */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="px-6 pt-14">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-[1.75rem] font-bold text-text-primary leading-tight">Friends</h1>
              <p className="font-body text-sm text-text-secondary mt-0.5">Connect & study together</p>
            </div>
            <div className="w-11 h-11 rounded-full overflow-hidden bg-maroon/10 ring-2 ring-maroon/20">
              {profilePicture ? <img src={profilePicture} alt={userName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-bg-secondary"><User className="w-6 h-6 text-text-tertiary/60" strokeWidth={1.3} /></div>}
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="px-6 mt-5">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-5 h-12 shadow-sm shadow-black/5">
            <Search className="w-4.5 h-4.5 text-text-tertiary" />
            <input type="text" placeholder="Search friends..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none bg-transparent" />
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="flex gap-2 px-6 mt-5 overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-body text-sm font-medium whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'bg-maroon text-white shadow-md shadow-maroon/20' : 'bg-white text-text-secondary'}`}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-maroon/10 text-maroon'}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ===== Friends Tab ===== */}
          {activeTab === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-6 mt-5">
              {onlineFriends.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider">Active Now</h3>
                  </div>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar mb-5 -mx-1 px-1">
                    {onlineFriends.map((friend) => (
                      <button key={friend.id} onClick={() => openChat(friend)} className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className="relative">
                          <Avatar color={friend.color} iconColor={friend.iconColor} size={64} className="border-2 border-white shadow-md" />
                          <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${statusColor(friend.status)}`} />
                        </div>
                        <p className="font-body text-[11px] text-text-primary font-medium w-16 truncate text-center">{friend.name.split(' ')[0]}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">All Friends</h3>
              <div className="flex flex-col gap-2">
                {filteredFriends.filter((f) => f.status !== 'offline').map((friend, i) => (
                  <motion.div key={friend.id} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }} className="bg-white rounded-2xl p-3.5 shadow-sm shadow-black/3 flex items-center gap-3">
                    <button onClick={() => openChat(friend)} className="relative shrink-0">
                      <Avatar color={friend.color} iconColor={friend.iconColor} size={48} />
                      <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColor(friend.status)}`} />
                    </button>
                    <button onClick={() => openChat(friend)} className="flex-1 min-w-0 text-left">
                      <p className="font-body text-sm font-semibold text-text-primary">{friend.name}</p>
                      <span className={`font-body text-[11px] ${friend.status === 'studying' ? 'text-amber-500' : 'text-green-500'}`}>{statusLabel(friend.status)}</span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openChat(friend)} className="w-9 h-9 rounded-full bg-maroon/5 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-maroon" /></button>
                      <button onClick={() => startCall(friend, 'audio')} className="w-9 h-9 rounded-full bg-maroon/5 flex items-center justify-center"><Phone className="w-4 h-4 text-maroon" /></button>
                      <button onClick={() => startCall(friend, 'video')} className="w-9 h-9 rounded-full bg-maroon/5 flex items-center justify-center"><Video className="w-4 h-4 text-maroon" /></button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {offlineFriends.length > 0 && (
                <>
                  <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mt-5 mb-3">Offline</h3>
                  <div className="flex flex-col gap-2">
                    {offlineFriends.map((friend, i) => (
                      <motion.div key={friend.id} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + 0.05 * i }} className="bg-white rounded-2xl p-3.5 shadow-sm shadow-black/3 flex items-center gap-3 opacity-60">
                        <div className="relative shrink-0">
                          <Avatar color={friend.color} iconColor={friend.iconColor} size={48} className="grayscale-[0.3]" />
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-semibold text-text-primary">{friend.name}</p>
                          <p className="font-body text-[11px] text-text-tertiary">{friend.school}</p>
                        </div>
                        <button onClick={() => openChat(friend)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center shrink-0">
                          <MessageCircle className="w-4 h-4 text-text-tertiary" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ===== Requests Tab ===== */}
          {activeTab === 'requests' && (
            <motion.div key="requests" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-6 mt-5">
              <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Incoming Requests</h3>
              {incomingRequests.filter((r) => !dismissedRequests.includes(r.id) && !acceptedRequests.includes(r.id)).length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-3"><UserPlus className="w-6 h-6 text-text-tertiary" /></div>
                  <p className="font-body text-sm font-medium text-text-primary">No pending requests</p>
                  <p className="font-body text-xs text-text-tertiary mt-1">You&apos;re all caught up!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {incomingRequests.filter((r) => !dismissedRequests.includes(r.id) && !acceptedRequests.includes(r.id)).map((request, i) => (
                    <motion.div key={request.id} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }} className="bg-white rounded-2xl p-4 shadow-sm shadow-black/3">
                      <div className="flex items-center gap-3">
                        <Avatar color={request.color} iconColor={request.iconColor} size={48} />
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-semibold text-text-primary">{request.name}</p>
                          <p className="font-body text-[11px] text-text-tertiary">{request.school} • {request.mutualFriends} mutual friends</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => setAcceptedRequests([...acceptedRequests, request.id])} className="flex-1 h-10 bg-maroon text-white font-body font-semibold text-sm rounded-full flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"><Check className="w-4 h-4" /> Accept</button>
                        <button onClick={() => setDismissedRequests([...dismissedRequests, request.id])} className="flex-1 h-10 bg-bg-secondary text-text-secondary font-body font-semibold text-sm rounded-full flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"><X className="w-4 h-4" /> Decline</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {acceptedRequests.length > 0 && (
                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-green-50 border border-green-100 rounded-2xl p-4 mt-4">
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /><p className="font-body text-sm text-green-700 font-medium">{acceptedRequests.length} request{acceptedRequests.length > 1 ? 's' : ''} accepted!</p></div>
                </motion.div>
              )}
              <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mt-6 mb-3">Sent Requests</h3>
              <div className="bg-white rounded-2xl p-4 shadow-sm shadow-black/3">
                <div className="flex items-center gap-3">
                  <Avatar color="#E0E7FF" iconColor="text-indigo-500" size={40} />
                  <div className="flex-1 min-w-0"><p className="font-body text-sm font-semibold text-text-primary">Rick Reaves</p><p className="font-body text-[11px] text-text-tertiary">Sent 2 days ago</p></div>
                  <span className="font-body text-[11px] font-medium text-amber-500 bg-amber-50 px-2.5 py-1 rounded-full">Pending</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== Sessions Tab ===== */}
          {activeTab === 'sessions' && (
            <motion.div key="sessions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-6 mt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider">Study Sessions</h3>
                <button onClick={() => setShowCreateSession(true)} className="h-8 px-4 bg-maroon text-white font-body text-xs font-semibold rounded-full flex items-center gap-1.5 active:scale-95 transition-transform shadow-md shadow-maroon/20">
                  <Plus className="w-3.5 h-3.5" /> New Session
                </button>
              </div>

              {/* Create Session Form */}
              <AnimatePresence>
                {showCreateSession && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-display text-base font-bold text-text-primary">Create Session</h4>
                        <button onClick={() => setShowCreateSession(false)} className="w-7 h-7 rounded-full bg-bg-secondary flex items-center justify-center"><X className="w-3.5 h-3.5 text-text-tertiary" /></button>
                      </div>
                      <input type="text" placeholder="Session title (e.g. Unit 5 Review)" value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} className="w-full h-11 px-4 bg-bg-secondary rounded-xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none mb-3 focus:ring-2 focus:ring-maroon/20" />
                      <input type="text" placeholder="Course (e.g. AP Biology)" value={newSessionCourse} onChange={(e) => setNewSessionCourse(e.target.value)} className="w-full h-11 px-4 bg-bg-secondary rounded-xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none mb-3 focus:ring-2 focus:ring-maroon/20" />
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="font-body text-[10px] font-semibold text-text-tertiary uppercase mb-1 block">Date</label>
                          <input type="text" placeholder="e.g. Tomorrow" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-full h-11 px-4 bg-bg-secondary rounded-xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20" />
                        </div>
                        <div>
                          <label className="font-body text-[10px] font-semibold text-text-tertiary uppercase mb-1 block">Time</label>
                          <input type="text" placeholder="e.g. 5:00 PM" value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} className="w-full h-11 px-4 bg-bg-secondary rounded-xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20" />
                        </div>
                      </div>
                      <button onClick={createSession} disabled={!newSessionTitle.trim() || !newSessionCourse.trim()} className={`w-full h-11 rounded-full font-body text-sm font-semibold flex items-center justify-center gap-2 transition-all ${newSessionTitle.trim() && newSessionCourse.trim() ? 'bg-maroon text-white shadow-md shadow-maroon/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        <Calendar className="w-4 h-4" /> Create Session
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Session Cards */}
              <div className="flex flex-col gap-3">
                {sessions.map((session, i) => {
                  const sessionHost = getFriendById(session.hostId);
                  const sessionParticipants = session.participantIds.map((pid) => getFriendById(pid)).filter(Boolean) as Friend[];
                  return (
                    <motion.div key={session.id} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }} className="bg-white rounded-2xl p-4 shadow-sm shadow-black/3">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {session.isLive && <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span className="font-body text-[10px] font-bold text-red-500">LIVE</span></span>}
                            <span className="font-body text-[10px] text-text-tertiary bg-bg-secondary px-2 py-0.5 rounded-full">{session.course}</span>
                          </div>
                          <h4 className="font-body text-sm font-bold text-text-primary">{session.title}</h4>
                        </div>
                        <div className="text-right">
                          <p className="font-body text-[11px] font-medium text-text-primary">{session.date}</p>
                          <p className="font-body text-[11px] text-text-tertiary">{session.time}</p>
                        </div>
                      </div>

                      {/* Host + Participants */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center -space-x-2">
                            {sessionHost ? (
                              <Avatar color={sessionHost.color} iconColor={sessionHost.iconColor} size={28} className="border-2 border-white ring-1 ring-gray-100" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-maroon/20 flex items-center justify-center border-2 border-white ring-1 ring-gray-100">
                                {profilePicture ? <img src={profilePicture} alt="You" className="w-full h-full rounded-full object-cover" /> : <User className="w-3.5 h-3.5 text-maroon" />}
                              </div>
                            )}
                            {sessionParticipants.slice(0, 3).map((p) => (
                              <Avatar key={p.id} color={p.color} iconColor={p.iconColor} size={28} className="border-2 border-white ring-1 ring-gray-100" />
                            ))}
                          </div>
                          <span className="font-body text-[11px] text-text-tertiary">{sessionParticipants.length + 1}/{session.maxParticipants}</span>
                        </div>

                        {session.isLive ? (
                          <button onClick={() => setInGroupCall(session)} className="h-9 px-4 bg-maroon text-white font-body text-xs font-semibold rounded-full flex items-center gap-1.5 active:scale-95 transition-transform shadow-md shadow-maroon/20">
                            <Phone className="w-3.5 h-3.5" /> Join Call
                          </button>
                        ) : joinedSessions.has(session.id) ? (
                          <span className="h-9 px-4 bg-green-50 text-green-700 font-body text-xs font-semibold rounded-full flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Joined
                          </span>
                        ) : (
                          <button onClick={() => joinSession(session.id)} className="h-9 px-4 bg-maroon/10 text-maroon font-body text-xs font-semibold rounded-full flex items-center gap-1.5 active:scale-95 transition-transform">
                            <Users className="w-3.5 h-3.5" /> RSVP
                          </button>
                        )}
                      </div>

                      {/* Host info */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
                        <Clock className="w-3 h-3 text-text-tertiary" />
                        <span className="font-body text-[11px] text-text-tertiary">Hosted by {sessionHost ? sessionHost.name : userName || 'You'}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ===== Discover Tab ===== */}
          {activeTab === 'discover' && (
            <motion.div key="discover" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-6 mt-5">
              <div className="bg-maroon/5 rounded-2xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-maroon/10 flex items-center justify-center shrink-0 mt-0.5"><UserPlus className="w-5 h-5 text-maroon" /></div>
                  <div><p className="font-body text-sm font-semibold text-text-primary">Find Study Partners</p><p className="font-body text-xs text-text-secondary mt-0.5 leading-relaxed">Connect with classmates who share your courses and study together.</p></div>
                </div>
              </div>
              <h3 className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Suggested for You</h3>
              <div className="flex flex-col gap-2.5">
                {discoverPeople.map((person, i) => (
                  <motion.div key={person.id} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }} className="bg-white rounded-2xl p-4 shadow-sm shadow-black/3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar color={person.color} iconColor={person.iconColor} size={48} />
                        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColor(person.status)}`} />
                      </div>
                      <div className="flex-1 min-w-0"><p className="font-body text-sm font-semibold text-text-primary">{person.name}</p><p className="font-body text-[11px] text-text-tertiary">{person.school} • {person.mutualFriends} mutual friends</p></div>
                      <button onClick={() => { if (!sentRequests.includes(person.id)) setSentRequests([...sentRequests, person.id]); }} className={`h-9 px-4 rounded-full font-body text-xs font-semibold transition-all active:scale-[0.95] flex items-center gap-1.5 ${sentRequests.includes(person.id) ? 'bg-bg-secondary text-text-tertiary' : 'bg-maroon text-white shadow-md shadow-maroon/20'}`}>
                        {sentRequests.includes(person.id) ? <><Check className="w-3.5 h-3.5" /> Sent</> : <><UserPlus className="w-3.5 h-3.5" /> Add</>}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mt-5 bg-white rounded-2xl p-5 shadow-sm shadow-black/3 text-center">
                <div className="w-12 h-12 rounded-full bg-maroon/5 flex items-center justify-center mx-auto mb-3"><UserPlus className="w-5 h-5 text-maroon" /></div>
                <p className="font-body text-sm font-semibold text-text-primary">Invite by Link</p>
                <p className="font-body text-xs text-text-tertiary mt-1 mb-3">Share your invite link with friends</p>
                <button className="h-10 px-6 bg-maroon text-white font-body font-semibold text-sm rounded-full active:scale-[0.97] transition-transform shadow-md shadow-maroon/20">Copy Invite Link</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav active="people" onHome={onHome} onScan={onScan} onFriends={() => {}} onFiles={onFiles} />
    </div>
  );
}
