import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, Plus, Heart, Users, FileText,
  ArrowRight, User, X, BookOpen, Link2, Camera, Clock, Check,
  GraduationCap, Palette, FlaskConical, Globe, ChevronDown, Trash2, ImagePlus,
  Filter,
} from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import type { ClassData } from '../App';

interface Props {
  onCourseOpen: (classId: string) => void;
  onFilesOpen: () => void;
  onScanOpen: () => void;
  onFriendsOpen: () => void;
  userName?: string;
  profilePicture?: string | null;
  classes: ClassData[];
  onAddClass: (cls: ClassData) => void;
  onRemoveClass: (id: string) => void;
}

type ShortcutType = 'course' | 'person' | 'scan' | 'link';

interface Shortcut {
  id: string;
  type: ShortcutType;
  label: string;
  avatar?: string;
  url?: string;
}

const defaultShortcuts: Shortcut[] = [
  { id: '1', type: 'course', label: 'Unit 4: AP HUG' },
  { id: '2', type: 'person', label: 'Zara', avatar: '' },
  { id: '3', type: 'scan', label: 'Quick Scan to Math' },
];

const shortcutOptions = [
  { type: 'course' as ShortcutType, icon: BookOpen, title: 'Course Unit', desc: 'Quick access to a specific unit', color: 'bg-blue-50', iconColor: 'text-blue-600' },
  { type: 'person' as ShortcutType, icon: Users, title: 'Study Buddy', desc: "Jump to a friend's profile", color: 'bg-green-50', iconColor: 'text-green-600' },
  { type: 'scan' as ShortcutType, icon: Camera, title: 'Quick Scan', desc: 'Scan notes for a specific course', color: 'bg-amber-50', iconColor: 'text-amber-600' },
  { type: 'link' as ShortcutType, icon: Link2, title: 'Resource Link', desc: 'Save a link to study material', color: 'bg-purple-50', iconColor: 'text-purple-600' },
];

const courseSuggestions = ['AP Human Geography', 'AP Biology', 'DE English', 'AP Calculus AB', 'AP US History', 'Physics 1'];

const friendSuggestions = [
  { name: 'Zara', color: '#DBEAFE', iconColor: 'text-blue-500' },
  { name: 'Annika', color: '#FCE7F3', iconColor: 'text-pink-500' },
  { name: 'Jack', color: '#D1FAE5', iconColor: 'text-emerald-500' },
  { name: 'Will', color: '#FEF3C7', iconColor: 'text-amber-500' },
  { name: 'Nick', color: '#EDE9FE', iconColor: 'text-violet-500' },
  { name: 'Paul', color: '#CCFBF1', iconColor: 'text-teal-500' },
];

const availableClassTemplates = [
  { title: 'AP Calculus AB', icon: GraduationCap, color: '#7c3aed', image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&h=500&fit=crop' },
  { title: 'AP US History', icon: Globe, color: '#b45309', image: 'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=600&h=500&fit=crop' },
  { title: 'Physics 1', icon: FlaskConical, color: '#0369a1', image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=600&h=500&fit=crop' },
  { title: 'AP Art History', icon: Palette, color: '#be185d', image: 'https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=600&h=500&fit=crop' },
  { title: 'AP Chemistry', icon: FlaskConical, color: '#047857', image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&h=500&fit=crop' },
  { title: 'DE Statistics', icon: GraduationCap, color: '#6d28d9', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=500&fit=crop' },
];

const blockOptions = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8'];

// Friends list for search
const friendNames = ['Zara Ramadan', 'Annika Shah', 'Jack Swartz', 'Will Caling', 'Nick Burrus', 'Paul Van Haver'];

export function HomeScreen({ onCourseOpen, onFilesOpen, onScanOpen, onFriendsOpen, userName, profilePicture, classes, onAddClass, onRemoveClass }: Props) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(defaultShortcuts);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalStep, setModalStep] = useState<'type' | 'detail'>('type');
  const [selectedType, setSelectedType] = useState<ShortcutType | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState('');
  const [shortcutUrl, setShortcutUrl] = useState('');
  const [shortcutAdded, setShortcutAdded] = useState(false);

  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [addClassStep, setAddClassStep] = useState<'browse' | 'custom' | 'configure'>('browse');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof availableClassTemplates[0] | null>(null);
  const [customClassName, setCustomClassName] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [showBlockDropdown, setShowBlockDropdown] = useState(false);
  const [classAdded, setClassAdded] = useState(false);
  const [customClassImage, setCustomClassImage] = useState<string | null>(null);

  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [filterChips, setFilterChips] = useState<Set<string>>(new Set(['all']));

  const totalCards = classes.length + 1;

  // Carousel measurement
  const carouselRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const cardGap = 16;
  const cardPad = 24;
  const cardWidth = containerWidth > 0 ? containerWidth - 72 : 280;
  const stepSize = cardWidth + cardGap;

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.offsetWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Close search when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ===== CAROUSEL SWIPE — pointer events for unified touch+mouse =====
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const pointerDragging = useRef(false);
  const totalPointerDelta = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    pointerDragging.current = false;
    totalPointerDelta.current = 0;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;
    const dx = Math.abs(e.clientX - pointerStartX.current);
    const dy = Math.abs(e.clientY - pointerStartY.current);
    totalPointerDelta.current = dx + dy;
    if (dx > dy && dx > 8) {
      pointerDragging.current = true;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    const threshold = 30; // Low threshold for easy swiping
    if (pointerDragging.current) {
      if (dx < -threshold && currentCardIndex < totalCards - 1) {
        setCurrentCardIndex((prev) => prev + 1);
      } else if (dx > threshold && currentCardIndex > 0) {
        setCurrentCardIndex((prev) => prev - 1);
      }
    }
    pointerStartX.current = null;
    pointerStartY.current = null;
    // Small delay to let the click event be prevented if needed
    setTimeout(() => { pointerDragging.current = false; }, 50);
  }, [currentCardIndex, totalCards]);

  const handleCardClick = useCallback((classId: string) => {
    if (totalPointerDelta.current < 10) {
      onCourseOpen(classId);
    }
  }, [onCourseOpen]);

  // ===== SHORTCUT CLICK HANDLERS =====
  const handleShortcutClick = useCallback((shortcut: Shortcut) => {
    switch (shortcut.type) {
      case 'course': {
        // Find matching class
        const match = classes.find((c) =>
          c.title.toLowerCase().includes(shortcut.label.toLowerCase()) ||
          shortcut.label.toLowerCase().includes(c.title.toLowerCase().split(' ').slice(0, 2).join(' '))
        );
        if (match) {
          onCourseOpen(match.id);
        } else {
          // Default to first class
          if (classes.length > 0) onCourseOpen(classes[0].id);
        }
        break;
      }
      case 'person':
        onFriendsOpen();
        break;
      case 'scan':
        onScanOpen();
        break;
      case 'link':
        if (shortcut.url) {
          window.open(shortcut.url, '_blank');
        } else {
          onFilesOpen();
        }
        break;
    }
  }, [classes, onCourseOpen, onFriendsOpen, onScanOpen, onFilesOpen]);

  // ===== SEARCH =====
  const getSearchResults = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return { classes: [], friends: [], files: [] };

    const matchedClasses = classes.filter((c) =>
      c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedFriends = friendNames.filter((f) =>
      f.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedFiles: { name: string; classTitle: string; classId: string }[] = [];
    for (const cls of classes) {
      for (const file of cls.files) {
        if (file.name.toLowerCase().includes(q) || file.previewTitle.toLowerCase().includes(q)) {
          matchedFiles.push({ name: file.name, classTitle: cls.title, classId: cls.id });
        }
      }
    }

    return { classes: matchedClasses, friends: matchedFriends, files: matchedFiles.slice(0, 3) };
  };

  const searchResults = searchQuery.trim() ? getSearchResults() : { classes: [], friends: [], files: [] };
  const hasResults = searchResults.classes.length + searchResults.friends.length + searchResults.files.length > 0;

  // ===== FILTER =====
  const toggleFilterChip = (chip: string) => {
    setFilterChips((prev) => {
      const next = new Set(prev);
      if (chip === 'all') {
        return new Set(['all']);
      }
      next.delete('all');
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      if (next.size === 0) next.add('all');
      return next;
    });
  };

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddClassModal = () => {
    setShowAddClassModal(true);
    setAddClassStep('browse');
    setSelectedTemplate(null);
    setCustomClassName('');
    setSelectedBlock('');
    setShowBlockDropdown(false);
    setClassAdded(false);
    setCustomClassImage(null);
  };

  const selectTemplate = (template: typeof availableClassTemplates[0]) => {
    setSelectedTemplate(template);
    setCustomClassName(template.title);
    setCustomClassImage(null);
    setAddClassStep('configure');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomClassImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addClass = () => {
    const name = customClassName.trim();
    if (!name || !selectedBlock) return;
    const template = selectedTemplate;
    const newClass: ClassData = {
      id: Date.now().toString(),
      title: name,
      block: selectedBlock,
      image: customClassImage || template?.image || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=500&fit=crop',
      classmates: 0,
      documents: 0,
      color: template?.color || '#3D0C11',
      description: 'No units started yet',
      files: [],
      units: [],
    };
    onAddClass(newClass);
    setClassAdded(true);
    setTimeout(() => {
      setShowAddClassModal(false);
      setCurrentCardIndex(classes.length);
    }, 900);
  };

  const removeClass = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveClass(id);
    if (currentCardIndex >= classes.length - 1) {
      setCurrentCardIndex(Math.max(0, classes.length - 2));
    }
  };

  const openModal = () => {
    setShowAddModal(true);
    setModalStep('type');
    setSelectedType(null);
    setShortcutLabel('');
    setShortcutUrl('');
    setShortcutAdded(false);
  };

  const closeModal = () => setShowAddModal(false);

  const selectType = (type: ShortcutType) => {
    setSelectedType(type);
    setModalStep('detail');
    setShortcutLabel('');
    setShortcutUrl('');
  };

  const addShortcut = (label: string, avatar?: string, url?: string) => {
    const newShortcut: Shortcut = { id: Date.now().toString(), type: selectedType || 'course', label, avatar, url };
    setShortcuts((prev) => [...prev, newShortcut]);
    setShortcutAdded(true);
    setTimeout(() => closeModal(), 800);
  };

  return (
    <div className="h-full w-full bg-bg-secondary relative academic-texture">
      <div className="relative z-10 h-full overflow-y-auto hide-scrollbar pb-28">
        {/* Header */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-start justify-between px-6 pt-14">
          <div>
            {userName ? (
              <h1 className="font-display text-[1.75rem] font-bold text-text-primary leading-tight">Hello, {userName}</h1>
            ) : (
              <h1 className="font-display text-[1.75rem] font-bold text-text-primary leading-tight">Welcome Back</h1>
            )}
            <p className="font-body text-sm text-text-secondary mt-1">Welcome to Citadel</p>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-bg-secondary ring-2 ring-maroon/20">
            {profilePicture ? (
              <img src={profilePicture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-bg-secondary">
                <User className="w-7 h-7 text-text-tertiary/60" strokeWidth={1.2} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Search + Filter */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="px-6 mt-6" ref={searchRef}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <div className="flex items-center gap-3 bg-white rounded-2xl px-5 h-13 shadow-sm shadow-black/5">
                <Search className="w-4.5 h-4.5 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search classes, friends, files..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(e.target.value.trim().length > 0);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) setShowSearchResults(true);
                  }}
                  className="flex-1 font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none bg-transparent"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}>
                    <X className="w-4 h-4 text-text-tertiary" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearchResults && searchQuery.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 overflow-hidden z-30 max-h-[300px] overflow-y-auto hide-scrollbar"
                  >
                    {!hasResults ? (
                      <div className="p-6 text-center">
                        <Search className="w-8 h-8 text-text-tertiary/40 mx-auto mb-2" />
                        <p className="font-body text-sm text-text-secondary">No results for "{searchQuery}"</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {searchResults.classes.length > 0 && (
                          <>
                            <p className="px-4 pt-2 pb-1 font-body text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Classes</p>
                            {searchResults.classes.map((cls) => (
                              <button key={cls.id} onClick={() => { onCourseOpen(cls.id); setShowSearchResults(false); setSearchQuery(''); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary transition-colors text-left">
                                <div className="w-9 h-9 rounded-xl bg-maroon/10 flex items-center justify-center shrink-0">
                                  <BookOpen className="w-4 h-4 text-maroon" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-body text-sm font-medium text-text-primary truncate">{cls.title}</p>
                                  <p className="font-body text-[11px] text-text-tertiary">{cls.block}</p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-text-tertiary" />
                              </button>
                            ))}
                          </>
                        )}
                        {searchResults.friends.length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 font-body text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Friends</p>
                            {searchResults.friends.map((name) => (
                              <button key={name} onClick={() => { onFriendsOpen(); setShowSearchResults(false); setSearchQuery(''); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary transition-colors text-left">
                                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 text-green-600" />
                                </div>
                                <p className="font-body text-sm font-medium text-text-primary flex-1">{name}</p>
                                <ArrowRight className="w-3.5 h-3.5 text-text-tertiary" />
                              </button>
                            ))}
                          </>
                        )}
                        {searchResults.files.length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 font-body text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Files</p>
                            {searchResults.files.map((file) => (
                              <button key={file.name} onClick={() => { onCourseOpen(file.classId); setShowSearchResults(false); setSearchQuery(''); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary transition-colors text-left">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-body text-sm font-medium text-text-primary truncate">{file.name}</p>
                                  <p className="font-body text-[11px] text-text-tertiary">{file.classTitle}</p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-text-tertiary" />
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setShowFilterModal(true)} className="w-13 h-13 rounded-full bg-maroon flex items-center justify-center shadow-lg shadow-maroon/30">
              <SlidersHorizontal className="w-4.5 h-4.5 text-white" />
            </button>
          </div>
        </motion.div>

        {/* Shortcuts */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mt-7">
          <h2 className="font-display text-lg font-bold text-text-primary px-6">Shortcuts</h2>
          <div className="flex gap-3 mt-3 px-6 overflow-x-auto hide-scrollbar">
            <button onClick={openModal} className="w-14 h-14 rounded-2xl bg-maroon flex items-center justify-center shrink-0 shadow-md shadow-maroon/20 active:scale-95 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </button>
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                onClick={() => handleShortcutClick(shortcut)}
                className="h-14 px-5 rounded-full bg-white flex items-center gap-2 shrink-0 shadow-sm shadow-black/5 active:scale-95 transition-transform"
              >
                {shortcut.type === 'person' ? (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-100">
                    <User className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.5} />
                  </div>
                ) : shortcut.type === 'course' ? (
                  <FileText className="w-4 h-4 text-maroon" />
                ) : shortcut.type === 'scan' ? (
                  <Camera className="w-4 h-4 text-maroon" />
                ) : (
                  <Link2 className="w-4 h-4 text-maroon" />
                )}
                <span className="font-body text-sm font-medium text-text-primary whitespace-nowrap">{shortcut.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Classes Carousel */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="mt-7">
          <div className="flex items-center justify-between px-6 mb-4">
            <h2 className="font-display text-lg font-bold text-text-primary">My Classes</h2>
            <span className="font-body text-xs text-text-tertiary">
              {currentCardIndex < classes.length ? `${currentCardIndex + 1} / ${classes.length}` : ''}
            </span>
          </div>

          {/* Swipeable Carousel — touch-action: pan-y lets browser handle vertical, we handle horizontal */}
          <div
            ref={carouselRef}
            className="relative overflow-hidden select-none"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <motion.div
              className="flex"
              animate={{ x: -currentCardIndex * stepSize }}
              transition={{ type: 'spring', stiffness: 300, damping: 35 }}
              style={{ gap: cardGap, paddingLeft: cardPad }}
            >
              {classes.map((cls) => (
                <div key={cls.id} className="shrink-0" style={{ width: cardWidth }}>
                  <div
                    onClick={() => handleCardClick(cls.id)}
                    className="w-full rounded-[28px] overflow-hidden relative block text-left cursor-pointer"
                    style={{ height: '370px' }}
                  >
                    <img src={cls.image} alt={cls.title} className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                    <div className="absolute top-5 right-5 flex gap-2 z-10">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={(e) => toggleLike(cls.id, e)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${likedCards.has(cls.id) ? 'bg-red-500' : 'bg-white/20 backdrop-blur-sm'}`}
                      >
                        <Heart className="w-4.5 h-4.5 text-white" strokeWidth={1.5} fill={likedCards.has(cls.id) ? 'white' : 'none'} />
                      </motion.button>
                    </div>
                    <div className="absolute top-5 left-5 z-10">
                      <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => removeClass(cls.id, e)} className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-white/80" />
                      </motion.button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
                      <span className="font-body text-xs font-medium text-white/80 tracking-wider uppercase">{cls.block}</span>
                      <h3 className="font-display text-2xl font-bold text-white mt-1 leading-tight">{cls.title}</h3>
                      <p className="font-body text-xs text-white/60 mt-1.5">{cls.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        {cls.classmates > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-white/70" />
                            <span className="font-body text-xs text-white/80">{cls.classmates}</span>
                          </div>
                        )}
                        <span className="font-body text-xs text-white/70">
                          {cls.documents > 0 ? `${cls.documents} Documents` : 'No documents yet'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-black/50 backdrop-blur-md rounded-full mt-4 px-5 py-3.5 pointer-events-auto">
                        <span className="font-body text-sm font-semibold text-white">
                          {cls.documents > 0 ? 'Keep Learning' : 'Get Started'}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Class Card */}
              <div className="shrink-0" style={{ width: cardWidth }}>
                <button onClick={openAddClassModal} className="w-full rounded-[28px] overflow-hidden relative block" style={{ height: '370px' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-maroon/5 via-bg-secondary to-maroon/10 border-2 border-dashed border-maroon/20 rounded-[28px]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-20 h-20 rounded-3xl bg-maroon/10 flex items-center justify-center">
                      <Plus className="w-9 h-9 text-maroon" strokeWidth={1.5} />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-lg font-bold text-text-primary">Add a Class</p>
                      <p className="font-body text-sm text-text-secondary mt-1">Join or create a new course</p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Carousel Dots */}
          <div className="flex items-center justify-center gap-2 mt-5">
            {Array.from({ length: totalCards }).map((_, i) => (
              <button key={i} onClick={() => setCurrentCardIndex(i)} className="relative p-1">
                <motion.div
                  animate={{ width: currentCardIndex === i ? 24 : 8, backgroundColor: currentCardIndex === i ? '#3D0C11' : '#d1d5db' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  className="h-2 rounded-full"
                />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} className="px-6 mt-7 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold text-text-primary">Overview</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-3xl p-4 shadow-sm shadow-black/5 text-center">
              <div className="w-10 h-10 rounded-xl bg-maroon/10 flex items-center justify-center mx-auto mb-2">
                <BookOpen className="w-5 h-5 text-maroon" />
              </div>
              <p className="font-display text-xl font-bold text-text-primary">{classes.length}</p>
              <p className="font-body text-[11px] text-text-tertiary mt-0.5">Classes</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm shadow-black/5 text-center">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-display text-xl font-bold text-text-primary">{classes.reduce((a, c) => a + c.documents, 0)}</p>
              <p className="font-body text-[11px] text-text-tertiary mt-0.5">Documents</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm shadow-black/5 text-center">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <p className="font-display text-xl font-bold text-text-primary">{classes.reduce((a, c) => a + c.classmates, 0)}</p>
              <p className="font-body text-[11px] text-text-tertiary mt-0.5">Classmates</p>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNav active="home" onHome={() => {}} onScan={onScanOpen} onFriends={onFriendsOpen} onFiles={onFilesOpen} />

      {/* ===== Filter Modal ===== */}
      <AnimatePresence>
        {showFilterModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilterModal(false)} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl" style={{ maxHeight: '70%' }}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
              <div className="flex items-center justify-between px-6 pt-2 pb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-maroon" />
                  <h2 className="font-display text-xl font-bold text-text-primary">Filters</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setSortBy('recent'); setFilterChips(new Set(['all'])); }} className="font-body text-xs text-maroon font-medium">Reset</button>
                  <button onClick={() => setShowFilterModal(false)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center">
                    <X className="w-4.5 h-4.5 text-text-secondary" />
                  </button>
                </div>
              </div>
              <div className="px-6 pb-10 overflow-y-auto hide-scrollbar">
                {/* Sort By */}
                <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Sort By</p>
                <div className="flex flex-col gap-2 mb-6">
                  {[
                    { id: 'recent', label: 'Recent Activity' },
                    { id: 'alpha', label: 'Alphabetical' },
                    { id: 'docs', label: 'Most Documents' },
                    { id: 'classmates', label: 'Most Classmates' },
                  ].map((option) => (
                    <button key={option.id} onClick={() => setSortBy(option.id)} className="flex items-center gap-3 py-2.5 px-1">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${sortBy === option.id ? 'border-maroon bg-maroon' : 'border-gray-300'}`}>
                        {sortBy === option.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className={`font-body text-sm ${sortBy === option.id ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{option.label}</span>
                    </button>
                  ))}
                </div>

                {/* Filter By */}
                <p className="font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Filter By</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {[
                    { id: 'all', label: 'All Classes' },
                    { id: 'ap', label: 'AP Courses' },
                    { id: 'de', label: 'DE Courses' },
                    { id: 'active', label: 'Active' },
                    { id: 'favorites', label: 'Favorites' },
                  ].map((chip) => (
                    <button key={chip.id} onClick={() => toggleFilterChip(chip.id)} className={`px-4 py-2.5 rounded-full font-body text-sm font-medium transition-all ${filterChips.has(chip.id) ? 'bg-maroon text-white shadow-md shadow-maroon/20' : 'bg-bg-secondary text-text-secondary'}`}>
                      {chip.label}
                    </button>
                  ))}
                </div>

                <button onClick={() => setShowFilterModal(false)} className="w-full h-13 bg-maroon text-white font-body font-semibold text-sm rounded-full flex items-center justify-center gap-2 shadow-lg shadow-maroon/20 active:scale-[0.97] transition-transform">
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== Add Class Modal ===== */}
      <AnimatePresence>
        {showAddClassModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddClassModal(false)} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl" style={{ maxHeight: '88%' }}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
              <div className="flex items-center justify-between px-6 pt-2 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-text-primary">
                    {classAdded ? 'Class Added!' : addClassStep === 'browse' ? 'Add a Class' : addClassStep === 'custom' ? 'Create Custom Class' : 'Configure Class'}
                  </h2>
                  {addClassStep === 'browse' && !classAdded && <p className="font-body text-xs text-text-secondary mt-0.5">Choose from popular courses or create your own</p>}
                </div>
                <button onClick={() => setShowAddClassModal(false)} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center active:scale-95 transition-transform">
                  <X className="w-4.5 h-4.5 text-text-secondary" />
                </button>
              </div>

              <div className="overflow-y-auto hide-scrollbar px-6 pb-10" style={{ maxHeight: 'calc(88vh - 100px)' }}>
                <AnimatePresence mode="wait">
                  {classAdded && (
                    <motion.div key="class-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-8">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </motion.div>
                      <p className="font-body text-base font-semibold text-text-primary">{customClassName} added</p>
                      <p className="font-body text-sm text-text-secondary mt-1">Swipe to find it in your classes</p>
                    </motion.div>
                  )}

                  {addClassStep === 'browse' && !classAdded && (
                    <motion.div key="browse" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <p className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-3">Popular Courses</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {availableClassTemplates.map((template, i) => (
                          <motion.button key={template.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => selectTemplate(template)} className="rounded-2xl overflow-hidden relative text-left group active:scale-[0.97] transition-transform" style={{ height: '130px' }}>
                            <img src={template.image} alt={template.title} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5" style={{ backgroundColor: template.color + '40' }}>
                                <template.icon className="w-3.5 h-3.5 text-white" />
                              </div>
                              <p className="font-body text-xs font-semibold text-white leading-tight">{template.title}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      <button onClick={() => { setSelectedTemplate(null); setCustomClassName(''); setAddClassStep('custom'); }} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed border-gray-200 hover:border-maroon/30 active:bg-bg-secondary transition-all">
                        <div className="w-12 h-12 rounded-xl bg-maroon/10 flex items-center justify-center shrink-0"><Plus className="w-5 h-5 text-maroon" /></div>
                        <div className="text-left"><p className="font-body font-semibold text-sm text-text-primary">Create Custom Class</p><p className="font-body text-xs text-text-secondary mt-0.5">Add any course not listed above</p></div>
                        <ArrowRight className="w-4 h-4 text-text-tertiary ml-auto" />
                      </button>
                      <div className="mt-4 p-4 rounded-2xl bg-bg-secondary">
                        <p className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2">Have a class code?</p>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Enter class code" className="flex-1 h-11 px-4 bg-white rounded-xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20" />
                          <button className="h-11 px-5 rounded-xl bg-maroon text-white font-body text-sm font-semibold active:scale-95 transition-transform">Join</button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {addClassStep === 'custom' && !classAdded && (
                    <motion.div key="custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <button onClick={() => setAddClassStep('browse')} className="flex items-center gap-1.5 text-text-secondary font-body text-xs mb-4 active:opacity-60">
                        <ArrowRight className="w-3 h-3 rotate-180" /> Back
                      </button>
                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Class Name</label>
                      <input type="text" placeholder="e.g. AP World History" value={customClassName} onChange={(e) => setCustomClassName(e.target.value)} autoFocus className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all" />
                      <motion.button onClick={() => { if (customClassName.trim()) setAddClassStep('configure'); }} disabled={!customClassName.trim()} whileTap={{ scale: 0.97 }} className={`w-full h-13 font-body font-semibold text-sm rounded-full mt-6 flex items-center justify-center gap-2 transition-all duration-200 ${customClassName.trim() ? 'bg-maroon text-white shadow-lg shadow-maroon/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        Continue <ArrowRight className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  )}

                  {addClassStep === 'configure' && !classAdded && (
                    <motion.div key="configure" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <button onClick={() => setAddClassStep(selectedTemplate ? 'browse' : 'custom')} className="flex items-center gap-1.5 text-text-secondary font-body text-xs mb-4 active:opacity-60">
                        <ArrowRight className="w-3 h-3 rotate-180" /> Back
                      </button>

                      <div className="rounded-2xl overflow-hidden relative mb-5 group" style={{ height: '120px' }}>
                        <img src={customClassImage || selectedTemplate?.image || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=300&fit=crop'} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
                        <div className="absolute bottom-3 left-4"><p className="font-display text-lg font-bold text-white">{customClassName}</p></div>
                        <label className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white transition-colors">
                          <ImagePlus className="w-4 h-4 text-text-primary" />
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                        {customClassImage && (
                          <button onClick={() => setCustomClassImage(null)} className="absolute top-3 left-3 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        )}
                      </div>

                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Class Name</label>
                      <input type="text" value={customClassName} onChange={(e) => setCustomClassName(e.target.value)} className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all mb-4" />

                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Block / Period</label>
                      <div className="relative mb-4">
                        <button onClick={() => setShowBlockDropdown(!showBlockDropdown)} className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-left flex items-center justify-between outline-none focus:ring-2 focus:ring-maroon/20 transition-all">
                          <span className={selectedBlock ? 'text-text-primary' : 'text-text-tertiary'}>{selectedBlock || 'Select a block...'}</span>
                          <motion.div animate={{ rotate: showBlockDropdown ? 180 : 0 }}><ChevronDown className="w-4 h-4 text-text-tertiary" /></motion.div>
                        </button>
                        <AnimatePresence>
                          {showBlockDropdown && (
                            <motion.div initial={{ opacity: 0, y: -10, scaleY: 0.9 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0, y: -10, scaleY: 0.9 }} transition={{ duration: 0.15 }} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 overflow-hidden z-30" style={{ transformOrigin: 'top center' }}>
                              <div className="max-h-[200px] overflow-y-auto hide-scrollbar py-1">
                                {blockOptions.map((block) => (
                                  <button key={block} onClick={() => { setSelectedBlock(block); setShowBlockDropdown(false); }} className={`w-full text-left px-5 py-3 font-body text-sm transition-colors flex items-center justify-between ${selectedBlock === block ? 'bg-maroon/5 text-maroon font-medium' : 'text-text-primary hover:bg-bg-secondary'}`}>
                                    {block}
                                    {selectedBlock === block && <Check className="w-4 h-4 text-maroon" />}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <motion.button onClick={addClass} disabled={!customClassName.trim() || !selectedBlock} whileTap={{ scale: 0.97 }} className={`w-full h-13 font-body font-semibold text-sm rounded-full mt-2 flex items-center justify-center gap-2 transition-all duration-200 ${customClassName.trim() && selectedBlock ? 'bg-maroon text-white shadow-lg shadow-maroon/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        <Plus className="w-4 h-4" /> Add Class
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== Add Shortcut Modal ===== */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl" style={{ maxHeight: '85%' }}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
              <div className="flex items-center justify-between px-6 pt-2 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-text-primary">{modalStep === 'type' ? 'New Shortcut' : shortcutAdded ? 'Added!' : 'Set Up Shortcut'}</h2>
                  {modalStep === 'type' && <p className="font-body text-xs text-text-secondary mt-0.5">Choose what you'd like quick access to</p>}
                </div>
                <button onClick={closeModal} className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center active:scale-95 transition-transform">
                  <X className="w-4.5 h-4.5 text-text-secondary" />
                </button>
              </div>
              <div className="overflow-y-auto hide-scrollbar px-6 pb-10" style={{ maxHeight: 'calc(85vh - 100px)' }}>
                <AnimatePresence mode="wait">
                  {modalStep === 'type' && (
                    <motion.div key="type" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-2.5">
                      {shortcutOptions.map((option, i) => (
                        <motion.button key={option.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} onClick={() => selectType(option.type)} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-maroon/20 active:bg-bg-secondary transition-all text-left group">
                          <div className={`w-12 h-12 rounded-xl ${option.color} flex items-center justify-center shrink-0`}><option.icon className={`w-5 h-5 ${option.iconColor}`} strokeWidth={1.8} /></div>
                          <div className="flex-1"><p className="font-body font-semibold text-sm text-text-primary">{option.title}</p><p className="font-body text-xs text-text-secondary mt-0.5">{option.desc}</p></div>
                          <ArrowRight className="w-4 h-4 text-text-tertiary group-hover:text-maroon transition-colors" />
                        </motion.button>
                      ))}
                      <div className="mt-3 flex items-center gap-2 px-1">
                        <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                        <span className="font-body text-xs text-text-tertiary">{shortcuts.length} shortcut{shortcuts.length !== 1 ? 's' : ''} active</span>
                      </div>
                    </motion.div>
                  )}
                  {modalStep === 'detail' && shortcutAdded && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-8">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4"><Check className="w-8 h-8 text-green-600" /></motion.div>
                      <p className="font-body text-base font-semibold text-text-primary">Shortcut added</p>
                      <p className="font-body text-sm text-text-secondary mt-1">You can find it in your shortcuts bar</p>
                    </motion.div>
                  )}
                  {modalStep === 'detail' && selectedType === 'course' && !shortcutAdded && (
                    <motion.div key="course-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <button onClick={() => setModalStep('type')} className="flex items-center gap-1.5 text-text-secondary font-body text-xs mb-4"><ArrowRight className="w-3 h-3 rotate-180" /> Back</button>
                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Shortcut Name</label>
                      <input type="text" placeholder="e.g. Unit 5: AP Bio" value={shortcutLabel} onChange={(e) => setShortcutLabel(e.target.value)} autoFocus className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all" />
                      <p className="font-body text-xs text-text-secondary mt-4 mb-2">Or pick a course:</p>
                      <div className="flex flex-wrap gap-2">
                        {courseSuggestions.map((c) => (<button key={c} onClick={() => addShortcut(c)} className="px-4 py-2.5 rounded-full bg-bg-secondary font-body text-xs font-medium text-text-primary hover:bg-maroon/10 hover:text-maroon active:scale-95 transition-all">{c}</button>))}
                      </div>
                      <motion.button onClick={() => shortcutLabel.trim() && addShortcut(shortcutLabel.trim())} disabled={!shortcutLabel.trim()} whileTap={{ scale: 0.97 }} className={`w-full h-13 font-body font-semibold text-sm rounded-full mt-6 flex items-center justify-center gap-2 transition-all ${shortcutLabel.trim() ? 'bg-maroon text-white shadow-lg shadow-maroon/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        <Plus className="w-4 h-4" /> Add Shortcut
                      </motion.button>
                    </motion.div>
                  )}
                  {modalStep === 'detail' && selectedType === 'person' && !shortcutAdded && (
                    <motion.div key="person-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <button onClick={() => setModalStep('type')} className="flex items-center gap-1.5 text-text-secondary font-body text-xs mb-4"><ArrowRight className="w-3 h-3 rotate-180" /> Back</button>
                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Search Friends</label>
                      <input type="text" placeholder="Type a name..." value={shortcutLabel} onChange={(e) => setShortcutLabel(e.target.value)} autoFocus className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all" />
                      <p className="font-body text-xs text-text-secondary mt-4 mb-3">Suggested:</p>
                      <div className="flex flex-col gap-2">
                        {friendSuggestions.filter((f) => !shortcutLabel.trim() || f.name.toLowerCase().includes(shortcutLabel.toLowerCase())).map((friend) => (
                          <button key={friend.name} onClick={() => addShortcut(friend.name)} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-bg-secondary active:bg-gray-100 transition-colors">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: friend.color }}>
                              <User className={`w-5 h-5 ${friend.iconColor}`} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 text-left"><p className="font-body text-sm font-medium text-text-primary">{friend.name}</p><p className="font-body text-xs text-text-tertiary">Classmate</p></div>
                            <Plus className="w-4 h-4 text-text-tertiary" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {modalStep === 'detail' && selectedType === 'scan' && !shortcutAdded && (
                    <motion.div key="scan-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <button onClick={() => setModalStep('type')} className="flex items-center gap-1.5 text-text-secondary font-body text-xs mb-4"><ArrowRight className="w-3 h-3 rotate-180" /> Back</button>
                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Shortcut Name</label>
                      <input type="text" placeholder="e.g. Quick Scan to Bio" value={shortcutLabel} onChange={(e) => setShortcutLabel(e.target.value)} autoFocus className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all" />
                      <p className="font-body text-xs text-text-secondary mt-4 mb-2">Quick options:</p>
                      <div className="flex flex-wrap gap-2">
                        {['Quick Scan to Bio', 'Quick Scan to History', 'Scan Homework'].map((item) => (<button key={item} onClick={() => addShortcut(item)} className="px-4 py-2.5 rounded-full bg-bg-secondary font-body text-xs font-medium text-text-primary hover:bg-maroon/10 hover:text-maroon active:scale-95 transition-all">{item}</button>))}
                      </div>
                      <motion.button onClick={() => shortcutLabel.trim() && addShortcut(shortcutLabel.trim())} disabled={!shortcutLabel.trim()} whileTap={{ scale: 0.97 }} className={`w-full h-13 font-body font-semibold text-sm rounded-full mt-6 flex items-center justify-center gap-2 transition-all ${shortcutLabel.trim() ? 'bg-maroon text-white shadow-lg shadow-maroon/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        <Plus className="w-4 h-4" /> Add Shortcut
                      </motion.button>
                    </motion.div>
                  )}
                  {modalStep === 'detail' && selectedType === 'link' && !shortcutAdded && (
                    <motion.div key="link-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                      <button onClick={() => setModalStep('type')} className="flex items-center gap-1.5 text-text-secondary font-body text-xs mb-4"><ArrowRight className="w-3 h-3 rotate-180" /> Back</button>
                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">Label</label>
                      <input type="text" placeholder="e.g. Khan Academy" value={shortcutLabel} onChange={(e) => setShortcutLabel(e.target.value)} autoFocus className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all mb-3" />
                      <label className="font-body text-xs font-semibold text-text-secondary tracking-wide uppercase mb-2 block">URL</label>
                      <input type="url" placeholder="https://..." value={shortcutUrl} onChange={(e) => setShortcutUrl(e.target.value)} className="w-full h-[52px] px-5 bg-input-bg rounded-2xl font-body text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-maroon/20 transition-all" />
                      <motion.button onClick={() => shortcutLabel.trim() && addShortcut(shortcutLabel.trim(), undefined, shortcutUrl.trim())} disabled={!shortcutLabel.trim()} whileTap={{ scale: 0.97 }} className={`w-full h-13 font-body font-semibold text-sm rounded-full mt-6 flex items-center justify-center gap-2 transition-all ${shortcutLabel.trim() ? 'bg-maroon text-white shadow-lg shadow-maroon/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        <Plus className="w-4 h-4" /> Add Shortcut
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
